import { query } from '../../database/connection';

export async function getDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  return query(
    `SELECT metric_key, metric_value FROM analytics WHERE recorded_at = ?`,
    [today]
  );
}

export async function getGameStats() {
  return query(
    `SELECT g.name, g.slug, COUNT(gs.id) as sessions,
            SUM(CASE WHEN gs.reward_amount > 0 THEN 1 ELSE 0 END) as wins,
            COALESCE(SUM(gs.reward_amount), 0) as total_payouts,
            COALESCE(AVG(gs.score), 0) as avg_score
     FROM games g
     LEFT JOIN game_sessions gs ON gs.game_id = g.id
     GROUP BY g.id, g.name, g.slug`
  );
}

export async function getHourlyActivity() {
  return query(
    `SELECT HOUR(started_at) as hour, COUNT(*) as count
     FROM game_sessions
     WHERE DATE(started_at) = CURDATE()
     GROUP BY HOUR(started_at)
     ORDER BY hour`
  );
}
