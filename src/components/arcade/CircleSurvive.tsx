import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const CircleSurvive = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [ringPos, setRingPos] = useState({ x: 50, y: 50 });
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
  const [ringSize, setRingSize] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  const update = useCallback((time: number) => {
    if (!isPlaying) return;
    
    timeRef.current = time / 1000;
    const t = timeRef.current;
    
    // Move ring in a complex pattern
    const newX = 50 + Math.sin(t * 1.5) * 30 + Math.cos(t * 0.7) * 10;
    const newY = 50 + Math.cos(t * 1.2) * 30 + Math.sin(t * 0.9) * 10;
    setRingPos({ x: newX, y: newY });
    
    // Shrink ring over time
    setRingSize(s => Math.max(40, 100 - t * 2));
    
    // Check collision
    const dx = playerPos.x - newX;
    const dy = playerPos.y - newY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > ringSize / 10) { // Simple scaling for dist check
      setGameOver(true);
      setIsPlaying(false);
      onScoreUpdate(score);
    } else {
      setScore(s => s + 1);
    }
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, playerPos, ringSize, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, update]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPlaying || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setPlayerPos({
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    });
  };

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setRingSize(100);
    timeRef.current = 0;
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Survival Time</span>
          <span className="text-4xl font-black italic text-yellow-500">{Math.floor(score / 60)}s</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
      </div>

      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        className="relative w-full h-full flex items-center justify-center cursor-none"
      >
        <AnimatePresence>
          {isPlaying && (
            <>
              {/* The Ring */}
              <motion.div 
                className="absolute border-4 border-yellow-500/50 rounded-full shadow-[0_0_50px_rgba(234,179,8,0.2)]"
                style={{ 
                  width: ringSize * 4, 
                  height: ringSize * 4,
                  left: `${ringPos.x}%`,
                  top: `${ringPos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
              {/* The Player */}
              <motion.div 
                className="absolute w-6 h-6 bg-white rounded-full shadow-[0_0_20px_#fff]"
                style={{ 
                  left: `${playerPos.x}%`,
                  top: `${playerPos.y}%`,
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
                {gameOver ? 'OUT OF BOUNDS' : 'CIRCLE SURVIVE'}
              </h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest max-w-xs">Keep your circle inside the moving ring. It gets smaller and faster over time.</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-yellow-500 hover:text-white transition-all shadow-2xl"
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
