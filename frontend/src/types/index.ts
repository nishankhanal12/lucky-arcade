export interface Player {
  playerId: number;
  displayName: string;
}

export interface Game {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_url: string;
}

export interface WinnerLog {
  id: number;
  player_name: string;
  game_name: string;
  reward_description: string;
  reward_amount: number;
  created_at: string;
}

export interface LeaderboardEntry {
  player_name: string;
  total_wins: number;
  total_score: number;
  total_games: number;
  total_winnings: number;
}

export interface HomeData {
  eventTitle: string;
  currentJackpot: number;
  gamesPlayedToday: number;
  recentWinners: WinnerLog[];
  leaderboard: LeaderboardEntry[];
  games: Game[];
}

export interface PlinkoRouteNode {
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface PlinkoStartResult {
  sessionId: number;
  multiplier: number;
  slotIndex: number;
  path: ('L' | 'R')[];
  route: PlinkoRouteNode[];
  visualSeed: number;
  baseBet: number;
  reward: number;
}

export interface MangoStartResult {
  sessionId: number;
  board: string[][];
  rows: number;
  cols: number;
}

export interface TapRushStartResult {
  sessionId: number;
  targetTaps: number;
  minVisibility: number;
  maxVisibility: number;
  spawnInterval: number;
  gameDuration: number;
  gridSize: number;
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

export interface Reward {
  id: number;
  game_id: number;
  milestone: string;
  reward_type: string;
  reward_value: number;
  description: string;
}

export interface LiveSession {
  sessionId: number;
  playerName: string;
  gameSlug: string;
  gameName: string;
  progress: number;
  outcome: string;
  startedAt: string;
  duration: number;
}
