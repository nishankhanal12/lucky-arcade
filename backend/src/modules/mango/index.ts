import { insert, query, queryOne } from '../../database/connection';
import {
  getProbabilities,
  pickWeightedOutcome,
  getPendingForcedOutcome,
  consumeForcedOutcome,
} from '../probability-engine';
import { getRewardByMilestone, incrementGamesPlayed, updateLeaderboardStats, logWinner } from '../reward-engine';
import { MangoOutcome, MangoBoard, MangoCell } from '../../types';

const GAME_ID = 2;
const COLS = 7;
const ROWS = 10;

interface StoredSession {
  outcome: MangoOutcome;
  safePath: number[];
  currentRow: number;
}

function createEmptyBoard(): MangoCell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'bomb' as MangoCell)
  );
}

function generateBoardForOutcome(outcome: MangoOutcome): { board: MangoBoard; safePath: number[] } {
  const fullBoard = createEmptyBoard();
  const safePath: number[] = [];

  const maxRow = outcome === 'LOSE_BEFORE_5' ? Math.floor(Math.random() * 4) + 1
    : outcome === 'REACH_5' ? 5
    : outcome === 'REACH_7' ? 7
    : 10;

  let col = Math.floor(COLS / 2);
  for (let row = 0; row < maxRow; row++) {
    safePath.push(col);
    fullBoard[row][col] = 'mango';
    if (row < maxRow - 1) {
      const delta = Math.random() > 0.5 ? 1 : -1;
      col = Math.max(0, Math.min(COLS - 1, col + delta));
    }
  }

  const clientBoard: MangoBoard = fullBoard.map(row =>
    row.map(cell => (cell === 'mango' ? 'hidden' : 'hidden'))
  );

  return { board: clientBoard, safePath };
}

function getFullBoardFromPath(safePath: number[]): MangoCell[][] {
  const board = createEmptyBoard();
  for (let row = 0; row < safePath.length; row++) {
    board[row][safePath[row]] = 'mango';
  }
  return board;
}

export async function startMangoGame(playerId: number, playerName: string, customBoardId?: number) {
  await incrementGamesPlayed();

  let safePath: number[] = [];
  let outcome: MangoOutcome;
  let forcedOutcome: string | null = null;

  if (customBoardId) {
    const custom = await queryOne<{ board_data: string }>(
      'SELECT board_data FROM custom_boards WHERE id = ?',
      [customBoardId]
    );
    if (!custom) throw new Error('Custom board not found');
    outcome = 'REACH_10';
  } else {
    const forced = await getPendingForcedOutcome(GAME_ID);
    if (forced) {
      outcome = forced as MangoOutcome;
      forcedOutcome = forced;
      await consumeForcedOutcome(GAME_ID, forced);
    } else {
      const config = await getProbabilities(GAME_ID);
      const weights: Record<MangoOutcome, number> = {
        LOSE_BEFORE_5: config['LOSE_BEFORE_5'] || 40,
        REACH_5: config['REACH_5'] || 30,
        REACH_7: config['REACH_7'] || 20,
        REACH_10: config['REACH_10'] || 10,
      };
      outcome = pickWeightedOutcome(weights);
    }
    const generated = generateBoardForOutcome(outcome);
    safePath = generated.safePath;
  }

  const sessionId = await insert(
    `INSERT INTO game_sessions (player_id, game_id, status, forced_outcome, predetermined_outcome, board_data)
     VALUES (?, ?, 'active', ?, ?, ?)`,
    [
      playerId,
      GAME_ID,
      forcedOutcome,
      JSON.stringify({ outcome, safePath, currentRow: 0 }),
      JSON.stringify(safePath),
    ]
  );

  const clientBoard: MangoBoard = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'hidden' as MangoCell)
  );

  return { sessionId, board: clientBoard, outcome, playerName, rows: ROWS, cols: COLS };
}

export async function mangoReveal(sessionId: number, row: number, col: number, playerName: string) {
  const session = await queryOne<{
    id: number;
    player_id: number;
    board_data: string;
    predetermined_outcome: string;
    status: string;
  }>('SELECT * FROM game_sessions WHERE id = ? AND status = ?', [sessionId, 'active']);

  if (!session) throw new Error('Invalid session');

  const pred: StoredSession = JSON.parse(session.predetermined_outcome as unknown as string);
  const safePath: number[] = JSON.parse(session.board_data as unknown as string);
  const isMango = safePath[row] === col;

  if (!isMango) {
    await query(
      `UPDATE game_sessions SET status = 'completed', finished_at = NOW(),
       score = ?, result = ? WHERE id = ?`,
      [row, JSON.stringify({ outcome: 'bomb', row, col }), sessionId]
    );
    await updateLeaderboardStats(session.player_id, GAME_ID, playerName, row, 0);
    return { cell: 'bomb', gameOver: true, row, reward: null, rewardAmount: 0, rewardDesc: '' };
  }

  pred.currentRow = row + 1;
  await query(
    'UPDATE game_sessions SET predetermined_outcome = ?, score = ? WHERE id = ?',
    [JSON.stringify(pred), row + 1, sessionId]
  );

  let reward = null;
  let rewardAmount = 0;
  let rewardDesc = '';
  const milestones: Record<number, string> = { 4: 'row_5', 6: 'row_7', 9: 'row_10' };

  if (milestones[row]) {
    const r = await getRewardByMilestone(GAME_ID, milestones[row]);
    if (r) {
      reward = r;
      rewardAmount = Number(r.reward_value);
      rewardDesc = r.description;
    }
  }

  const maxRow = pred.outcome === 'REACH_5' ? 5
    : pred.outcome === 'REACH_7' ? 7
    : pred.outcome === 'REACH_10' ? 10
    : safePath.length;
  const gameOver = row + 1 >= maxRow || row === 9;

  if (gameOver) {
    await query(
      `UPDATE game_sessions SET status = 'completed', finished_at = NOW(),
       reward_amount = ?, reward_description = ?, result = ? WHERE id = ?`,
      [rewardAmount, rewardDesc, JSON.stringify({ outcome: pred.outcome, finalRow: row + 1 }), sessionId]
    );
    await updateLeaderboardStats(session.player_id, GAME_ID, playerName, row + 1, rewardAmount);
    if (rewardAmount > 0) {
      await logWinner({
        player_id: session.player_id,
        game_id: GAME_ID,
        session_id: sessionId,
        player_name: playerName,
        game_name: 'Mango Quest',
        reward_description: rewardDesc,
        reward_amount: rewardAmount,
      });
    }
  }

  return { cell: 'mango', gameOver, row, reward, rewardAmount, rewardDesc, currentRow: row + 1 };
}

export async function saveCustomBoard(name: string, board: MangoCell[][], difficulty: string) {
  return insert(
    'INSERT INTO custom_boards (name, difficulty, board_data) VALUES (?, ?, ?)',
    [name, difficulty, JSON.stringify(board)]
  );
}

export async function getCustomBoards() {
  return query('SELECT id, name, difficulty, created_at FROM custom_boards ORDER BY created_at DESC');
}

export async function getCustomBoard(id: number) {
  return queryOne('SELECT * FROM custom_boards WHERE id = ?', [id]);
}

export async function generateBoard(difficulty: string) {
  const outcome: MangoOutcome =
    difficulty === 'easy' ? 'REACH_10'
    : difficulty === 'medium' ? 'REACH_7'
    : difficulty === 'hard' ? 'LOSE_BEFORE_5'
    : 'REACH_5';
  const fullBoard = getFullBoardFromPath(generateBoardForOutcome(outcome).safePath);
  return fullBoard;
}

export { GAME_ID as MANGO_GAME_ID, COLS, ROWS };
