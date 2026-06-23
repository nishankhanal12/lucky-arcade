import { useState } from 'react';
import { adminApi } from '../../services/api';

const FORCE_OPTIONS = [
  { gameId: 1, game: 'Plinko', outcome: 'JACKPOT', label: 'Plinko Jackpot (50x)', color: 'from-yellow-500 to-orange-500' },
  { gameId: 1, game: 'Plinko', outcome: 'LOSE', label: 'Plinko Lose (0x)', color: 'from-red-600 to-red-800' },
  { gameId: 1, game: 'Plinko', outcome: 'SMALL_WIN', label: 'Plinko Small Win', color: 'from-green-600 to-green-800' },
  { gameId: 1, game: 'Plinko', outcome: 'MEDIUM_WIN', label: 'Plinko Medium Win', color: 'from-blue-600 to-blue-800' },
  { gameId: 1, game: 'Plinko', outcome: 'BIG_WIN', label: 'Plinko Big Win', color: 'from-purple-600 to-purple-800' },
  { gameId: 2, game: 'Mango Quest', outcome: 'REACH_10', label: 'Mango Reach Row 10', color: 'from-green-600 to-emerald-800' },
  { gameId: 2, game: 'Mango Quest', outcome: 'REACH_7', label: 'Mango Reach Row 7', color: 'from-green-500 to-green-700' },
  { gameId: 2, game: 'Mango Quest', outcome: 'LOSE_BEFORE_5', label: 'Mango Lose Before 5', color: 'from-red-600 to-red-800' },
  { gameId: 3, game: 'Tap Rush', outcome: 'REACH_40', label: 'Tap Rush Reach 40', color: 'from-cyan-500 to-green-600' },
  { gameId: 3, game: 'Tap Rush', outcome: 'FAIL', label: 'Tap Rush Fail', color: 'from-red-600 to-red-800' },
];

interface Props {
  onForced: () => void;
}

export default function ForceOutcomePanel({ onForced }: Props) {
  const [lastForced, setLastForced] = useState<string | null>(null);

  const handleForce = async (gameId: number, outcome: string, label: string) => {
    await adminApi.forceOutcome(gameId, outcome);
    setLastForced(label);
    onForced();
    setTimeout(() => setLastForced(null), 3000);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-4xl">Force Outcome Panel</h2>
      <p className="text-gray-400 font-arcade text-sm">
        Queue a forced outcome for the next player session. The outcome applies to the very next game start.
      </p>

      {lastForced && (
        <div className="bg-green-900/30 border border-green-500/30 rounded-xl px-4 py-3 font-arcade text-green-400">
          ✓ Queued: {lastForced}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FORCE_OPTIONS.map(opt => (
          <button
            key={`${opt.gameId}-${opt.outcome}`}
            onClick={() => handleForce(opt.gameId, opt.outcome, opt.label)}
            className={`arcade-card text-left bg-gradient-to-r ${opt.color} border-0 hover:scale-102 transition-transform`}
          >
            <div className="font-arcade text-xs text-white/70">{opt.game}</div>
            <div className="font-display text-lg">{opt.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
