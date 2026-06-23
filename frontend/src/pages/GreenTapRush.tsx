import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import { gameApi } from '../services/api';
import { TapRushStartResult } from '../types';
import NameModal from '../components/ui/NameModal';

const MILESTONES = [
  { taps: 10, reward: 'Coupon', emoji: '🎟️' },
  { taps: 20, reward: '₹500', emoji: '💵' },
  { taps: 30, reward: '₹1000', emoji: '💰' },
  { taps: 40, reward: 'Jackpot', emoji: '🏆' },
];

export default function GreenTapRush() {
  const { player, setPlayerName } = usePlayer();
  const [showName, setShowName] = useState(!player);
  const [gameConfig, setGameConfig] = useState<TapRushStartResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [greenTile, setGreenTile] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState<{ rewardDesc: string; rewardAmount: number; taps: number } | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const timerRef = useRef<number>();
  const spawnRef = useRef<number>();
  const sessionRef = useRef<number>();

  const spawnTile = useCallback((config: TapRushStartResult) => {
    const pos = Math.floor(Math.random() * config.gridSize * config.gridSize);
    setGreenTile(pos);
    const visibility = config.minVisibility + Math.random() * (config.maxVisibility - config.minVisibility);
    spawnRef.current = window.setTimeout(() => {
      setGreenTile(null);
      setCombo(0);
    }, visibility);
  }, []);

  const startGame = useCallback(async () => {
    if (!player) return;
    const data = await gameApi.tapRushStart(player.playerId, player.displayName);
    setGameConfig(data);
    sessionRef.current = data.sessionId;
    setTaps(0);
    setCombo(0);
    setResult(null);
    setTimeLeft(data.gameDuration / 1000);
    setPlaying(true);
    spawnTile(data);

    let remaining = data.gameDuration / 1000;
    timerRef.current = window.setInterval(() => {
      remaining -= 0.1;
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        finishGame(data.sessionId, taps);
      }
    }, 100);

    const spawnLoop = () => {
      if (remaining > 0) {
        spawnTile(data);
        window.setTimeout(spawnLoop, data.spawnInterval);
      }
    };
    window.setTimeout(spawnLoop, data.spawnInterval);
  }, [player, spawnTile]);

  const finishGame = async (sessionId: number, finalTaps: number) => {
    if (!player) return;
    setPlaying(false);
    setGreenTile(null);
    if (spawnRef.current) clearTimeout(spawnRef.current);
    const res = await gameApi.tapRushFinish(sessionId, finalTaps, player.displayName);
    setResult({ rewardDesc: res.rewardDesc || 'Game Over', rewardAmount: res.rewardAmount, taps: res.taps });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spawnRef.current) clearTimeout(spawnRef.current);
    };
  }, []);

  const handleTileClick = (index: number) => {
    if (!playing || greenTile !== index || !sessionRef.current || !player) return;
    const newTaps = taps + 1;
    setTaps(newTaps);
    setCombo(c => c + 1);
    setGreenTile(null);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);
    if (spawnRef.current) clearTimeout(spawnRef.current);
    gameApi.tapRushTap(sessionRef.current, newTaps, player.displayName);
    if (gameConfig) spawnTile(gameConfig);

    if (timeLeft <= 0) {
      finishGame(sessionRef.current, newTaps);
    }
  };

  useEffect(() => {
    if (playing && timeLeft <= 0 && sessionRef.current) {
      finishGame(sessionRef.current, taps);
    }
  }, [timeLeft, playing]);

  if (showName) {
    return (
      <NameModal
        onSubmit={async (name) => { await setPlayerName(name); setShowName(false); }}
        onClose={() => window.location.href = '/'}
      />
    );
  }

  const gridSize = gameConfig?.gridSize || 5;
  const progress = gameConfig ? (timeLeft / (gameConfig.gameDuration / 1000)) * 100 : 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h2 className="font-display text-5xl text-cyan-400 neon-text">⚡ Green Tap Rush</h2>
        <p className="font-arcade text-cyan-300/60 mt-2">Tap fast. Tap green. Win big.</p>
      </div>

      {/* Stats bar */}
      {playing && (
        <div className="arcade-card bg-black/50 border-cyan-500/30 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="font-display text-3xl text-cyan-400">{taps} taps</div>
            <div className="font-arcade text-2xl text-red-400">{timeLeft.toFixed(1)}s</div>
            {combo > 2 && (
              <motion.div animate={{ scale: [1, 1.2, 1] }} className="font-display text-xl text-arcade-gold">
                {combo}x COMBO!
              </motion.div>
            )}
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-green-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="flex justify-center gap-2 mb-6">
        {MILESTONES.map(m => (
          <div
            key={m.taps}
            className={`text-center px-3 py-2 rounded-lg transition-all ${
              taps >= m.taps ? 'bg-green-500/20 border border-green-400' : 'bg-white/5 opacity-50'
            }`}
          >
            <div className="text-lg">{m.emoji}</div>
            <div className="font-arcade text-xs">{m.taps}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className={`arcade-card relative ${showFlash ? 'ring-2 ring-green-400' : ''} bg-black/70 border-cyan-500/20`}>
        {!playing && !result ? (
          <div className="text-center py-16">
            <div className="text-7xl mb-4">🟢</div>
            <button onClick={startGame} className="arcade-btn-primary text-xl px-12">Start Rush!</button>
          </div>
        ) : playing ? (
          <div
            className="grid gap-2 p-4"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTileClick(i)}
                className={`aspect-square rounded-lg transition-all duration-150 ${
                  greenTile === i
                    ? 'bg-green-400 shadow-lg shadow-green-400/60 scale-105'
                    : 'bg-gray-800/80 border border-gray-700 hover:border-cyan-500/30'
                }`}
              />
            ))}
          </div>
        ) : result ? (
          <div className="text-center py-16">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl mb-4">
              {result.rewardAmount > 0 ? '🎉' : '😅'}
            </motion.div>
            <div className="font-display text-3xl text-cyan-400 mb-2">{result.taps} Taps!</div>
            <div className="font-arcade text-xl text-arcade-gold">{result.rewardDesc}</div>
            {result.rewardAmount > 0 && (
              <div className="font-display text-4xl text-arcade-gold mt-2">₹{result.rewardAmount}</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex justify-center gap-4 mt-8">
        {result && <button onClick={startGame} className="arcade-btn-gold">Play Again</button>}
        <Link to="/" className="arcade-btn bg-white/10 hover:bg-white/20">Back Home</Link>
      </div>
    </div>
  );
}
