import { Router, Request, Response } from 'express';
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
import { getRecentWinners, getLeaderboard, getTopWinners } from '../modules/leaderboard';
import { emitAdminChangedProbability, emitAdminForcedOutcome, emitLiveSessions } from '../modules/socket';
import { PLINKO_GAME_ID } from '../modules/plinko';
import { MANGO_GAME_ID } from '../modules/mango';
import { TAP_RUSH_GAME_ID } from '../modules/tap-rush';

const router = Router();

const adminSessions = new Set<string>();

function requireAdmin(req: Request, res: Response, next: () => void) {
  const token = req.headers['x-admin-token'] as string;
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const valid = await adminLogin(username, password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = `admin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    adminSessions.add(token);
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/overview', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const overview = await getOverview();
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/settings', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = await getSystemSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    await updateSystemSetting(key, value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/probabilities/:gameId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const config = await getProbabilities(gameId);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/probabilities/:gameId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const config = req.body.config as Record<string, number>;
    const keys = Object.keys(config);
    if (!validateProbabilitiesSum(config, keys)) {
      return res.status(400).json({ error: 'Probabilities must sum to 100%' });
    }
    await updateProbabilities(gameId, config);
    emitAdminChangedProbability({ gameId, config });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/plinko/rtp', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rtp } = req.body;
    const validRtp = [60, 70, 80, 90, 95];
    if (!validRtp.includes(rtp)) {
      return res.status(400).json({ error: 'RTP must be 60, 70, 80, 90, or 95' });
    }
    const config = await adjustPlinkoRTP(PLINKO_GAME_ID, rtp);
    emitAdminChangedProbability({ gameId: PLINKO_GAME_ID, config });
    res.json({ success: true, config, rtp });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/plinko/probabilities', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await getPlinkoProbabilities();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/force-outcome', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { gameId, outcome } = req.body;
    await queueForcedOutcome(gameId, outcome);
    emitAdminForcedOutcome({ gameId, outcome });
    res.json({ success: true, gameId, outcome });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/rewards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : undefined;
    const rewards = await getRewards(gameId);
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/rewards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = await createReward(req.body);
    res.json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/rewards/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await updateReward(parseInt(req.params.id), req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/rewards/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await deleteReward(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/winners', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const winners = await getRecentWinners(50);
    res.json(winners);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/leaderboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as 'winnings' | 'score' | 'games') || 'winnings';
    const data = await getLeaderboard(type, 50);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/live-sessions', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const sessions = await getLiveSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/analytics/games', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getGameStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/analytics/hourly', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getHourlyActivity();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/analytics/daily', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getDailyStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/boards', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const boards = await getCustomBoards();
    res.json(boards);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/boards/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const board = await getCustomBoard(parseInt(req.params.id));
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/boards', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, board, difficulty } = req.body;
    const id = await saveCustomBoard(name, board, difficulty || 'custom');
    res.json({ id, name });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/boards/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { difficulty } = req.body;
    const board = await generateBoard(difficulty || 'medium');
    res.json({ board });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export { PLINKO_GAME_ID, MANGO_GAME_ID, TAP_RUSH_GAME_ID };
export default router;
