import { insert, query, queryOne } from '../../database/connection';
import { parseJsonField } from '../../utils/api-response';
import {
  getProbabilities,
  pickWeightedOutcome,
  getPendingForcedOutcome,
  consumeForcedOutcome,
} from '../probability-engine';
import { getRewardByMilestone, incrementGamesPlayed, updateLeaderboardStats, logWinner } from '../reward-engine';
import { TapRushOutcome } from '../../types';

const GAME_ID = 3;
const GRID_SIZE = 5;

interface TapRushConfig {
  min_visibility_ms: number;
  max_visibility_ms: number;
  tile_size: number;
  spawn_interval_ms: number;
  game_duration: number;
}

const OUTCOME_TARGETS: Record<TapRushOutcome, number> = {
  FAIL: 5,
  REACH_10: 10,
  REACH_20: 20,
  REACH_30: 30,
  REACH_40: 40,
};

function getDifficultyParams(outcome: TapRushOutcome, config: TapRushConfig) {
  const target = OUTCOME_TARGETS[outcome];
  const difficultyFactor = outcome === 'FAIL' ? 0.3
    : outcome === 'REACH_10' ? 0.5
    : outcome === 'REACH_20' ? 0.7
    : outcome === 'REACH_30' ? 0.85
    : 1.0;

  return {
    targetTaps: target,
    minVisibility: Math.max(200, config.min_visibility_ms * (1.1 - difficultyFactor * 0.5)),
    maxVisibility: Math.max(400, config.max_visibility_ms * (1.1 - difficultyFactor * 0.3)),
    spawnInterval: Math.max(200, config.spawn_interval_ms * (1.2 - difficultyFactor * 0.4)),
    gameDuration: config.game_duration * 1000,
    tileSize: config.tile_size,
  };
}

export async function startTapRushGame(playerId: number, playerName: string) {
  await incrementGamesPlayed();

  const config = await getProbabilities(GAME_ID);
  const tapConfig: TapRushConfig = {
    min_visibility_ms: config['min_visibility_ms'] || 800,
    max_visibility_ms: config['max_visibility_ms'] || 2000,
    tile_size: config['tile_size'] || 1,
    spawn_interval_ms: config['spawn_interval_ms'] || 500,
    game_duration: config['game_duration'] || 30,
  };

  let outcome: TapRushOutcome;
  let forcedOutcome: string | null = null;

  const forced = await getPendingForcedOutcome(GAME_ID);
  if (forced) {
    outcome = forced as TapRushOutcome;
    forcedOutcome = forced;
    await consumeForcedOutcome(GAME_ID, forced);
  } else {
    const weights: Record<TapRushOutcome, number> = {
      FAIL: config['FAIL'] || 35,
      REACH_10: config['REACH_10'] || 25,
      REACH_20: config['REACH_20'] || 20,
      REACH_30: config['REACH_30'] || 12,
      REACH_40: config['REACH_40'] || 8,
    };
    outcome = pickWeightedOutcome(weights);
  }

  const params = getDifficultyParams(outcome, tapConfig);

  const sessionId = await insert(
    `INSERT INTO game_sessions (player_id, game_id, status, forced_outcome, predetermined_outcome)
     VALUES (?, ?, 'active', ?, ?)`,
    [
      playerId,
      GAME_ID,
      forcedOutcome,
      JSON.stringify({ outcome, ...params, taps: 0, gridSize: GRID_SIZE }),
    ]
  );

  return { sessionId, ...params, gridSize: GRID_SIZE, playerName, outcome };
}

export async function tapRushScore(sessionId: number, taps: number, playerName: string) {
  const session = await queryOne<{
    id: number;
    player_id: number;
    predetermined_outcome: string;
    status: string;
  }>('SELECT * FROM game_sessions WHERE id = ?', [sessionId, 'active']);

  if (!session || session.status !== 'active') throw new Error('Invalid session');

  const pred = parseJsonField<Record<string, unknown>>(session.predetermined_outcome);
  pred.taps = taps;

  await query(
    'UPDATE game_sessions SET predetermined_outcome = ?, score = ? WHERE id = ?',
    [JSON.stringify(pred), taps, sessionId]
  );

  return { taps, targetTaps: pred.targetTaps as number };
}

export async function finishTapRushGame(sessionId: number, taps: number, playerName: string) {
  const session = await queryOne<{
    id: number;
    player_id: number;
    predetermined_outcome: string;
    status: string;
  }>('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);

  if (!session) throw new Error('Invalid session');

  const pred = parseJsonField<{
    outcome: TapRushOutcome;
    targetTaps: number;
    taps?: number;
  }>(session.predetermined_outcome);
  const outcome = pred.outcome as TapRushOutcome;
  const target = OUTCOME_TARGETS[outcome];

  const effectiveTaps = outcome === 'FAIL'
    ? Math.min(taps, target - 1)
    : Math.max(taps, target);

  let milestone = '';
  if (effectiveTaps >= 40) milestone = 'taps_40';
  else if (effectiveTaps >= 30) milestone = 'taps_30';
  else if (effectiveTaps >= 20) milestone = 'taps_20';
  else if (effectiveTaps >= 10) milestone = 'taps_10';

  let reward = null;
  let rewardAmount = 0;
  let rewardDesc = '';

  if (milestone) {
    const r = await getRewardByMilestone(GAME_ID, milestone);
    if (r) {
      reward = r;
      rewardAmount = Number(r.reward_value);
      rewardDesc = r.description;
    }
  }

  await query(
    `UPDATE game_sessions SET status = 'completed', finished_at = NOW(),
     score = ?, reward_amount = ?, reward_description = ?,
     result = ? WHERE id = ?`,
    [
      effectiveTaps,
      rewardAmount,
      rewardDesc,
      JSON.stringify({ outcome, taps: effectiveTaps, target }),
      sessionId,
    ]
  );

  await updateLeaderboardStats(session.player_id, GAME_ID, playerName, effectiveTaps, rewardAmount);

  if (rewardAmount > 0) {
    await logWinner({
      player_id: session.player_id,
      game_id: GAME_ID,
      session_id: sessionId,
      player_name: playerName,
      game_name: 'Green Tap Rush',
      reward_description: rewardDesc,
      reward_amount: rewardAmount,
    });
  }

  return { taps: effectiveTaps, target, reward, rewardAmount, rewardDesc, outcome };
}

export { GAME_ID as TAP_RUSH_GAME_ID, GRID_SIZE };
