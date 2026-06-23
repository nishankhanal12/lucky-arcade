import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { gameApi } from '../services/api';
import { getSocket } from '../services/socket';
import { usePlayer } from '../context/PlayerContext';
import { HomeData, WinnerLog, LeaderboardEntry } from '../types';
import NameModal from '../components/ui/NameModal';

const gameRoutes: Record<string, string> = {
  plinko: '/plinko',
  'mango-quest': '/mango-quest',
  'green-tap-rush': '/green-tap-rush',
};

const gameEmojis: Record<string, string> = {
  plinko: '🎯',
  'mango-quest': '🥭',
  'green-tap-rush': '⚡',
};

const gameGradients: Record<string, string> = {
  plinko: 'from-blue-600 to-purple-700',
  'mango-quest': 'from-green-600 to-emerald-800',
  'green-tap-rush': 'from-cyan-500 to-green-600',
};

export default function Home() {
  const { player, setPlayerName } = usePlayer();
  const [data, setData] = useState<HomeData | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [winners, setWinners] = useState<WinnerLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    gameApi.getHome().then(setData).catch(console.error);
    const socket = getSocket();
    socket.on('winners_feed', setWinners);
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('jackpot_won', () => gameApi.getHome().then(setData));
    return () => {
      socket.off('winners_feed');
      socket.off('leaderboard_updated');
      socket.off('jackpot_won');
    };
  }, []);

  const handlePlay = (slug: string) => {
    const route = gameRoutes[slug];
    if (!player) {
      setPendingRoute(route);
      setShowNameModal(true);
    } else {
      window.location.href = route;
    }
  };

  const handleNameSubmit = async (name: string) => {
    await setPlayerName(name);
    setShowNameModal(false);
    if (pendingRoute) {
      window.location.href = pendingRoute;
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-4xl animate-spin">🎰</div>
      </div>
    );
  }

  const displayWinners = winners.length > 0 ? winners.slice(0, 5) : data.recentWinners;
  const displayLeaderboard = leaderboard.length > 0 ? leaderboard.slice(0, 5) : data.leaderboard;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <h2 className="font-display text-6xl text-arcade-gold gold-text">{data.eventTitle}</h2>
        <p className="font-arcade text-gray-400 text-lg">College LAN Gaming Event</p>
      </motion.section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div whileHover={{ scale: 1.02 }} className="arcade-card text-center">
          <div className="text-4xl mb-2">💰</div>
          <div className="font-arcade text-sm text-gray-400">Current Jackpot</div>
          <div className="font-display text-4xl text-arcade-gold gold-text">
            ₹{data.currentJackpot.toLocaleString()}
          </div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="arcade-card text-center">
          <div className="text-4xl mb-2">🎮</div>
          <div className="font-arcade text-sm text-gray-400">Games Played Today</div>
          <div className="font-display text-4xl text-white">{data.gamesPlayedToday}</div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="arcade-card text-center">
          <div className="text-4xl mb-2">👤</div>
          <div className="font-arcade text-sm text-gray-400">Playing As</div>
          <div className="font-display text-2xl text-arcade-pink">
            {player?.displayName || 'Guest — tap a game to join'}
          </div>
        </motion.div>
      </div>

      <section>
        <h3 className="font-display text-3xl text-white mb-6">🕹️ Choose Your Game</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.03, y: -5 }}
              className={`arcade-card bg-gradient-to-br ${gameGradients[game.slug] || 'from-purple-600 to-pink-600'} border-0 overflow-hidden`}
            >
              <div className="text-7xl text-center py-6">{gameEmojis[game.slug] || '🎮'}</div>
              <h4 className="font-display text-2xl text-center">{game.name}</h4>
              <p className="text-center text-white/80 text-sm mt-2 mb-6 px-4">{game.description}</p>
              <button
                onClick={() => handlePlay(game.slug)}
                className="w-full arcade-btn-gold text-lg"
              >
                Play Now
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="arcade-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-2xl">🏆 Recent Winners</h3>
            <Link to="/winners" className="text-arcade-pink text-sm font-arcade hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {displayWinners.map(w => (
              <motion.div
                key={w.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex justify-between items-center bg-white/5 rounded-lg px-4 py-3"
              >
                <div>
                  <div className="font-arcade text-sm text-arcade-gold">{w.player_name}</div>
                  <div className="text-xs text-gray-400">{w.game_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-arcade text-sm">{w.reward_description}</div>
                  {w.reward_amount > 0 && (
                    <div className="text-arcade-gold text-xs">₹{w.reward_amount}</div>
                  )}
                </div>
              </motion.div>
            ))}
            {displayWinners.length === 0 && (
              <p className="text-gray-500 text-center py-4">No winners yet — be the first!</p>
            )}
          </div>
        </section>

        <section className="arcade-card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-2xl">📊 Leaderboard</h3>
            <Link to="/leaderboard" className="text-arcade-pink text-sm font-arcade hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {displayLeaderboard.map((entry, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 rounded-lg px-4 py-3">
                <span className="font-display text-2xl text-arcade-gold w-8">#{i + 1}</span>
                <div className="flex-1">
                  <div className="font-arcade text-sm">{entry.player_name}</div>
                  <div className="text-xs text-gray-400">{entry.total_games} games</div>
                </div>
                <div className="font-arcade text-arcade-gold">₹{Number(entry.total_winnings).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showNameModal && (
        <NameModal onSubmit={handleNameSubmit} onClose={() => setShowNameModal(false)} />
      )}
    </div>
  );
}
