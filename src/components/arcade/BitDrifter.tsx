import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const BitDrifter = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [carPos, setCarPos] = useState(50);
  const [obstacles, setObstacles] = useState<{ x: number, y: number }[]>([]);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  const update = useCallback((time: number) => {
    if (!isPlaying) return;
    
    timeRef.current = time / 1000;
    const t = timeRef.current;
    
    setObstacles(prev => {
      const newObs = prev.map(o => ({ ...o, y: o.y + 2 })).filter(o => o.y < 100);
      
      // Spawn new obstacle
      if (t % 0.5 < 0.02) {
        newObs.push({ x: Math.random() * 80 + 10, y: -10 });
      }
      
      // Check collision
      const collision = newObs.some(o => {
        return o.y > 80 && o.y < 90 && Math.abs(o.x - carPos) < 10;
      });

      if (collision) {
        setGameOver(true);
        setIsPlaying(false);
        onScoreUpdate(score);
        return prev;
      }

      setScore(s => s + 1);
      return newObs;
    });
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, carPos, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCarPos(c => Math.max(10, c - 5));
      if (e.key === 'ArrowRight') setCarPos(c => Math.min(90, c + 5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setObstacles([]);
    setCarPos(50);
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Distance</span>
          <span className="text-4xl font-black italic text-blue-500">{Math.floor(score / 10)}m</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {isPlaying && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* The Road */}
              <div className="absolute w-1/2 h-full bg-white/5 border-x border-white/10" />
              
              {/* The Car */}
              <motion.div 
                className="absolute w-12 h-20 bg-blue-500 rounded-lg shadow-[0_0_20px_#3b82f6] z-20"
                style={{ 
                  left: `${carPos}%`,
                  bottom: '10%',
                  transform: 'translateX(-50%)'
                }}
              />
              
              {/* Obstacles */}
              {obstacles.map((o, i) => (
                <motion.div 
                  key={i}
                  className="absolute w-12 h-12 bg-red-500 rounded-lg shadow-[0_0_20px_#ef4444]"
                  style={{ 
                    left: `${o.x}%`,
                    top: `${o.y}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!isPlaying && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8 text-center bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl z-20"
            >
              <h2 className="text-5xl font-black uppercase italic tracking-tighter">
                {gameOver ? 'TOTALED' : 'BIT DRIFTER'}
              </h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest max-w-xs">Use Arrow Keys to dodge the red blocks. Don't crash!</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-blue-500 hover:text-white transition-all shadow-2xl"
              >
                {gameOver ? 'Try Again' : 'Start Game'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
