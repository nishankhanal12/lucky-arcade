import axios, { AxiosResponse } from 'axios';
import {
  HomeData,
  PlinkoStartResult,
  MangoStartResult,
  TapRushStartResult,
  WinnerLog,
  LeaderboardEntry,
  AnalyticsOverview,
  Reward,
  LiveSession,
  Game,
  Player,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

interface ApiBody<T = unknown> {
  success?: boolean;
  data?: T;
  message?: string;
}

/** Unwrap standardized `{ success, data }` responses; pass through legacy shapes. */
export function unwrap<T>(response: AxiosResponse): T {
  const body = response.data as ApiBody<T> | T;
  if (body && typeof body === 'object' && 'success' in body && (body as ApiBody<T>).success === true) {
    return (body as ApiBody<T>).data as T;
  }
  return body as T;
}

export function setAdminToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['x-admin-token'] = token;
  } else {
    delete api.defaults.headers.common['x-admin-token'];
  }
}

const get = <T>(url: string, params?: object) => api.get(url, { params }).then(r => unwrap<T>(r));
const post = <T>(url: string, data?: object) => api.post(url, data).then(r => unwrap<T>(r));
const put = <T>(url: string, data?: object) => api.put(url, data).then(r => unwrap<T>(r));
const del = <T>(url: string) => api.delete(url).then(r => unwrap<T>(r));

export const gameApi = {
  getHome: () => get<HomeData>('/home'),
  joinPlayer: (displayName: string) => post<Player>('/player/join', { displayName }),
  getGames: () => get<Game[]>('/games'),
  getLeaderboard: (type = 'winnings') => get<LeaderboardEntry[]>(`/leaderboard?type=${type}`),
  getWinners: (limit = 50) => get<WinnerLog[]>(`/winners?limit=${limit}`),

  plinkoStart: (playerId: number, playerName: string) =>
    post<PlinkoStartResult>('/plinko/start', { playerId, playerName }),
  plinkoFinish: (sessionId: number, playerName: string) =>
    post<{ rewardAmount: number; rewardDesc: string; multiplier: number }>('/plinko/finish', { sessionId, playerName }),

  mangoStart: (playerId: number, playerName: string) =>
    post<MangoStartResult>('/mango/start', { playerId, playerName }),
  mangoReveal: (sessionId: number, row: number, col: number, playerName: string) =>
    post<{
      cell: string;
      gameOver: boolean;
      row: number;
      reward: Reward | null;
      rewardAmount: number;
      rewardDesc: string;
      currentRow?: number;
    }>('/mango/reveal', { sessionId, row, col, playerName }),

  tapRushStart: (playerId: number, playerName: string) =>
    post<TapRushStartResult>('/tap-rush/start', { playerId, playerName }),
  tapRushTap: (sessionId: number, taps: number, playerName: string) =>
    post<{ taps: number; targetTaps: number }>('/tap-rush/tap', { sessionId, taps, playerName }),
  tapRushFinish: (sessionId: number, taps: number, playerName: string) =>
    post<{ taps: number; rewardDesc: string; rewardAmount: number }>('/tap-rush/finish', { sessionId, taps, playerName }),
};

export const adminApi = {
  login: (username: string, password: string) =>
    post<{ token: string; username: string }>('/admin/login', { username, password }),
  getOverview: () => get<AnalyticsOverview>('/admin/overview'),
  getSettings: () => get<Record<string, string>>('/admin/settings'),
  updateSetting: (key: string, value: string) =>
    put<{ key: string; value: string }>('/admin/settings', { key, value }),
  getProbabilities: (gameId: number) =>
    get<Record<string, number>>(`/admin/probabilities/${gameId}`),
  updateProbabilities: (gameId: number, config: Record<string, number>) =>
    put<{ config: Record<string, number> }>(`/admin/probabilities/${gameId}`, { config }),
  setPlinkoRtp: (rtp: number) =>
    post<{ config: Record<string, number>; rtp: number }>('/admin/plinko/rtp', { rtp }),
  forceOutcome: (gameId: number, outcome: string) =>
    post<{ gameId: number; outcome: string }>('/admin/force-outcome', { gameId, outcome }),
  getRewards: (gameId?: number) =>
    get<Reward[]>('/admin/rewards', gameId ? { gameId } : undefined),
  createReward: (data: object) => post<Reward>('/admin/rewards', data),
  updateReward: (id: number, data: object) => put<{ id: number }>(`/admin/rewards/${id}`, data),
  deleteReward: (id: number) => del<Record<string, never>>(`/admin/rewards/${id}`),
  getWinners: () => get<WinnerLog[]>('/admin/winners'),
  getLeaderboard: (type = 'winnings') => get<LeaderboardEntry[]>(`/admin/leaderboard?type=${type}`),
  getLiveSessions: () => get<LiveSession[]>('/admin/live-sessions'),
  getGameStats: () => get<Array<{ name: string; slug: string; sessions: number; wins: number; total_payouts: number; avg_score: number }>>('/admin/analytics/games'),
  getHourlyActivity: () => get<Array<{ hour: number; count: number }>>('/admin/analytics/hourly'),
  generateBoard: (difficulty: string) =>
    post<{ board: string[][] }>('/admin/boards/generate', { difficulty }),
  saveBoard: (name: string, board: string[][], difficulty: string) =>
    post<{ id: number; name: string }>('/admin/boards', { name, board, difficulty }),
  getBoards: () => get<Array<{ id: number; name: string; difficulty: string; created_at: string }>>('/admin/boards'),
};

export default api;
