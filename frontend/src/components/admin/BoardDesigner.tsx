import { useState } from 'react';
import { adminApi } from '../../services/api';

const COLS = 7;
const ROWS = 10;

type CellType = 'mango' | 'bomb';

export default function BoardDesigner() {
  const [board, setBoard] = useState<CellType[][]>(
    () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 'bomb' as CellType))
  );
  const [boardName, setBoardName] = useState('');
  const [saved, setSaved] = useState(false);

  const toggleCell = (row: number, col: number) => {
    setBoard(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = next[row][col] === 'mango' ? 'bomb' : 'mango';
      return next;
    });
  };

  const generateBoard = async (difficulty: string) => {
    const data = await adminApi.generateBoard(difficulty);
    setBoard(data.board);
  };

  const saveBoard = async () => {
    if (!boardName.trim()) return;
    await adminApi.saveBoard(boardName, board, 'custom');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-4xl">Mango Quest Board Designer</h2>

      <div className="flex flex-wrap gap-2">
        {['easy', 'medium', 'hard', 'custom'].map(d => (
          <button key={d} onClick={() => generateBoard(d)}
            className="arcade-btn bg-white/10 hover:bg-white/20 text-sm capitalize">
            Generate {d}
          </button>
        ))}
      </div>

      <div className="arcade-card bg-green-950/50 border-green-700/30 inline-block">
        <div className="space-y-1 p-4">
          {board.map((row, ri) => (
            <div key={ri} className="flex gap-1">
              {row.map((cell, ci) => (
                <button
                  key={`${ri}-${ci}`}
                  onClick={() => toggleCell(ri, ci)}
                  className={`w-10 h-10 rounded text-lg transition-all ${
                    cell === 'mango' ? 'bg-yellow-500 hover:bg-yellow-400' : 'bg-red-800 hover:bg-red-700'
                  }`}
                >
                  {cell === 'mango' ? '🥭' : '💣'}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 flex gap-2 text-xs font-arcade text-gray-400">
          <span>🥭 = Mango (safe)</span>
          <span>💣 = Bomb</span>
        </div>
      </div>

      <div className="flex gap-4 items-end">
        <div>
          <label className="font-arcade text-xs text-gray-400">Board Name</label>
          <input value={boardName} onChange={e => setBoardName(e.target.value)}
            placeholder="My Custom Board"
            className="block mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2" />
        </div>
        <button onClick={saveBoard} disabled={!boardName.trim()} className="arcade-btn-primary text-sm disabled:opacity-50">
          {saved ? '✓ Saved!' : 'Save Board'}
        </button>
      </div>
    </div>
  );
}
