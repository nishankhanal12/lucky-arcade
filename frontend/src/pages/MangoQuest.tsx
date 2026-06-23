import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import { gameApi } from '../services/api';
import NameModal from '../components/ui/NameModal';

const MILESTONES = [
  { row: 5, label: 'Row 5', reward: 'Coupon', emoji: '🎟️' },
  { row: 7, label: 'Row 7', reward: '₹1000', emoji: '💵' },
  { row: 10, label: 'Row 10', reward: '₹2000 Jackpot', emoji: '🏆' },
];

type CellState = 'hidden' | 'mango' | 'bomb' | 'revealed-mango' | 'revealed-bomb';

export default function MangoQuest() {
  const { player, setPlayerName } = usePlayer();
  const [showName, setShowName] = useState(!player);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [board, setBoard] = useState<CellState[][]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [exploding, setExploding] = useState<{ row: number; col: number } | null>(null);
  const [lastReward, setLastReward] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const startGame = useCallback(async () => {
    if (!player) return;
    const data = await gameApi.mangoStart(player.playerId, player.displayName);
    setSessionId(data.sessionId);
    setBoard(data.board.map((row: string[]) => row.map(() => 'hidden' as CellState)));
    setCurrentRow(0);
    setGameOver(false);
    setLastReward(null);
    setStarted(true);
  }, [player]);

  const handleCellClick = async (row: number, col: number) => {
    if (!sessionId || !player || gameOver || row !== currentRow) return;
    if (board[row][col] !== 'hidden') return;

    const result = await gameApi.mangoReveal(sessionId, row, col, player.displayName);

    if (result.cell === 'bomb') {
      setExploding({ row, col });
      setBoard(prev => {
        const next = prev.map(r => [...r]);
        next[row][col] = 'revealed-bomb';
        return next;
      });
      setTimeout(() => {
        setExploding(null);
        setGameOver(true);
      }, 800);
    } else {
      setBoard(prev => {
        const next = prev.map(r => [...r]);
        next[row][col] = 'revealed-mango';
        return next;
      });
      if (result.rewardDesc) setLastReward(result.rewardDesc);
      if (result.gameOver) {
        setGameOver(true);
      } else {
        setCurrentRow(result.currentRow || row + 1);
      }
    }
  };

  if (showName) {
    return (
      <NameModal
        onSubmit={async (name) => { await setPlayerName(name); setShowName(false); }}
        onClose={() => window.location.href = '/'}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h2 className="font-display text-5xl text-green-400" style={{ textShadow: '0 0 20px rgba(34,197,94,0.5)' }}>
          🥭 Mango Quest
        </h2>
        <p className="font-arcade text-green-300/60 mt-2">Find the mango, avoid the bombs!</p>
      </div>

      {/* Progress & milestones */}
      <div className="flex justify-center gap-4 mb-6">
        {MILESTONES.map(m => (
          <div
            key={m.row}
            className={`arcade-card py-3 px-4 text-center transition-all ${
              currentRow >= m.row ? 'border-green-400 bg-green-900/30' : 'opacity-50'
            }`}
          >
            <div className="text-2xl">{m.emoji}</div>
            <div className="font-arcade text-xs text-green-300">{m.label}</div>
            <div className="text-xs text-green-400">{m.reward}</div>
          </div>
        ))}
      </div>

      <div className="text-center mb-4 font-arcade text-green-400">
        {started && !gameOver && `Row ${currentRow + 1} of 10 — Pick wisely!`}
        {gameOver && lastReward && <span className="text-arcade-gold text-xl">🎉 {lastReward}</span>}
        {gameOver && !lastReward && <span className="text-red-400">💥 Boom! Game Over</span>}
      </div>

      {/* Jungle board */}
      <div className="arcade-card bg-gradient-to-b from-green-950 to-green-900 border-green-700/30">
        {!started ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-4 animate-float">🌴</div>
            <button onClick={startGame} className="arcade-btn-gold text-xl px-12">Enter the Jungle</button>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {board.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-2">
                {row.map((cell, ci) => (
                  <motion.button
                    key={`${ri}-${ci}`}
                    whileHover={ri === currentRow && cell === 'hidden' ? { scale: 1.1 } : {}}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCellClick(ri, ci)}
                    disabled={gameOver || ri !== currentRow || cell !== 'hidden'}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-lg font-bold text-xl transition-all ${
                      cell === 'hidden'
                        ? ri === currentRow
                          ? 'bg-green-800 border-2 border-green-500 hover:bg-green-700 cursor-pointer shadow-lg shadow-green-900/50'
                          : 'bg-green-900/50 border border-green-800/50 opacity-40'
                        : cell === 'revealed-mango'
                        ? 'bg-yellow-500 border-2 border-yellow-300'
                        : 'bg-red-600 border-2 border-red-400'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {cell === 'hidden' && (
                        <motion.span initial={{ rotateY: 0 }} animate={{ rotateY: 0 }}>❓</motion.span>
                      )}
                      {cell === 'revealed-mango' && (
                        <motion.span initial={{ rotateY: 90, scale: 0 }} animate={{ rotateY: 0, scale: 1 }}>🥭</motion.span>
                      )}
                      {cell === 'revealed-bomb' && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.5, 1] }}>💣</motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Explosion overlay */}
        <AnimatePresence>
          {exploding && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <div className="text-9xl">💥</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-4 mt-8">
        {gameOver && (
          <button onClick={startGame} className="arcade-btn-gold">Play Again</button>
        )}
        <Link to="/" className="arcade-btn bg-white/10 hover:bg-white/20">Back Home</Link>
      </div>
    </div>
  );
}
