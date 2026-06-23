import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gameApi } from '../services/api';
import { getSocket } from '../services/socket';
import { WinnerLog } from '../types';

export default function WinnersFeed() {
  const [winners, setWinners] = useState<WinnerLog[]>([]);

  useEffect(() => {
    gameApi.getWinners(50).then(setWinners);
    const socket = getSocket();
    socket.on('winners_feed', setWinners);
    socket.on('winner_announced', () => gameApi.getWinners(50).then(setWinners));
    socket.on('jackpot_won', () => gameApi.getWinners(50).then(setWinners));
    return () => {
      socket.off('winners_feed');
      socket.off('winner_announced');
      socket.off('jackpot_won');
    };
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h2 className="font-display text-5xl text-center text-arcade-pink neon-text mb-2">🎉 Winners Feed</h2>
      <p className="text-center text-gray-400 font-arcade text-sm mb-8">Live updates from the arcade floor</p>

      <div className="space-y-3">
        <AnimatePresence>
          {winners.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`arcade-card flex items-center gap-4 ${
                w.reward_amount >= 5000 ? 'border-arcade-gold bg-arcade-gold/10 animate-pulse-glow' : ''
              }`}
            >
              <div className="text-3xl">
                {w.reward_amount >= 5000 ? '🏆' : w.reward_amount > 0 ? '🎊' : '🎟️'}
              </div>
              <div className="flex-1">
                <div className="font-arcade text-arcade-gold">{w.player_name}</div>
                <div className="text-sm text-gray-400">{w.game_name}</div>
              </div>
              <div className="text-right">
                <div className="font-arcade text-sm">{w.reward_description}</div>
                {w.reward_amount > 0 && (
                  <div className="text-arcade-gold font-display text-lg">₹{w.reward_amount}</div>
                )}
                <div className="text-xs text-gray-500">{formatTime(w.created_at)}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {winners.length === 0 && (
          <p className="text-center text-gray-500 py-12 font-arcade">Waiting for winners...</p>
        )}
      </div>
    </div>
  );
}
