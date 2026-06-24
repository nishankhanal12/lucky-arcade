import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import { gameApi } from '../services/api';
import { PlinkoStartResult } from '../types';
import NameModal from '../components/ui/NameModal';
import { PlinkoCanvasEngine, PLINKO, buildRouteFromPath } from '../components/games/plinkoEngine';

export default function Plinko() {
  const { player, setPlayerName } = usePlayer();
  const [showName, setShowName] = useState(!player);
  const [gameState, setGameState] = useState<'idle' | 'dropping' | 'done'>('idle');
  const [gameData, setGameData] = useState<PlinkoStartResult | null>(null);
  const [result, setResult] = useState<{ rewardAmount: number; rewardDesc: string; multiplier: number } | null>(null);
  const [showReward, setShowReward] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PlinkoCanvasEngine | null>(null);
  const playerRef = useRef(player);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new PlinkoCanvasEngine(canvas);
    engineRef.current = engine;

    const resize = () => engine.resize();
    resize();
    engine.drawIdle();

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const playSound = (type: string) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'jackpot') {
        [880, 1100, 1320].forEach((f, i) => osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1));
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
      }
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch {
      /* audio unavailable */
    }
  };

  const startGame = useCallback(async () => {
    const p = playerRef.current;
    const engine = engineRef.current;
    if (!p || !engine) return;

    setResult(null);
    setShowReward(false);
    setGameState('dropping');

    const data = await gameApi.plinkoStart(p.playerId, p.displayName);
    setGameData(data);
    engine.setHighlight(null);

    const route = data.route?.length
      ? data.route
      : buildRouteFromPath(data.path, data.slotIndex);

    engine.startDrop(route, data.slotIndex, data.visualSeed, async () => {
      engine.setHighlight(data.slotIndex);

      const res = await gameApi.plinkoFinish(data.sessionId, p.displayName);
      setResult(res);
      setGameState('done');
      setShowReward(true);
      playSound(res.multiplier >= 25 ? 'jackpot' : res.multiplier > 0 ? 'win' : 'lose');
    });
  }, []);

  if (showName) {
    return (
      <NameModal
        onSubmit={async (name) => {
          await setPlayerName(name);
          setShowName(false);
        }}
        onClose={() => { window.location.href = '/'; }}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h2 className="font-display text-5xl text-arcade-gold gold-text">🎯 Plinko Drop</h2>
        <p className="font-arcade text-gray-400 mt-2">Watch it flow — high risk at the edges, jackpot in the center</p>
      </div>

      <div
        className="relative rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-900/40"
        style={{ boxShadow: '0 0 40px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.08)' }}
      >
        <canvas ref={canvasRef} className="block w-full" style={{ height: 520 }} />

        <AnimatePresence>
          {showReward && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <div
                className={`font-display text-3xl md:text-5xl px-8 py-4 rounded-2xl backdrop-blur-md ${
                  result.multiplier >= 25
                    ? 'text-arcade-gold gold-text bg-black/50 border-2 border-arcade-gold/60'
                    : result.multiplier > 0
                    ? 'text-green-300 bg-black/45 border border-green-400/40'
                    : 'text-red-300 bg-black/45 border border-red-400/40'
                }`}
              >
                {result.rewardDesc}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap justify-center gap-1 mt-3 px-2">
        {PLINKO.SLOT_VALUES.map((m, i) => (
          <span
            key={i}
            className={`font-arcade text-[10px] md:text-xs px-1 py-0.5 rounded ${
              gameData?.slotIndex === i && gameState === 'done'
                ? 'bg-arcade-gold text-black scale-110'
                : 'text-gray-500'
            }`}
          >
            {m}x
          </span>
        ))}
      </div>

      <div className="flex justify-center gap-4 mt-8">
        {gameState === 'idle' || gameState === 'done' ? (
          <button onClick={startGame} className="arcade-btn-gold text-xl px-12">
            {gameState === 'done' ? 'Drop Again' : 'Drop Ball!'}
          </button>
        ) : (
          <div className="font-arcade text-arcade-gold animate-pulse text-xl">Ball in motion...</div>
        )}
        <Link to="/" className="arcade-btn bg-white/10 hover:bg-white/20">Back Home</Link>
      </div>
    </div>
  );
}
