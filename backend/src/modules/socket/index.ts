import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { getRecentWinners, getLeaderboard } from '../leaderboard';
import { getLiveSessions } from '../admin';

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join_lobby', async () => {
      const winners = await getRecentWinners(10);
      const leaderboard = await getLeaderboard('winnings', 10);
      socket.emit('winners_feed', winners);
      socket.emit('leaderboard_updated', leaderboard);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export async function emitPlayerJoined(playerName: string) {
  getIO().emit('player_joined', { playerName, time: new Date().toISOString() });
}

export function emitGameStarted(data: {
  sessionId: number;
  playerName: string;
  gameSlug: string;
  gameName: string;
}) {
  getIO().emit('game_started', { ...data, time: new Date().toISOString() });
}

export async function emitGameFinished(data: {
  sessionId: number;
  playerName: string;
  gameSlug: string;
  result: unknown;
}) {
  getIO().emit('game_finished', { ...data, time: new Date().toISOString() });
  const sessions = await getLiveSessions();
  getIO().emit('live_sessions', sessions);
}

export async function emitWinnerAnnounced(winner: {
  playerName: string;
  game: string;
  reward: string;
  amount: number;
}) {
  getIO().emit('winner_announced', { ...winner, time: new Date().toISOString() });
  const winners = await getRecentWinners(20);
  getIO().emit('winners_feed', winners);
  const leaderboard = await getLeaderboard('winnings', 20);
  getIO().emit('leaderboard_updated', leaderboard);
}

export function emitJackpotWon(data: { playerName: string; amount: number; game: string }) {
  getIO().emit('jackpot_won', { ...data, time: new Date().toISOString() });
}

export function emitAdminChangedProbability(data: { gameId: number; config: Record<string, number> }) {
  getIO().emit('admin_changed_probability', data);
}

export function emitAdminForcedOutcome(data: { gameId: number; outcome: string }) {
  getIO().emit('admin_forced_outcome', data);
}

export async function emitLiveSessions() {
  const sessions = await getLiveSessions();
  getIO().emit('live_sessions', sessions);
}
