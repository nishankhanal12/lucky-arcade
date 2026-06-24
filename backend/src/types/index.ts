export interface Player {
  id: number;
  display_name: string;
  created_at: string;
}

export interface Game {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  is_active: boolean;
}

export interface GameSession {
  id: number;
  player_id: number;
  game_id: number;
  status: 'active' | 'completed' | 'abandoned';
  forced_outcome: string | null;
  predetermined_outcome: unknown;
  board_data: unknown;
  result: unknown;
  score: number;
  reward_amount: number;
  reward_description: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface WinnerLog {
  id: number;
  player_id: number;
  game_id: number;
  session_id: number | null;
  player_name: string;
  game_name: string;
  reward_description: string;
  reward_amount: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: number;
  player_id: number;
  game_id: number | null;
  player_name: string;
  total_wins: number;
  total_score: number;
  total_games: number;
  total_winnings: number;
}

export interface Reward {
  id: number;
  game_id: number;
  milestone: string;
  reward_type: 'coupon' | 'rupees' | 'jackpot';
  reward_value: number;
  description: string;
}

export type PlinkoMultiplier = 0 | 1 | 2 | 5 | 10 | 25 | 50;
export type PlinkoForceOutcome = 'LOSE' | 'SMALL_WIN' | 'MEDIUM_WIN' | 'BIG_WIN' | 'JACKPOT';
export type MangoOutcome = 'LOSE_BEFORE_5' | 'REACH_5' | 'REACH_7' | 'REACH_10';
export type TapRushOutcome = 'FAIL' | 'REACH_10' | 'REACH_20' | 'REACH_30' | 'REACH_40';

export type MangoCell = 'mango' | 'bomb' | 'hidden';
export type MangoBoard = MangoCell[][];

export interface LiveSession {
  sessionId: number;
  playerName: string;
  gameSlug: string;
  gameName: string;
  progress: string;
  outcome: string;
  startedAt: string;
  duration: number;
}

export interface AnalyticsOverview {
  totalGamesPlayed: number;
  totalWinners: number;
  totalPayouts: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  activePlayers: number;
  currentJackpot: number;
  gamesPlayedToday: number;
}
