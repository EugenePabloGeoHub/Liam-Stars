import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const GravityBall = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [ballPos, setBallPos] = useState({ x: 50, y: 50 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const obstaclesRef = useRef<{ x: number, y: number, r: number }[]>([]);

  const generateObstacles = useCallback(() => {
    const obs = [];
    for (let i = 0; i < 10; i++) {
      obs.push({
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        r: Math.random() * 5 + 2
      });
    }
    obstaclesRef.current = obs;
  }, []);

  const update = useCallback(() => {
    if (!isPlaying) return;
    
    setBallPos(prev => {
      const newX = Math.max(2, Math.min(98, prev.x + tilt.x * 0.5));
      const newY = Math.max(2, Math.min(98, prev.y + tilt.y * 0.5));
      
      // Check collision with obstacles
      const collision = obstaclesRef.current.some(obs => {
        const dx = newX - obs.x;
        const dy = newY - obs.y;
        return Math.sqrt(dx * dx + dy * dy) < obs.r + 2;
      });

      if (collision) {
        setGameOver(true);
        setIsPlaying(false);
        onScoreUpdate(score);
        return prev;
      }

      setScore(s => s + 1);
      return { x: newX, y: newY };
    });
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, tilt, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': setTilt(t => ({ ...t, y: -1 })); break;
        case 'ArrowDown': setTilt(t => ({ ...t, y: 1 })); break;
        case 'ArrowLeft': setTilt(t => ({ ...t, x: -1 })); break;
        case 'ArrowRight': setTilt(t => ({ ...t, x: 1 })); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': case 'ArrowDown': setTilt(t => ({ ...t, y: 0 })); break;
        case 'ArrowLeft': case 'ArrowRight': setTilt(t => ({ ...t, x: 0 })); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setBallPos({ x: 50, y: 50 });
    generateObstacles();
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Distance</span>
          <span className="text-4xl font-black italic text-pink-500">{Math.floor(score / 10)}m</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
      </div>

      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {isPlaying && (
            <>
              {/* Obstacles */}
              {obstaclesRef.current.map((obs, i) => (
                <motion.div 
                  key={i}
                  className="absolute bg-pink-500/20 border border-pink-500 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.2)]"
                  style={{ 
                    width: `${obs.r * 2}%`, 
                    height: `${obs.r * 2 * (16/9)}%`, // Aspect ratio correction
                    left: `${obs.x}%`,
                    top: `${obs.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              ))}
              {/* The Ball */}
              <motion.div 
                className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_20px_#fff]"
                style={{ 
                  left: `${ballPos.x}%`,
                  top: `${ballPos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            </>
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
                {gameOver ? 'CRASHED' : 'GRAVITY BALL'}
              </h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest max-w-xs">Use Arrow Keys to tilt the board and navigate the ball through the obstacles.</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-pink-500 hover:text-white transition-all shadow-2xl"
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
