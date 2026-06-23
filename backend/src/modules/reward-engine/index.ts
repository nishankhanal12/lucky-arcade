import { insert, query, queryOne } from '../../database/connection';
import { Reward } from '../../types';

export async function getRewards(gameId?: number): Promise<Reward[]> {
  if (gameId) {
    return query<Reward[]>('SELECT * FROM rewards WHERE game_id = ? ORDER BY id', [gameId]);
  }
  return query<Reward[]>('SELECT * FROM rewards ORDER BY game_id, id');
}

export async function getRewardByMilestone(gameId: number, milestone: string): Promise<Reward | null> {
  return queryOne<Reward>('SELECT * FROM rewards WHERE game_id = ? AND milestone = ?', [gameId, milestone]);
}

export async function createReward(data: {
  game_id: number;
  milestone: string;
  reward_type: string;
  reward_value: number;
  description: string;
}): Promise<number> {
  return insert(
    'INSERT INTO rewards (game_id, milestone, reward_type, reward_value, description) VALUES (?, ?, ?, ?, ?)',
    [data.game_id, data.milestone, data.reward_type, data.reward_value, data.description]
  );
}

export async function updateReward(id: number, data: Partial<Reward>): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  if (data.milestone !== undefined) { fields.push('milestone = ?'); values.push(data.milestone); }
  if (data.reward_type !== undefined) { fields.push('reward_type = ?'); values.push(data.reward_type); }
  if (data.reward_value !== undefined) { fields.push('reward_value = ?'); values.push(data.reward_value); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (fields.length === 0) return;
  values.push(id);
  await query(`UPDATE rewards SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteReward(id: number): Promise<void> {
  await query('DELETE FROM rewards WHERE id = ?', [id]);
}

export async function logWinner(data: {
  player_id: number;
  game_id: number;
  session_id: number;
  player_name: string;
  game_name: string;
  reward_description: string;
  reward_amount: number;
}): Promise<void> {
  await query(
    `INSERT INTO winner_logs (player_id, game_id, session_id, player_name, game_name, reward_description, reward_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.player_id, data.game_id, data.session_id, data.player_name, data.game_name, data.reward_description, data.reward_amount]
  );

  await query(
    `INSERT INTO leaderboard (player_id, game_id, player_name, total_wins, total_score, total_games, total_winnings)
     VALUES (?, ?, ?, 1, 0, 0, ?)
     ON DUPLICATE KEY UPDATE
       total_wins = total_wins + 1,
       total_winnings = total_winnings + VALUES(total_winnings),
       player_name = VALUES(player_name)`,
    [data.player_id, data.game_id, data.player_name, data.reward_amount]
  );

  const today = new Date().toISOString().split('T')[0];
  await query(
    `INSERT INTO analytics (metric_key, metric_value, recorded_at) VALUES ('total_payouts', ?, ?)
     ON DUPLICATE KEY UPDATE metric_value = metric_value + VALUES(metric_value)`,
    [data.reward_amount, today]
  );
  await query(
    `INSERT INTO analytics (metric_key, metric_value, recorded_at) VALUES ('total_winners', 1, ?)
     ON DUPLICATE KEY UPDATE metric_value = metric_value + 1`,
    [today]
  );
}

export async function updateLeaderboardStats(
  playerId: number,
  gameId: number,
  playerName: string,
  score: number,
  winnings: number
): Promise<void> {
  await query(
    `INSERT INTO leaderboard (player_id, game_id, player_name, total_wins, total_score, total_games, total_winnings)
     VALUES (?, ?, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       total_score = total_score + VALUES(total_score),
       total_games = total_games + 1,
       total_winnings = total_winnings + VALUES(total_winnings),
       total_wins = total_wins + IF(VALUES(total_winnings) > 0, 1, 0),
       player_name = VALUES(player_name)`,
    [playerId, gameId, playerName, winnings > 0 ? 1 : 0, score, winnings]
  );
}

export async function incrementGamesPlayed(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await query(
    `INSERT INTO analytics (metric_key, metric_value, recorded_at) VALUES ('games_played', 1, ?)
     ON DUPLICATE KEY UPDATE metric_value = metric_value + 1`,
    [today]
  );
}
