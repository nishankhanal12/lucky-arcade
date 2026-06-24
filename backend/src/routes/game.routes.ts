import { Router, Request, Response } from 'express';
import { insert, query, queryOne } from '../database/connection';
import { sendSuccess, sendError } from '../utils/api-response';
import { getRecentWinners, getLeaderboard, getTopWinners } from '../modules/leaderboard';
import { getSystemSettings } from '../modules/admin';
import { startPlinkoGame, finishPlinkoGame } from '../modules/plinko';
import { startMangoGame, mangoReveal } from '../modules/mango';
import { startTapRushGame, tapRushScore, finishTapRushGame } from '../modules/tap-rush';
import { emitPlayerJoined, emitGameStarted, emitGameFinished, emitWinnerAnnounced } from '../modules/socket';

const router = Router();

async function getOrCreatePlayer(displayName: string) {
  let player = await queryOne<{ id: number }>(
    'SELECT id FROM players WHERE display_name = ? ORDER BY id DESC LIMIT 1',
    [displayName]
  );
  if (!player) {
    const id = await insert('INSERT INTO players (display_name) VALUES (?)', [displayName]);
    player = { id };
  }
  return player;
}

router.get('/home', async (_req: Request, res: Response) => {
  try {
    const settings = await getSystemSettings();
    const overview = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(metric_value), 0) as total FROM analytics
       WHERE metric_key = 'games_played' AND recorded_at = CURDATE()`
    );
    const winners = await getRecentWinners(5);
    const leaderboard = await getTopWinners(5);
    const games = await query('SELECT * FROM games WHERE is_active = TRUE');

    sendSuccess(res, {
      eventTitle: settings.event_title || 'Lucky Arcade',
      currentJackpot: Number(settings.current_jackpot || 50000),
      gamesPlayedToday: Number(overview?.total || 0),
      recentWinners: winners,
      leaderboard,
      games,
    });
  } catch (err) {
    sendError(res, 'Failed to load home data', 500, err);
  }
});

router.post('/player/join', async (req: Request, res: Response) => {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) return sendError(res, 'Display name required', 400);
    const player = await getOrCreatePlayer(displayName.trim());
    await emitPlayerJoined(displayName.trim());
    sendSuccess(res, { playerId: player.id, displayName: displayName.trim() }, 'Player joined');
  } catch (err) {
    sendError(res, 'Failed to join', 500, err);
  }
});

router.get('/games', async (_req: Request, res: Response) => {
  try {
    const games = await query('SELECT * FROM games WHERE is_active = TRUE');
    sendSuccess(res, games);
  } catch (err) {
    sendError(res, 'Failed to load games', 500, err);
  }
});

router.post('/plinko/start', async (req: Request, res: Response) => {
  try {
    const { playerId, playerName } = req.body;
    const result = await startPlinkoGame(playerId, playerName);
    emitGameStarted({ sessionId: result.sessionId, playerName, gameSlug: 'plinko', gameName: 'Plinko Drop' });
    sendSuccess(res, result, 'Plinko game started');
  } catch (err) {
    sendError(res, 'Failed to start Plinko', 500, err);
  }
});

router.post('/plinko/finish', async (req: Request, res: Response) => {
  try {
    const { sessionId, playerName } = req.body;
    const result = await finishPlinkoGame(sessionId, playerName);
    emitGameFinished({ sessionId, playerName, gameSlug: 'plinko', result });
    if (result.rewardAmount > 0) {
      await emitWinnerAnnounced({
        playerName,
        game: 'Plinko Drop',
        reward: result.rewardDesc,
        amount: result.rewardAmount,
      });
      if (result.multiplier === 50) {
        const { emitJackpotWon } = await import('../modules/socket');
        emitJackpotWon({ playerName, amount: result.rewardAmount, game: 'Plinko Drop' });
      }
    }
    sendSuccess(res, result, 'Plinko game finished');
  } catch (err) {
    sendError(res, 'Failed to finish Plinko', 500, err);
  }
});

router.post('/mango/start', async (req: Request, res: Response) => {
  try {
    const { playerId, playerName, customBoardId } = req.body;
    const result = await startMangoGame(playerId, playerName, customBoardId);
    emitGameStarted({ sessionId: result.sessionId, playerName, gameSlug: 'mango-quest', gameName: 'Mango Quest' });
    sendSuccess(res, result, 'Mango Quest started');
  } catch (err) {
    sendError(res, 'Failed to start Mango Quest', 500, err);
  }
});

router.post('/mango/reveal', async (req: Request, res: Response) => {
  try {
    const { sessionId, row, col, playerName } = req.body;
    const result = await mangoReveal(sessionId, row, col, playerName);
    if (result.gameOver) {
      emitGameFinished({ sessionId, playerName, gameSlug: 'mango-quest', result });
      if (result.rewardAmount && result.rewardAmount > 0) {
        await emitWinnerAnnounced({
          playerName,
          game: 'Mango Quest',
          reward: result.rewardDesc || '',
          amount: result.rewardAmount,
        });
      }
    }
    sendSuccess(res, result);
  } catch (err) {
    sendError(res, 'Failed to reveal cell', 500, err);
  }
});

router.post('/tap-rush/start', async (req: Request, res: Response) => {
  try {
    const { playerId, playerName } = req.body;
    const result = await startTapRushGame(playerId, playerName);
    emitGameStarted({ sessionId: result.sessionId, playerName, gameSlug: 'green-tap-rush', gameName: 'Green Tap Rush' });
    sendSuccess(res, result, 'Tap Rush started');
  } catch (err) {
    sendError(res, 'Failed to start Tap Rush', 500, err);
  }
});

router.post('/tap-rush/tap', async (req: Request, res: Response) => {
  try {
    const { sessionId, taps, playerName } = req.body;
    const result = await tapRushScore(sessionId, taps, playerName);
    sendSuccess(res, result);
  } catch (err) {
    sendError(res, 'Failed to record tap', 500, err);
  }
});

router.post('/tap-rush/finish', async (req: Request, res: Response) => {
  try {
    const { sessionId, taps, playerName } = req.body;
    const result = await finishTapRushGame(sessionId, taps, playerName);
    emitGameFinished({ sessionId, playerName, gameSlug: 'green-tap-rush', result });
    if (result.rewardAmount > 0) {
      await emitWinnerAnnounced({
        playerName,
        game: 'Green Tap Rush',
        reward: result.rewardDesc,
        amount: result.rewardAmount,
      });
    }
    sendSuccess(res, result, 'Tap Rush finished');
  } catch (err) {
    sendError(res, 'Failed to finish Tap Rush', 500, err);
  }
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as 'winnings' | 'score' | 'games') || 'winnings';
    const data = await getLeaderboard(type, 50);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, 'Failed to load leaderboard', 500, err);
  }
});

router.get('/winners', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await getRecentWinners(limit);
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, 'Failed to load winners', 500, err);
  }
});

export default router;
