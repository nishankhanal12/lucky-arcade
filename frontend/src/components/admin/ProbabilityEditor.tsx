import { useState } from 'react';
import { adminApi } from '../../services/api';

interface Props {
  title: string;
  gameId: number;
  config: Record<string, number>;
  keys: string[];
  labels: string[];
  onUpdate: (config: Record<string, number>) => void;
}

export default function ProbabilityEditor({ title, gameId, config, keys, labels, onUpdate }: Props) {
  const [local, setLocal] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const current = { ...config, ...local };
  const sum = keys.reduce((s, k) => s + (current[k] || 0), 0);

  const handleChange = (key: string, value: number) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    const merged = keys.reduce((acc, k) => ({ ...acc, [k]: current[k] || 0 }), {} as Record<string, number>);
    if (Math.abs(Object.values(merged).reduce((s, v) => s + v, 0) - 100) > 0.01) {
      setError('Total must equal 100%');
      return;
    }
    setError('');
    const result = await adminApi.updateProbabilities(gameId, merged);
    onUpdate(result.config || merged);
    setLocal({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="arcade-card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display text-xl">{title}</h3>
        <div className={`font-arcade text-sm ${Math.abs(sum - 100) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
          Total: {sum.toFixed(1)}%
        </div>
      </div>

      <div className="space-y-4">
        {keys.map((key, i) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <label className="font-arcade text-sm text-gray-300">{labels[i]}</label>
              <span className="font-arcade text-sm text-arcade-gold">{(current[key] || 0).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={current[key] || 0}
              onChange={e => handleChange(key, parseFloat(e.target.value))}
              className="w-full accent-arcade-pink"
            />
            <div className="h-2 mt-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-arcade-purple to-arcade-pink transition-all"
                style={{ width: `${current[key] || 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      <button onClick={handleSave} className="mt-4 arcade-btn-primary text-sm">
        {saved ? '✓ Saved!' : 'Save Probabilities'}
      </button>
    </div>
  );
}
