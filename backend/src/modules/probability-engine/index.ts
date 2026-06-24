import { query, queryOne } from '../../database/connection';
import { getDefaultSlotProbabilities } from '../plinko';

const PLINKO_GAME_ID = 1;
const NUM_SLOTS = 13;
const PLINKO_SLOT_VALUES = [0, 1, 2, 5, 10, 25, 50, 25, 10, 5, 2, 1, 0];

export async function getProbabilities(gameId: number): Promise<Record<string, number>> {
  const rows = await query<{ config_key: string; config_value: number }[]>(
    'SELECT config_key, config_value FROM probability_configs WHERE game_id = ?',
    [gameId]
  );
  const config: Record<string, number> = {};
  for (const row of rows) {
    config[row.config_key] = Number(row.config_value);
  }
  return config;
}

export async function updateProbabilities(
  gameId: number,
  config: Record<string, number>
): Promise<void> {
  for (const [key, value] of Object.entries(config)) {
    await query(
      `INSERT INTO probability_configs (game_id, config_key, config_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [gameId, key, value]
    );
  }
}

export function pickWeightedOutcome<T extends string>(
  weights: Record<T, number>
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * total;
  for (const [outcome, weight] of entries) {
    random -= weight;
    if (random <= 0) return outcome;
  }
  return entries[entries.length - 1][0];
}

export async function adjustPlinkoRTP(gameId: number, targetRtp: number): Promise<Record<string, number>> {
  let config = await getProbabilities(gameId);

  const hasSlotKeys = Object.keys(config).some(k => k.startsWith('slot_'));
  if (!hasSlotKeys) {
    config = getDefaultSlotProbabilities();
  }

  let currentRtp = 0;
  for (let i = 0; i < NUM_SLOTS; i++) {
    const key = `slot_${i}`;
    const prob = config[key] ?? 0;
    currentRtp += (PLINKO_SLOT_VALUES[i] * prob) / 100;
  }

  const rtpRatio = targetRtp / Math.max(currentRtp, 0.01);
  const newConfig: Record<string, number> = {};

  for (let i = 0; i < NUM_SLOTS; i++) {
    const key = `slot_${i}`;
    const val = PLINKO_SLOT_VALUES[i];
    if (val === 0) {
      newConfig[key] = config[key] ?? 0;
    } else {
      newConfig[key] = (config[key] ?? 0) * rtpRatio;
    }
  }

  const newTotal = Object.values(newConfig).reduce((s, v) => s + v, 0);
  for (let i = 0; i < NUM_SLOTS; i++) {
    const key = `slot_${i}`;
    newConfig[key] = Math.round((newConfig[key] / newTotal) * 10000) / 100;
  }

  const adjustedTotal = Object.values(newConfig).reduce((s, v) => s + v, 0);
  const diff = 100 - adjustedTotal;
  if (diff !== 0) {
    newConfig['slot_6'] = (newConfig['slot_6'] || 0) + diff;
  }

  await updateProbabilities(PLINKO_GAME_ID, newConfig);
  await query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES ('plinko_rtp', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [String(targetRtp)]
  );

  return newConfig;
}

export function validateProbabilitiesSum(config: Record<string, number>, keys: string[]): boolean {
  const sum = keys.reduce((s, k) => s + (config[k] || 0), 0);
  return Math.abs(sum - 100) < 0.01;
}

export async function getPendingForcedOutcome(gameId: number): Promise<string | null> {
  const row = await queryOne<{ outcome: string }>(
    'SELECT outcome FROM forced_outcomes WHERE game_id = ? AND is_used = FALSE ORDER BY id ASC LIMIT 1',
    [gameId]
  );
  return row?.outcome ?? null;
}

export async function consumeForcedOutcome(gameId: number, outcome: string): Promise<void> {
  await query(
    'UPDATE forced_outcomes SET is_used = TRUE WHERE game_id = ? AND outcome = ? AND is_used = FALSE LIMIT 1',
    [gameId, outcome]
  );
}

export async function queueForcedOutcome(gameId: number, outcome: string): Promise<void> {
  await query('INSERT INTO forced_outcomes (game_id, outcome) VALUES (?, ?)', [gameId, outcome]);
}
