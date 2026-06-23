import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { gameApi } from '../services/api';
import { Player } from '../types';

interface PlayerContextType {
  player: Player | null;
  setPlayerName: (name: string) => Promise<void>;
  loading: boolean;
}

const PlayerContext = createContext<PlayerContextType>({
  player: null,
  setPlayerName: async () => {},
  loading: false,
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(() => {
    const saved = localStorage.getItem('lucky_arcade_player');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const setPlayerName = async (displayName: string) => {
    setLoading(true);
    try {
      const data = await gameApi.joinPlayer(displayName);
      const p = { playerId: data.playerId, displayName: data.displayName };
      setPlayer(p);
      localStorage.setItem('lucky_arcade_player', JSON.stringify(p));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlayerContext.Provider value={{ player, setPlayerName, loading }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
