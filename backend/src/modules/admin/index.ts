import bcrypt from 'bcryptjs';
import { query, queryOne } from '../../database/connection';
import { AnalyticsOverview } from '../../types';

export async function adminLogin(username: string, password: string): Promise<boolean> {
  const admin = await queryOne<{ password: string }>(
    'SELECT password FROM admins WHERE username = ?',
    [username]
  );
  if (!admin) return false;
  return bcrypt.compare(password, admin.password);
}

export async function getOverview(): Promise<AnalyticsOverview> {
  const today = new Date().toISOString().split('T')[0];

  const gamesPlayed = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(metric_value), 0) as total FROM analytics
     WHERE metric_key = 'games_played' AND recorded_at = ?`,
    [today]
  );

  const totalGames = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM game_sessions`
  );

  const winners = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(metric_value), 0) as total FROM analytics
     WHERE metric_key = 'total_winners' AND recorded_at = ?`,
    [today]
  );

  const totalWinners = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM winner_logs`
  );

  const payouts = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(reward_amount), 0) as total FROM winner_logs`
  );

  const activePlayers = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM game_sessions WHERE status = 'active'`
  );

  const jackpot = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'current_jackpot'`
  );

  const ticketPrice = await queryOne<{ setting_value: string }>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'ticket_price'`
  );

  const gamesPlayedTotal = Number(totalGames?.total || 0);
  const ticket = Number(ticketPrice?.setting_value || 50);
  const revenue = gamesPlayedTotal * ticket;
  const totalPayouts = Number(payouts?.total || 0);

  return {
    totalGamesPlayed: gamesPlayedTotal,
    totalWinners: Number(totalWinners?.total || 0),
    totalPayouts,
    estimatedRevenue: revenue,
    estimatedProfit: revenue - totalPayouts,
    activePlayers: Number(activePlayers?.total || 0),
    currentJackpot: Number(jackpot?.setting_value || 50000),
    gamesPlayedToday: Number(gamesPlayed?.total || 0),
  };
}

export async function getSystemSettings(): Promise<Record<string, string>> {
  const rows = await query<{ setting_key: string; setting_value: string }[]>(
    'SELECT setting_key, setting_value FROM system_settings'
  );
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.setting_key] = row.setting_value;
  return settings;
}

export async function updateSystemSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value]
  );
}

export async function getLiveSessions() {
  return query(
    `SELECT gs.id as sessionId, p.display_name as playerName, g.slug as gameSlug,
            g.name as gameName, gs.score as progress, gs.forced_outcome as outcome,
            gs.started_at as startedAt,
            TIMESTAMPDIFF(SECOND, gs.started_at, NOW()) as duration
     FROM game_sessions gs
     JOIN players p ON p.id = gs.player_id
     JOIN games g ON g.id = gs.game_id
     WHERE gs.status = 'active'
     ORDER BY gs.started_at DESC`
  );
}
