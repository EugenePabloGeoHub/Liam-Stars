import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Square, Zap, Trophy, X } from 'lucide-react';

export const GridRunner = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('grid_high_score') || 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerPos, setPlayerPos] = useState(50); // percentage
  const [blocks, setBlocks] = useState<{ id: number, x: number, y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);

  useEffect(() => {
    if (isPlaying) {
      const update = (time: number) => {
        if (time - lastSpawnRef.current > Math.max(200, 1000 - score / 10)) {
          setBlocks(prev => [...prev, { id: Date.now(), x: Math.random() * 90 + 5, y: -10 }]);
          lastSpawnRef.current = time;
        }

        setBlocks(prev => {
          const next = prev.map(b => ({ ...b, y: b.y + 1 + score / 5000 }));
          const hit = next.find(b => b.y > 85 && b.y < 95 && Math.abs(b.x - playerPos) < 10);
          if (hit) {
            setIsPlaying(false);
            return [];
          }
          const filtered = next.filter(b => b.y < 110);
          if (filtered.length < next.length) setScore(s => s + 10);
          return filtered;
        });

        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(frameRef.current);
    }
  }, [isPlaying, playerPos, score, highScore, onScoreUpdate]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setPlayerPos(Math.max(5, Math.min(95, x)));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
    setPlayerPos(Math.max(5, Math.min(95, x)));
  };

  useEffect(() => {
    if (!isPlaying && score > 0) {
      onScoreUpdate(score);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('grid_high_score', score.toString());
      }
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);
  const startGame = () => {
    setScore(0);
    setBlocks([]);
    setIsPlaying(true);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-sans overflow-hidden cursor-none touch-none"
    >
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-white tracking-tighter">{score}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">High Score</span>
          <span className="text-4xl font-black italic text-white/60 tracking-tighter">{highScore}</span>
        </div>
      </div>

      <div className="relative w-full h-full">
        {blocks.map(b => (
          <div 
            key={b.id}
            className="absolute w-12 h-12 bg-red-500 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-400/50"
            style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translateX(-50%)' }}
          />
        ))}

        <motion.div 
          className="absolute bottom-12 w-16 h-16 bg-blue-500 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)] border-2 border-white/20 flex items-center justify-center"
          style={{ left: `${playerPos}%`, transform: 'translateX(-50%)' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Square className="w-8 h-8 text-white animate-pulse" />
        </motion.div>

        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-20"
            >
              <div className="flex flex-col items-center gap-8 bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
                <div className="w-24 h-24 bg-blue-500 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-6">
                  <Square className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white mb-2">GRID RUNNER</h2>
                  <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Dodge the falling blocks. Survive as long as you can.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={startGame}
                    className="px-12 py-4 bg-white text-black font-black uppercase italic tracking-tighter rounded-2xl hover:bg-blue-500 hover:text-white transition-all shadow-xl"
                  >
                    {score > 0 ? 'Try Again' : 'Start Game'}
                  </button>
                  <button
                    onClick={onExit}
                    className="px-12 py-4 bg-white/5 text-white font-black uppercase italic tracking-tighter rounded-2xl border border-white/10 hover:bg-red-500 transition-all"
                  >
                    Exit Arcade
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="grid grid-cols-12 h-full w-full">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="border-r border-white/5 h-full" />
          ))}
        </div>
        <div className="grid grid-rows-12 h-full w-full absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="border-b border-white/5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
};
