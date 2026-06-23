import { useState } from 'react';
import { adminApi } from '../../services/api';
import { Reward } from '../../types';

interface Props {
  rewards: Reward[];
  onUpdate: () => void;
}

export default function RewardManager({ rewards, onUpdate }: Props) {
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState({ game_id: 2, milestone: '', reward_type: 'rupees', reward_value: 0, description: '' });

  const handleSave = async () => {
    if (editing) {
      await adminApi.updateReward(editing.id, form);
    } else {
      await adminApi.createReward(form);
    }
    setEditing(null);
    setForm({ game_id: 2, milestone: '', reward_type: 'rupees', reward_value: 0, description: '' });
    onUpdate();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this reward?')) {
      await adminApi.deleteReward(id);
      onUpdate();
    }
  };

  const startEdit = (r: Reward) => {
    setEditing(r);
    setForm({ game_id: r.game_id, milestone: r.milestone, reward_type: r.reward_type, reward_value: r.reward_value, description: r.description });
  };

  const gameNames: Record<number, string> = { 1: 'Plinko', 2: 'Mango Quest', 3: 'Tap Rush' };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-4xl">Reward Management</h2>

      <div className="arcade-card space-y-4">
        <h3 className="font-display text-xl">{editing ? 'Edit Reward' : 'Add Reward'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-arcade text-xs text-gray-400">Game</label>
            <select value={form.game_id} onChange={e => setForm(f => ({ ...f, game_id: parseInt(e.target.value) }))}
              className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2">
              <option value={2}>Mango Quest</option>
              <option value={3}>Tap Rush</option>
            </select>
          </div>
          <div>
            <label className="font-arcade text-xs text-gray-400">Milestone</label>
            <input value={form.milestone} onChange={e => setForm(f => ({ ...f, milestone: e.target.value }))}
              placeholder="row_5, taps_10..."
              className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="font-arcade text-xs text-gray-400">Type</label>
            <select value={form.reward_type} onChange={e => setForm(f => ({ ...f, reward_type: e.target.value }))}
              className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2">
              <option value="coupon">Coupon</option>
              <option value="rupees">Rupees</option>
              <option value="jackpot">Jackpot</option>
            </select>
          </div>
          <div>
            <label className="font-arcade text-xs text-gray-400">Value (₹)</label>
            <input type="number" value={form.reward_value} onChange={e => setForm(f => ({ ...f, reward_value: parseFloat(e.target.value) }))}
              className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2" />
          </div>
          <div className="col-span-2">
            <label className="font-arcade text-xs text-gray-400">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="arcade-btn-primary text-sm">{editing ? 'Update' : 'Add Reward'}</button>
          {editing && <button onClick={() => setEditing(null)} className="arcade-btn bg-white/10 text-sm">Cancel</button>}
        </div>
      </div>

      <div className="space-y-3">
        {rewards.map(r => (
          <div key={r.id} className="arcade-card flex justify-between items-center">
            <div>
              <div className="font-arcade text-arcade-gold">{gameNames[r.game_id]} — {r.milestone}</div>
              <div className="text-sm">{r.description}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-arcade text-xs text-gray-400">{r.reward_type}</div>
                <div>₹{r.reward_value}</div>
              </div>
              <button onClick={() => startEdit(r)} className="text-blue-400 text-sm hover:underline">Edit</button>
              <button onClick={() => handleDelete(r.id)} className="text-red-400 text-sm hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
