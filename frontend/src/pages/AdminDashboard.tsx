import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi, setAdminToken } from '../services/api';
import { getSocket } from '../services/socket';
import {
  AnalyticsOverview,
  WinnerLog,
  LeaderboardEntry,
  LiveSession,
  Reward,
} from '../types';
import ProbabilityEditor from '../components/admin/ProbabilityEditor';
import ForceOutcomePanel from '../components/admin/ForceOutcomePanel';
import BoardDesigner from '../components/admin/BoardDesigner';
import RewardManager from '../components/admin/RewardManager';

type Section = 'overview' | 'games' | 'analytics' | 'probability' | 'rewards' | 'winners' | 'live' | 'leaderboard' | 'force' | 'boards';

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'games', label: 'Games', icon: '🎮' },
  { key: 'analytics', label: 'Analytics', icon: '📈' },
  { key: 'probability', label: 'Probabilities', icon: '🎲' },
  { key: 'force', label: 'Force Outcome', icon: '🎯' },
  { key: 'rewards', label: 'Rewards', icon: '🎁' },
  { key: 'boards', label: 'Board Designer', icon: '🗺️' },
  { key: 'winners', label: 'Winners', icon: '🏆' },
  { key: 'live', label: 'Live Sessions', icon: '📡' },
  { key: 'leaderboard', label: 'Leaderboard', icon: '🥇' },
];

const PLINKO_SLOT_LABELS = ['0x', '1x', '2x', '5x', '10x', '25x', '50x', '25x', '10x', '5x', '2x', '1x', '0x'];
const PLINKO_KEYS = PLINKO_SLOT_LABELS.map((_, i) => `slot_${i}`);
const MANGO_KEYS = ['LOSE_BEFORE_5', 'REACH_5', 'REACH_7', 'REACH_10'];
const TAP_KEYS = ['FAIL', 'REACH_10', 'REACH_20', 'REACH_30', 'REACH_40'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('overview');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [gameStats, setGameStats] = useState<unknown[]>([]);
  const [hourlyStats, setHourlyStats] = useState<unknown[]>([]);
  const [winners, setWinners] = useState<WinnerLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [plinkoProb, setPlinkoProb] = useState<Record<string, number>>({});
  const [mangoProb, setMangoProb] = useState<Record<string, number>>({});
  const [tapProb, setTapProb] = useState<Record<string, number>>({});
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [eventTitle, setEventTitle] = useState('');
  const [jackpot, setJackpot] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { navigate('/admin/login'); return; }
    setAdminToken(token);
    loadAll();
    const socket = getSocket();
    socket.on('winners_feed', setWinners);
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('live_sessions', setLiveSessions);
    socket.on('game_started', () => adminApi.getLiveSessions().then(setLiveSessions));
    socket.on('game_finished', () => { loadOverview(); adminApi.getLiveSessions().then(setLiveSessions); });
    const interval = setInterval(() => adminApi.getLiveSessions().then(setLiveSessions), 5000);
    return () => {
      clearInterval(interval);
      socket.off('winners_feed');
      socket.off('leaderboard_updated');
      socket.off('live_sessions');
    };
  }, [navigate]);

  const loadOverview = () => adminApi.getOverview().then(setOverview);
  const loadAll = useCallback(async () => {
    loadOverview();
    adminApi.getGameStats().then(setGameStats);
    adminApi.getHourlyActivity().then(setHourlyStats);
    adminApi.getWinners().then(setWinners);
    adminApi.getLeaderboard().then(setLeaderboard);
    adminApi.getLiveSessions().then(setLiveSessions);
    adminApi.getProbabilities(1).then(setPlinkoProb);
    adminApi.getProbabilities(2).then(setMangoProb);
    adminApi.getProbabilities(3).then(setTapProb);
    adminApi.getRewards().then(setRewards);
    adminApi.getSettings().then(s => {
      setSettings(s);
      setEventTitle(s.event_title || '');
      setJackpot(s.current_jackpot || '');
    });
  }, []);

  const logout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    navigate('/admin/login');
  };

  const saveSettings = async () => {
    await adminApi.updateSetting('event_title', eventTitle);
    await adminApi.updateSetting('current_jackpot', jackpot);
    loadAll();
  };

  const handleRtpChange = async (rtp: number) => {
    const config = await adminApi.setPlinkoRtp(rtp);
    setPlinkoProb(config.config);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-arcade-card border-r border-purple-500/20 flex flex-col">
        <div className="p-6 border-b border-purple-500/20">
          <Link to="/" className="font-display text-2xl text-arcade-gold">🎰 Admin</Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full text-left px-4 py-3 rounded-lg font-arcade text-sm transition-all flex items-center gap-3 ${
                section === s.key ? 'bg-arcade-purple text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-purple-500/20">
          <button onClick={logout} className="w-full arcade-btn bg-red-900/50 hover:bg-red-800/50 text-sm">
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {section === 'overview' && overview && (
          <div className="space-y-8">
            <h2 className="font-display text-4xl text-white">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Games', value: overview.totalGamesPlayed, icon: '🎮' },
                { label: 'Total Winners', value: overview.totalWinners, icon: '🏆' },
                { label: 'Total Payouts', value: `₹${overview.totalPayouts.toLocaleString()}`, icon: '💸' },
                { label: 'Active Players', value: overview.activePlayers, icon: '👥' },
                { label: 'Est. Revenue', value: `₹${overview.estimatedRevenue.toLocaleString()}`, icon: '📈' },
                { label: 'Est. Profit', value: `₹${overview.estimatedProfit.toLocaleString()}`, icon: '💰' },
                { label: 'Jackpot', value: `₹${overview.currentJackpot.toLocaleString()}`, icon: '🎰' },
                { label: 'Today', value: overview.gamesPlayedToday, icon: '📅' },
              ].map((card, i) => (
                <motion.div key={i} whileHover={{ scale: 1.02 }} className="arcade-card text-center">
                  <div className="text-3xl mb-2">{card.icon}</div>
                  <div className="font-arcade text-xs text-gray-400">{card.label}</div>
                  <div className="font-display text-2xl text-arcade-gold mt-1">{card.value}</div>
                </motion.div>
              ))}
            </div>

            <div className="arcade-card">
              <h3 className="font-display text-xl mb-4">Event Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-arcade text-xs text-gray-400">Event Title</label>
                  <input value={eventTitle} onChange={e => setEventTitle(e.target.value)}
                    className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="font-arcade text-xs text-gray-400">Current Jackpot (₹)</label>
                  <input value={jackpot} onChange={e => setJackpot(e.target.value)}
                    className="w-full mt-1 bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2" />
                </div>
              </div>
              <button onClick={saveSettings} className="mt-4 arcade-btn-primary text-sm">Save Settings</button>
            </div>
          </div>
        )}

        {section === 'games' && (
          <div className="space-y-6">
            <h2 className="font-display text-4xl">Game Statistics</h2>
            <div className="grid gap-4">
              {(gameStats as { name: string; slug: string; sessions: number; wins: number; total_payouts: number; avg_score: number }[]).map(g => (
                <div key={g.slug} className="arcade-card flex justify-between items-center">
                  <div>
                    <div className="font-display text-xl">{g.name}</div>
                    <div className="text-sm text-gray-400">{g.sessions} sessions · {g.wins} wins</div>
                  </div>
                  <div className="text-right">
                    <div className="font-arcade text-arcade-gold">₹{Number(g.total_payouts).toLocaleString()}</div>
                    <div className="text-xs text-gray-400">avg score: {Math.round(Number(g.avg_score))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'analytics' && (
          <div className="space-y-6">
            <h2 className="font-display text-4xl">Analytics</h2>
            <div className="arcade-card">
              <h3 className="font-display text-xl mb-4">Hourly Activity (Today)</h3>
              <div className="flex items-end gap-2 h-48">
                {(hourlyStats as { hour: number; count: number }[]).map(h => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-arcade-purple rounded-t"
                      style={{ height: `${Math.max(4, (h.count / Math.max(...(hourlyStats as { count: number }[]).map(x => x.count), 1)) * 160)}px` }}
                    />
                    <span className="text-xs text-gray-500">{h.hour}h</span>
                    <span className="text-xs font-arcade">{h.count}</span>
                  </div>
                ))}
                {(hourlyStats as unknown[]).length === 0 && (
                  <p className="text-gray-500 m-auto">No activity data yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {section === 'probability' && (
          <div className="space-y-8">
            <h2 className="font-display text-4xl">Probability Engine</h2>

            <div className="arcade-card">
              <h3 className="font-display text-xl mb-2">Plinko RTP Control</h3>
              <div className="flex gap-2 mb-6">
                {[60, 70, 80, 90, 95].map(rtp => (
                  <button key={rtp} onClick={() => handleRtpChange(rtp)}
                    className={`px-4 py-2 rounded-lg font-arcade text-sm ${
                      settings.plinko_rtp === String(rtp) ? 'bg-arcade-gold text-black' : 'bg-white/10 hover:bg-white/20'
                    }`}>
                    {rtp}%
                  </button>
                ))}
              </div>
              <ProbabilityEditor
                title="Plinko Slot Probabilities"
                gameId={1}
                config={plinkoProb}
                keys={PLINKO_KEYS}
                labels={PLINKO_SLOT_LABELS}
                onUpdate={setPlinkoProb}
              />
            </div>

            <ProbabilityEditor
              title="Mango Quest Outcomes"
              gameId={2}
              config={mangoProb}
              keys={MANGO_KEYS}
              labels={['Lose Before 5', 'Reach Row 5', 'Reach Row 7', 'Reach Row 10']}
              onUpdate={setMangoProb}
            />

            <ProbabilityEditor
              title="Green Tap Rush Outcomes"
              gameId={3}
              config={tapProb}
              keys={TAP_KEYS}
              labels={['Fail', 'Reach 10', 'Reach 20', 'Reach 30', 'Reach 40']}
              onUpdate={setTapProb}
            />
          </div>
        )}

        {section === 'force' && <ForceOutcomePanel onForced={loadAll} />}
        {section === 'rewards' && <RewardManager rewards={rewards} onUpdate={() => adminApi.getRewards().then(setRewards)} />}
        {section === 'boards' && <BoardDesigner />}
        {section === 'winners' && (
          <div className="space-y-4">
            <h2 className="font-display text-4xl">Recent Winners</h2>
            {winners.map(w => (
              <div key={w.id} className="arcade-card flex justify-between">
                <div>
                  <div className="font-arcade text-arcade-gold">{w.player_name}</div>
                  <div className="text-sm text-gray-400">{w.game_name}</div>
                </div>
                <div className="text-right">
                  <div>{w.reward_description}</div>
                  {w.reward_amount > 0 && <div className="text-arcade-gold">₹{w.reward_amount}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'live' && (
          <div className="space-y-4">
            <h2 className="font-display text-4xl">Live Sessions</h2>
            {liveSessions.length === 0 ? (
              <p className="text-gray-500 font-arcade">No active sessions</p>
            ) : liveSessions.map(s => (
              <div key={s.sessionId} className="arcade-card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-arcade text-arcade-gold">{s.playerName}</div>
                    <div className="text-sm">{s.gameName}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-green-400">● Live</div>
                    <div className="text-gray-400">{s.duration}s</div>
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-400 font-arcade">
                  <span>Progress: {s.progress}</span>
                  {s.outcome && <span>Outcome: {s.outcome}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'leaderboard' && (
          <div className="space-y-4">
            <h2 className="font-display text-4xl">Leaderboard</h2>
            {leaderboard.map((e, i) => (
              <div key={i} className="arcade-card flex items-center gap-4">
                <span className="font-display text-xl text-arcade-gold w-8">#{i + 1}</span>
                <div className="flex-1 font-arcade">{e.player_name}</div>
                <div className="text-arcade-gold">₹{Number(e.total_winnings).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
