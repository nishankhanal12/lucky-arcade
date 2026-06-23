import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NameModalProps {
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export default function NameModal({ onSubmit, onClose }: NameModalProps) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="arcade-card max-w-md w-full mx-4 text-center"
      >
        <div className="text-5xl mb-4">🎮</div>
        <h3 className="font-display text-3xl text-arcade-gold mb-2">Enter Your Name</h3>
        <p className="text-gray-400 text-sm mb-6">Choose a display name to play</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSubmit(name.trim())}
          placeholder="Your arcade name..."
          className="w-full bg-white/10 border border-purple-500/30 rounded-xl px-4 py-3 font-arcade text-center text-lg focus:outline-none focus:border-arcade-pink mb-4"
          autoFocus
          maxLength={20}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 arcade-btn bg-white/10 hover:bg-white/20">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={!name.trim()}
            className="flex-1 arcade-btn-primary disabled:opacity-50"
          >
            Let's Play!
          </button>
        </div>
      </motion.div>
    </div>
  );
}
