import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import { gameApi } from '../services/api';
import { PlinkoStartResult } from '../types';
import NameModal from '../components/ui/NameModal';

const MULTIPLIERS = [0, 0.5, 1, 2, 5, 10, 50];
const SLOT_COLORS = [
  'bg-red-600', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500',
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500',
];

export default function Plinko() {
  const { player, setPlayerName } = usePlayer();
  const [showName, setShowName] = useState(!player);
  const [gameState, setGameState] = useState<'idle' | 'dropping' | 'done'>('idle');
  const [gameData, setGameData] = useState<PlinkoStartResult | null>(null);
  const [result, setResult] = useState<{ rewardAmount: number; rewardDesc: string; multiplier: number } | null>(null);
  const [ballPos, setBallPos] = useState({ x: 50, y: 5 });
  const [showReward, setShowReward] = useState(false);
  const animRef = useRef<number>();

  const startGame = useCallback(async () => {
    if (!player) return;
    setGameState('idle');
    setResult(null);
    setShowReward(false);
    const data = await gameApi.plinkoStart(player.playerId, player.displayName);
    setGameData(data);
    setGameState('dropping');
    animateBall(data);
  }, [player]);

  const animateBall = (data: PlinkoStartResult) => {
    const path = data.path;
    const numRows = path.length;
    let row = 0;
    let xPos = 50;

    const step = () => {
      if (row >= numRows) {
        const slotX = 10 + (data.slotIndex / (MULTIPLIERS.length - 1)) * 80;
        setBallPos({ x: slotX, y: 92 });
        setTimeout(async () => {
          const res = await gameApi.plinkoFinish(data.sessionId, player!.displayName);
          setResult(res);
          setGameState('done');
          setShowReward(true);
          playSound(res.multiplier >= 10 ? 'jackpot' : res.multiplier > 0 ? 'win' : 'lose');
        }, 500);
        return;
      }

      const dir = path[row];
      xPos += dir === 'R' ? (80 / numRows) * 0.4 : -(80 / numRows) * 0.4;
      xPos = Math.max(15, Math.min(85, xPos));
      const yPos = 10 + (row / numRows) * 75;
      setBallPos({ x: xPos, y: yPos });
      row++;
      animRef.current = window.setTimeout(step, 120);
    };
    step();
  };

  const playSound = (type: string) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'jackpot') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
      }
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* audio not available */ }
  };

  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current); }, []);

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
      <div className="text-center mb-8">
        <h2 className="font-display text-5xl text-arcade-gold gold-text">🎯 Plinko Drop</h2>
        <p className="font-arcade text-gray-400 mt-2">Drop the ball and win big!</p>
      </div>

      <div className="arcade-card relative overflow-hidden" style={{ minHeight: 500 }}>
        {/* Peg board */}
        <div className="relative w-full h-[450px]">
          {Array.from({ length: 10 }).map((_, row) =>
            Array.from({ length: row + 3 }).map((_, col) => {
              const x = 50 + (col - (row + 2) / 2) * 8;
              const y = 12 + row * 7;
              return (
                <div
                  key={`${row}-${col}`}
                  className="absolute w-3 h-3 rounded-full bg-white/60 shadow-lg shadow-white/20"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                />
              );
            })
          )}

          {/* Ball */}
          {(gameState === 'dropping' || gameState === 'done') && (
            <motion.div
              className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-arcade-gold to-yellow-600 shadow-lg shadow-yellow-500/50 z-10"
              style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transform: 'translate(-50%, -50%)' }}
              animate={{ scale: gameState === 'done' ? [1, 1.3, 1] : 1 }}
            />
          )}

          {/* Multiplier slots */}
          <div className="absolute bottom-0 left-0 right-0 flex">
            {MULTIPLIERS.map((m, i) => (
              <div
                key={m}
                className={`flex-1 py-3 text-center font-arcade text-xs font-bold ${SLOT_COLORS[i]} ${
                  gameState === 'done' && gameData?.slotIndex === i ? 'ring-2 ring-white scale-110' : ''
                } transition-all`}
              >
                {m}x
              </div>
            ))}
          </div>
        </div>

        {/* Floating reward */}
        <AnimatePresence>
          {showReward && result && (
            <motion.div
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -60, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <div className={`font-display text-5xl ${result.multiplier >= 10 ? 'text-arcade-gold gold-text' : result.multiplier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.rewardDesc}
              </div>
              {result.multiplier >= 10 && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="text-6xl text-center mt-2"
                >
                  ✨🎉✨
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-4 mt-8">
        {gameState === 'idle' || gameState === 'done' ? (
          <button onClick={startGame} className="arcade-btn-gold text-xl px-12">
            {gameState === 'done' ? 'Drop Again' : 'Drop Ball!'}
          </button>
        ) : (
          <div className="font-arcade text-arcade-gold animate-pulse text-xl">Ball dropping...</div>
        )}
        <Link to="/" className="arcade-btn bg-white/10 hover:bg-white/20">Back Home</Link>
      </div>
    </div>
  );
}
