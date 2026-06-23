import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi, setAdminToken } from '../services/api';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.login(username, password);
      localStorage.setItem('admin_token', data.token);
      setAdminToken(data.token);
      navigate('/admin');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="arcade-card max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🔐</div>
          <h2 className="font-display text-3xl text-arcade-gold">Admin Login</h2>
          <p className="text-gray-400 text-sm font-arcade mt-1">Lucky Arcade Control Panel</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="font-arcade text-xs text-gray-400 block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-white/10 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:border-arcade-pink"
              required
            />
          </div>
          <div>
            <label className="font-arcade text-xs text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/10 border border-purple-500/30 rounded-xl px-4 py-3 focus:outline-none focus:border-arcade-pink"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full arcade-btn-primary disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Enter Dashboard'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6 font-arcade">
          Default: admin / admin123
        </p>
      </motion.div>
    </div>
  );
}
