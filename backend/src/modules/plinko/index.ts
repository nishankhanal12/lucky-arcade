import { insert, query, queryOne } from '../../database/connection';
import { parseJsonField } from '../../utils/api-response';
import {
  getProbabilities,
  pickWeightedOutcome,
  getPendingForcedOutcome,
  consumeForcedOutcome,
} from '../probability-engine';
import { incrementGamesPlayed, updateLeaderboardStats, logWinner } from '../reward-engine';
import { PlinkoForceOutcome } from '../../types';
import {
  generateValidatedDrop,
  generatePath,
  validateRoute,
  type PlinkoRouteNode,
} from './path-engine';

export { generatePath, generateValidatedDrop, validateRoute };
export type { PlinkoRouteNode };

const GAME_ID = 1;
const BASE_BET = parseInt(process.env.BASE_BET || '100');
const NUM_ROWS = 12;
const NUM_SLOTS = 13;

/** Symmetrical casino layout: 0|1|2|5|10|25|50|25|10|5|2|1|0 */
export const SLOT_VALUES = [0, 1, 2, 5, 10, 25, 50, 25, 10, 5, 2, 1, 0] as const;
export type PlinkoSlotMultiplier = (typeof SLOT_VALUES)[number];

const FORCE_SLOTS: Record<PlinkoForceOutcome, number[]> = {
  LOSE: [0, 12],
  SMALL_WIN: [1, 11],
  MEDIUM_WIN: [2, 3, 9, 10],
  BIG_WIN: [4, 5, 7, 8],
  JACKPOT: [6],
};

interface PlinkoOutcome {
  multiplier: number;
  slotIndex: number;
  path: ('L' | 'R')[];
  route: PlinkoRouteNode[];
  visualSeed: number;
  baseBet: number;
}

function slotKey(index: number): string {
  return `slot_${index}`;
}

function pickSlotFromConfig(config: Record<string, number>): number {
  const weights: Record<string, number> = {};
  for (let i = 0; i < NUM_SLOTS; i++) {
    weights[slotKey(i)] = config[slotKey(i)] ?? defaultSlotProb(i);
  }
  const key = pickWeightedOutcome(weights);
  return parseInt(key.replace('slot_', ''), 10);
}

function defaultSlotProb(index: number): number {
  const defaults = [8, 9, 9, 8, 7, 6, 3, 6, 7, 8, 9, 9, 8];
  return defaults[index] ?? 7;
}

function resolveForceSlot(force: string): number {
  const slots = FORCE_SLOTS[force as PlinkoForceOutcome];
  if (!slots?.length) return pickSlotFromConfig({});
  return slots[Math.floor(Math.random() * slots.length)];
}

export function planPlinkoDrop(targetSlot: number) {
  const { path, route } = generateValidatedDrop(targetSlot);
  return { path, route, targetSlot };
}

export async function startPlinkoGame(playerId: number, playerName: string) {
  await incrementGamesPlayed();

  const forced = await getPendingForcedOutcome(GAME_ID);
  let slotIndex: number;
  let forcedOutcome: string | null = null;

  if (forced) {
    slotIndex = resolveForceSlot(forced);
    forcedOutcome = forced;
    await consumeForcedOutcome(GAME_ID, forced);
  } else {
    const config = await getProbabilities(GAME_ID);
    slotIndex = pickSlotFromConfig(config);
  }

  const multiplier = SLOT_VALUES[slotIndex];
  const { path, route } = planPlinkoDrop(slotIndex);
  const visualSeed = Math.floor(Math.random() * 2147483647);
  const reward = BASE_BET * multiplier;

  const sessionId = await insert(
    `INSERT INTO game_sessions (player_id, game_id, status, forced_outcome, predetermined_outcome, score, reward_amount)
     VALUES (?, ?, 'active', ?, ?, ?, ?)`,
    [
      playerId,
      GAME_ID,
      forcedOutcome,
      JSON.stringify({ multiplier, slotIndex, path, route, visualSeed, baseBet: BASE_BET }),
      Math.round(reward),
      reward,
    ]
  );

  return {
    sessionId,
    multiplier,
    slotIndex,
    path,
    route,
    visualSeed,
    baseBet: BASE_BET,
    reward,
    playerName,
  };
}

export async function finishPlinkoGame(sessionId: number, playerName: string) {
  const session = await queryOne<{
    id: number;
    player_id: number;
    predetermined_outcome: unknown;
    reward_amount: number;
    status: string;
  }>('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);

  if (!session || session.status !== 'active') {
    throw new Error('Invalid session');
  }

  const outcome = parseJsonField<PlinkoOutcome>(session.predetermined_outcome);
  const rewardAmount = Number(session.reward_amount);
  const rewardDesc =
    outcome.multiplier === 0
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

  return { rewardAmount, rewardDesc, multiplier: outcome.multiplier, slotIndex: outcome.slotIndex };
}

export async function getPlinkoProbabilities() {
  return getProbabilities(GAME_ID);
}

export function getDefaultSlotProbabilities(): Record<string, number> {
  const config: Record<string, number> = {};
  for (let i = 0; i < NUM_SLOTS; i++) {
    config[slotKey(i)] = defaultSlotProb(i);
  }
  return config;
}

export {
  GAME_ID as PLINKO_GAME_ID,
  SLOT_VALUES as MULTIPLIERS,
  BASE_BET,
  NUM_ROWS,
  NUM_SLOTS,
};
