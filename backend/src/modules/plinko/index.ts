import { insert, query, queryOne } from '../../database/connection';
import {
  getProbabilities,
  pickWeightedOutcome,
  getPendingForcedOutcome,
  consumeForcedOutcome,
} from '../probability-engine';
import { incrementGamesPlayed, updateLeaderboardStats, logWinner } from '../reward-engine';
import { PlinkoMultiplier, PlinkoForceOutcome } from '../../types';

const GAME_ID = 1;
const MULTIPLIERS: PlinkoMultiplier[] = [0, 0.5, 1, 2, 5, 10, 50];
const BASE_BET = parseInt(process.env.BASE_BET || '100');

const FORCE_MAP: Record<PlinkoForceOutcome, PlinkoMultiplier[]> = {
  LOSE: [0],
  SMALL_WIN: [0.5, 1],
  MEDIUM_WIN: [2, 5],
  BIG_WIN: [10],
  JACKPOT: [50],
};

function multiplierToKey(m: PlinkoMultiplier): string {
  return `multiplier_${m}`;
}

function pickMultiplierFromConfig(config: Record<string, number>): PlinkoMultiplier {
  const weights: Record<string, number> = {};
  for (const m of MULTIPLIERS) {
    weights[multiplierToKey(m)] = config[multiplierToKey(m)] || 0;
  }
  const key = pickWeightedOutcome(weights);
  return parseFloat(key.replace('multiplier_', '')) as PlinkoMultiplier;
}

function resolveForceOutcome(force: string): PlinkoMultiplier {
  const options = FORCE_MAP[force as PlinkoForceOutcome];
  if (!options) return pickMultiplierFromConfig({});
  return options[Math.floor(Math.random() * options.length)];
}

function generatePath(targetSlot: number, numRows = 12): ('L' | 'R')[] {
  const path: ('L' | 'R')[] = [];
  let position = Math.floor(MULTIPLIERS.length / 2);
  const slots = MULTIPLIERS.length;

  for (let row = 0; row < numRows; row++) {
    const remaining = numRows - row - 1;
    const needRight = targetSlot - position;
    if (needRight > remaining) {
      path.push('R');
      position++;
    } else if (needRight < 0) {
      path.push('L');
      position--;
    } else {
      const dir = Math.random() > 0.5 ? 'R' : 'L';
      path.push(dir);
      position += dir === 'R' ? 1 : -1;
    }
    position = Math.max(0, Math.min(slots - 1, position));
  }
  return path;
}

export async function startPlinkoGame(playerId: number, playerName: string) {
  await incrementGamesPlayed();

  const forced = await getPendingForcedOutcome(GAME_ID);
  let multiplier: PlinkoMultiplier;
  let forcedOutcome: string | null = null;

  if (forced) {
    multiplier = resolveForceOutcome(forced);
    forcedOutcome = forced;
    await consumeForcedOutcome(GAME_ID, forced);
  } else {
    const config = await getProbabilities(GAME_ID);
    multiplier = pickMultiplierFromConfig(config);
  }

  const slotIndex = MULTIPLIERS.indexOf(multiplier);
  const path = generatePath(slotIndex);
  const reward = BASE_BET * multiplier;

  const sessionId = await insert(
    `INSERT INTO game_sessions (player_id, game_id, status, forced_outcome, predetermined_outcome, score, reward_amount)
     VALUES (?, ?, 'active', ?, ?, ?, ?)`,
    [
      playerId,
      GAME_ID,
      forcedOutcome,
      JSON.stringify({ multiplier, slotIndex, path, baseBet: BASE_BET }),
      Math.round(reward),
      reward,
    ]
  );

  return {
    sessionId,
    multiplier,
    slotIndex,
    path,
    baseBet: BASE_BET,
    reward,
    playerName,
  };
}

export async function finishPlinkoGame(sessionId: number, playerName: string) {
  const session = await queryOne<{
    id: number;
    player_id: number;
    predetermined_outcome: string;
    reward_amount: number;
    status: string;
  }>('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);

  if (!session || session.status !== 'active') {
    throw new Error('Invalid session');
  }

  const outcome = JSON.parse(session.predetermined_outcome as unknown as string);
  const rewardAmount = Number(session.reward_amount);
  const rewardDesc = outcome.multiplier === 0
    ? 'No win'
    : outcome.multiplier === 50
    ? `JACKPOT! ${outcome.multiplier}x = ${rewardAmount} Rupees`
    : `${outcome.multiplier}x = ${rewardAmount} Rupees`;

  await query(
    `UPDATE game_sessions SET status = 'completed', finished_at = NOW(),
     reward_description = ?, result = ? WHERE id = ?`,
    [rewardDesc, JSON.stringify(outcome), sessionId]
  );

  await updateLeaderboardStats(session.player_id, GAME_ID, playerName, Math.round(rewardAmount), rewardAmount);

  if (rewardAmount > 0) {
    await logWinner({
      player_id: session.player_id,
      game_id: GAME_ID,
      session_id: sessionId,
      player_name: playerName,
      game_name: 'Plinko Drop',
      reward_description: rewardDesc,
      reward_amount: rewardAmount,
    });
  }

  return { rewardAmount, rewardDesc, multiplier: outcome.multiplier };
}

export async function getPlinkoProbabilities() {
  return getProbabilities(GAME_ID);
}

export { GAME_ID as PLINKO_GAME_ID, MULTIPLIERS, BASE_BET };
