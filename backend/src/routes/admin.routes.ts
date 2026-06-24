import { Router, Request, Response, NextFunction } from 'express';
import { adminLogin, getOverview, getSystemSettings, updateSystemSetting, getLiveSessions } from '../modules/admin';
import {
  getProbabilities,
  updateProbabilities,
  adjustPlinkoRTP,
  validateProbabilitiesSum,
  queueForcedOutcome,
} from '../modules/probability-engine';
import { getRewards, createReward, updateReward, deleteReward } from '../modules/reward-engine';
import { getPlinkoProbabilities } from '../modules/plinko';
import { saveCustomBoard, getCustomBoards, getCustomBoard, generateBoard } from '../modules/mango';
import { getGameStats, getHourlyActivity, getDailyStats } from '../modules/analytics';
import { getRecentWinners, getLeaderboard } from '../modules/leaderboard';
import { emitAdminChangedProbability, emitAdminForcedOutcome } from '../modules/socket';
import { sendSuccess, sendError } from '../utils/api-response';
import { PLINKO_GAME_ID } from '../modules/plinko';
import { MANGO_GAME_ID } from '../modules/mango';
import { TAP_RUSH_GAME_ID } from '../modules/tap-rush';

const router = Router();
const adminSessions = new Set<string>();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-admin-token'] as string;
  if (!token || !adminSessions.has(token)) {
    return sendError(res, 'Unauthorized', 401);
  }
  next();
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const valid = await adminLogin(username, password);
    if (!valid) return sendError(res, 'Invalid credentials', 401);
    const token = `admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    adminSessions.add(token);
    sendSuccess(res, { token, username }, 'Login successful');
  } catch (err) {
    sendError(res, 'Login failed', 500, err);
  }
});

router.get('/overview', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getOverview());
  } catch (err) {
    sendError(res, 'Failed to load overview', 500, err);
  }
});

router.get('/settings', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getSystemSettings());
  } catch (err) {
    sendError(res, 'Failed to load settings', 500, err);
  }
});

router.put('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    await updateSystemSetting(key, value);
    sendSuccess(res, { key, value }, 'Setting updated');
  } catch (err) {
    sendError(res, 'Failed to update setting', 500, err);
  }
});

router.get('/probabilities/:gameId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    sendSuccess(res, await getProbabilities(gameId));
  } catch (err) {
    sendError(res, 'Failed to load probabilities', 500, err);
  }
});

router.put('/probabilities/:gameId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const config = req.body.config as Record<string, number>;
    const keys = Object.keys(config);
    if (!validateProbabilitiesSum(config, keys)) {
      return sendError(res, 'Probabilities must sum to 100%', 400);
    }
    await updateProbabilities(gameId, config);
    emitAdminChangedProbability({ gameId, config });
    sendSuccess(res, { config }, 'Probabilities updated');
  } catch (err) {
    sendError(res, 'Failed to update probabilities', 500, err);
  }
});

router.post('/plinko/rtp', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rtp } = req.body;
    const validRtp = [60, 70, 80, 90, 95];
    if (!validRtp.includes(rtp)) {
      return sendError(res, 'RTP must be 60, 70, 80, 90, or 95', 400);
    }
    const config = await adjustPlinkoRTP(PLINKO_GAME_ID, rtp);
    emitAdminChangedProbability({ gameId: PLINKO_GAME_ID, config });
    sendSuccess(res, { config, rtp }, 'RTP updated');
  } catch (err) {
    sendError(res, 'Failed to set RTP', 500, err);
  }
});

router.get('/plinko/probabilities', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getPlinkoProbabilities());
  } catch (err) {
    sendError(res, 'Failed to load Plinko probabilities', 500, err);
  }
});

router.post('/force-outcome', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { gameId, outcome } = req.body;
    await queueForcedOutcome(gameId, outcome);
    emitAdminForcedOutcome({ gameId, outcome });
    sendSuccess(res, { gameId, outcome }, 'Outcome queued');
  } catch (err) {
    sendError(res, 'Failed to queue outcome', 500, err);
  }
});

router.get('/rewards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
    sendSuccess(res, await getRewards(gameId));
  } catch (err) {
    sendError(res, 'Failed to load rewards', 500, err);
  }
});

router.post('/rewards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = await createReward(req.body);
    sendSuccess(res, { id, ...req.body }, 'Reward created', 201);
  } catch (err) {
    sendError(res, 'Failed to create reward', 500, err);
  }
});

router.put('/rewards/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await updateReward(parseInt(req.params.id), req.body);
    sendSuccess(res, { id: parseInt(req.params.id) }, 'Reward updated');
  } catch (err) {
    sendError(res, 'Failed to update reward', 500, err);
  }
});

router.delete('/rewards/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await deleteReward(parseInt(req.params.id));
    sendSuccess(res, {}, 'Reward deleted');
  } catch (err) {
    sendError(res, 'Failed to delete reward', 500, err);
  }
});

router.get('/winners', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getRecentWinners(50));
  } catch (err) {
    sendError(res, 'Failed to load winners', 500, err);
  }
});

router.get('/leaderboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as 'winnings' | 'score' | 'games') || 'winnings';
    sendSuccess(res, await getLeaderboard(type, 50));
  } catch (err) {
    sendError(res, 'Failed to load leaderboard', 500, err);
  }
});

router.get('/live-sessions', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getLiveSessions());
  } catch (err) {
    sendError(res, 'Failed to load live sessions', 500, err);
  }
});

router.get('/analytics/games', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getGameStats());
  } catch (err) {
    sendError(res, 'Failed to load game stats', 500, err);
  }
});

router.get('/analytics/hourly', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getHourlyActivity());
  } catch (err) {
    sendError(res, 'Failed to load hourly activity', 500, err);
  }
});

router.get('/analytics/daily', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getDailyStats());
  } catch (err) {
    sendError(res, 'Failed to load daily stats', 500, err);
  }
});

router.get('/boards', requireAdmin, async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, await getCustomBoards());
  } catch (err) {
    sendError(res, 'Failed to load boards', 500, err);
  }
});

router.get('/boards/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    sendSuccess(res, await getCustomBoard(parseInt(req.params.id)));
  } catch (err) {
    sendError(res, 'Failed to load board', 500, err);
  }
});

router.post('/boards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, board, difficulty } = req.body;
    const id = await saveCustomBoard(name, board, difficulty || 'custom');
    sendSuccess(res, { id, name }, 'Board saved', 201);
  } catch (err) {
    sendError(res, 'Failed to save board', 500, err);
  }
});

router.post('/boards/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.body;
    const board = await generateBoard(difficulty || 'medium');
    sendSuccess(res, { board });
  } catch (err) {
    sendError(res, 'Failed to generate board', 500, err);
  }
});

export { PLINKO_GAME_ID, MANGO_GAME_ID, TAP_RUSH_GAME_ID };
export default router;
