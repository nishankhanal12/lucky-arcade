import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Plinko from './pages/Plinko';
import MangoQuest from './pages/MangoQuest';
import GreenTapRush from './pages/GreenTapRush';
import Leaderboard from './pages/Leaderboard';
import WinnersFeed from './pages/WinnersFeed';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/plinko" element={<Plinko />} />
            <Route path="/mango-quest" element={<MangoQuest />} />
            <Route path="/green-tap-rush" element={<GreenTapRush />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/winners" element={<WinnersFeed />} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  );
}
