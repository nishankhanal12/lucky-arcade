import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

export function setAdminToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['x-admin-token'] = token;
  } else {
    delete api.defaults.headers.common['x-admin-token'];
  }
}

export const gameApi = {
  getHome: () => api.get('/home').then(r => r.data),
  joinPlayer: (displayName: string) => api.post('/player/join', { displayName }).then(r => r.data),
  getGames: () => api.get('/games').then(r => r.data),
  getLeaderboard: (type = 'winnings') => api.get(`/leaderboard?type=${type}`).then(r => r.data),
  getWinners: (limit = 50) => api.get(`/winners?limit=${limit}`).then(r => r.data),

  plinkoStart: (playerId: number, playerName: string) =>
    api.post('/plinko/start', { playerId, playerName }).then(r => r.data),
  plinkoFinish: (sessionId: number, playerName: string) =>
    api.post('/plinko/finish', { sessionId, playerName }).then(r => r.data),

  mangoStart: (playerId: number, playerName: string) =>
    api.post('/mango/start', { playerId, playerName }).then(r => r.data),
  mangoReveal: (sessionId: number, row: number, col: number, playerName: string) =>
    api.post('/mango/reveal', { sessionId, row, col, playerName }).then(r => r.data),

  tapRushStart: (playerId: number, playerName: string) =>
    api.post('/tap-rush/start', { playerId, playerName }).then(r => r.data),
  tapRushTap: (sessionId: number, taps: number, playerName: string) =>
    api.post('/tap-rush/tap', { sessionId, taps, playerName }).then(r => r.data),
  tapRushFinish: (sessionId: number, taps: number, playerName: string) =>
    api.post('/tap-rush/finish', { sessionId, taps, playerName }).then(r => r.data),
};

export const adminApi = {
  login: (username: string, password: string) =>
    api.post('/admin/login', { username, password }).then(r => r.data),
  getOverview: () => api.get('/admin/overview').then(r => r.data),
  getSettings: () => api.get('/admin/settings').then(r => r.data),
  updateSetting: (key: string, value: string) =>
    api.put('/admin/settings', { key, value }).then(r => r.data),
  getProbabilities: (gameId: number) =>
    api.get(`/admin/probabilities/${gameId}`).then(r => r.data),
  updateProbabilities: (gameId: number, config: Record<string, number>) =>
    api.put(`/admin/probabilities/${gameId}`, { config }).then(r => r.data),
  setPlinkoRtp: (rtp: number) =>
    api.post('/admin/plinko/rtp', { rtp }).then(r => r.data),
  forceOutcome: (gameId: number, outcome: string) =>
    api.post('/admin/force-outcome', { gameId, outcome }).then(r => r.data),
  getRewards: (gameId?: number) =>
    api.get('/admin/rewards', { params: gameId ? { gameId } : {} }).then(r => r.data),
  createReward: (data: object) => api.post('/admin/rewards', data).then(r => r.data),
  updateReward: (id: number, data: object) => api.put(`/admin/rewards/${id}`, data).then(r => r.data),
  deleteReward: (id: number) => api.delete(`/admin/rewards/${id}`).then(r => r.data),
  getWinners: () => api.get('/admin/winners').then(r => r.data),
  getLeaderboard: (type = 'winnings') => api.get(`/admin/leaderboard?type=${type}`).then(r => r.data),
  getLiveSessions: () => api.get('/admin/live-sessions').then(r => r.data),
  getGameStats: () => api.get('/admin/analytics/games').then(r => r.data),
  getHourlyActivity: () => api.get('/admin/analytics/hourly').then(r => r.data),
  generateBoard: (difficulty: string) =>
    api.post('/admin/boards/generate', { difficulty }).then(r => r.data),
  saveBoard: (name: string, board: string[][], difficulty: string) =>
    api.post('/admin/boards', { name, board, difficulty }).then(r => r.data),
  getBoards: () => api.get('/admin/boards').then(r => r.data),
};

export default api;
