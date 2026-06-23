import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/winners', label: 'Winners' },
  { to: '/admin/login', label: 'Admin' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-arcade-dark/90 backdrop-blur-md border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-4xl">🎰</span>
            <h1 className="font-display text-3xl text-arcade-gold gold-text tracking-wider">
              Lucky Arcade
            </h1>
          </Link>
          <nav className="flex gap-2">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg font-arcade text-sm transition-all ${
                  location.pathname === link.to
                    ? 'bg-arcade-purple text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>
      <footer className="border-t border-purple-500/20 py-4 text-center text-gray-500 text-sm font-arcade">
        Lucky Arcade LAN Event Platform © 2026
      </footer>
    </div>
  );
}
