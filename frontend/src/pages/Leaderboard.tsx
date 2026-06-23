import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gameApi } from '../services/api';
import { getSocket } from '../services/socket';
import { LeaderboardEntry } from '../types';

type Tab = 'winnings' | 'score' | 'games';

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('winnings');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    gameApi.getLeaderboard(tab).then(setEntries);
    const socket = getSocket();
    socket.on('leaderboard_updated', setEntries);
    return () => { socket.off('leaderboard_updated'); };
  }, [tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'winnings', label: 'Top Winners' },
    { key: 'score', label: 'Top Scores' },
    { key: 'games', label: 'Most Games' },
  ];

  const getValue = (entry: LeaderboardEntry) => {
    if (tab === 'score') return entry.total_score;
    if (tab === 'games') return entry.total_games;
    return `₹${Number(entry.total_winnings).toLocaleString()}`;
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h2 className="font-display text-5xl text-center text-arcade-gold gold-text mb-8">🏆 Leaderboard</h2>

      <div className="flex justify-center gap-2 mb-8">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg font-arcade text-sm transition-all ${
              tab === t.key ? 'bg-arcade-purple text-white' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`arcade-card flex items-center gap-4 ${
              i < 3 ? 'border-arcade-gold/50 bg-arcade-gold/5' : ''
            }`}
          >
            <span className="text-3xl w-12 text-center">{medals[i] || `#${i + 1}`}</span>
            <div className="flex-1">
              <div className="font-arcade text-lg">{entry.player_name}</div>
              <div className="text-xs text-gray-400">
                {entry.total_wins} wins · {entry.total_games} games
              </div>
            </div>
            <div className="font-display text-2xl text-arcade-gold">{getValue(entry)}</div>
          </motion.div>
        ))}
        {entries.length === 0 && (
          <p className="text-center text-gray-500 py-12 font-arcade">No entries yet — start playing!</p>
        )}
      </div>
    </div>
  );
}
