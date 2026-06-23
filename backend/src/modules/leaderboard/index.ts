import { query } from '../../database/connection';
import { WinnerLog, LeaderboardEntry } from '../../types';

function safeLimit(limit: number): number {
  return Math.max(1, Math.min(500, Math.floor(limit)));
}

export async function getRecentWinners(limit = 20): Promise<WinnerLog[]> {
  const n = safeLimit(limit);
  return query<WinnerLog[]>(
    `SELECT * FROM winner_logs ORDER BY created_at DESC LIMIT ${n}`
  );
}

export async function getLeaderboard(type: 'winnings' | 'score' | 'games' = 'winnings', limit = 20): Promise<LeaderboardEntry[]> {
  const orderCol = type === 'score' ? 'total_score' : type === 'games' ? 'total_games' : 'total_winnings';
  const n = safeLimit(limit);
  return query<LeaderboardEntry[]>(
    `SELECT * FROM leaderboard ORDER BY ${orderCol} DESC LIMIT ${n}`
  );
}

export async function getTopWinners(limit = 10): Promise<LeaderboardEntry[]> {
  const n = safeLimit(limit);
  return query<LeaderboardEntry[]>(
    `SELECT player_name, SUM(total_wins) as total_wins, SUM(total_winnings) as total_winnings,
            SUM(total_games) as total_games, SUM(total_score) as total_score,
            player_id, MIN(id) as id, MIN(game_id) as game_id
     FROM leaderboard
     GROUP BY player_id, player_name
     ORDER BY total_winnings DESC
     LIMIT ${n}`
  );
}
