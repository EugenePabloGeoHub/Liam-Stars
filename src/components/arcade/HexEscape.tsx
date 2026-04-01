import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const HexEscape = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [walls, setWalls] = useState<{ size: number, gap: number }[]>([]);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  const update = useCallback((time: number) => {
    if (!isPlaying) return;
    
    timeRef.current = time / 1000;
    const t = timeRef.current;
    
    setWalls(prev => {
      const newWalls = prev.map(w => ({ ...w, size: w.size - 2 })).filter(w => w.size > 0);
      
      // Spawn new wall
      if (t % 2 < 0.02) {
        newWalls.push({ size: 400, gap: Math.floor(Math.random() * 6) });
      }
      
      // Check collision
      const playerAngle = ((rotation % 360) + 360) % 360;
      const playerSegment = Math.floor(playerAngle / 60);
      
      const collision = newWalls.some(w => {
        return w.size < 60 && w.size > 40 && w.gap !== playerSegment;
      });

      if (collision) {
        setGameOver(true);
        setIsPlaying(false);
        onScoreUpdate(score);
        return prev;
      }

      setScore(s => s + 1);
      return newWalls;
    });
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, rotation, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setRotation(r => r - 20);
      if (e.key === 'ArrowRight') setRotation(r => r + 20);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setWalls([]);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-red-500">{score}</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {isPlaying && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* The Player */}
              <motion.div 
                className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_20px_#fff] z-20"
                style={{ 
                  transform: `rotate(${rotation}deg) translateY(-50px)`
                }}
              />
              {/* The Hexagon Center */}
              <div className="w-20 h-20 border-4 border-red-500/50 rounded-full animate-pulse" />
              
              {/* The Walls */}
              {walls.map((w, i) => (
                <div 
                  key={i}
                  className="absolute border-4 border-red-500/30 transition-all duration-100"
                  style={{ 
                    width: w.size, 
                    height: w.size,
                    borderRadius: '20%',
                    transform: `rotate(${w.gap * 60}deg)`
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
                {gameOver ? 'TRAPPED' : 'HEX ESCAPE'}
              </h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest max-w-xs">Use Arrow Keys to rotate. Escape through the gaps in the closing hexagons.</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-2xl"
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
