import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const NeonPaddle = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [ballPos, setBallPos] = useState({ x: 50, y: 50 });
  const [ballVel, setBallVel] = useState({ x: 0.5, y: -0.5 });
  const [paddlePos, setPaddlePos] = useState(50);
  const requestRef = useRef<number | null>(null);

  const update = useCallback(() => {
    if (!isPlaying) return;
    
    setBallPos(prev => {
      let newX = prev.x + ballVel.x;
      let newY = prev.y + ballVel.y;
      let newVelX = ballVel.x;
      let newVelY = ballVel.y;

      // Wall bounce
      if (newX <= 2 || newX >= 98) newVelX *= -1;
      if (newY <= 2) newVelY *= -1;

      // Paddle bounce
      if (newY >= 90 && newY <= 92 && newX >= paddlePos - 10 && newX <= paddlePos + 10) {
        newVelY = -Math.abs(newVelY) * 1.05; // Speed up slightly
        setScore(s => s + 100);
      }

      // Game over
      if (newY >= 100) {
        setGameOver(true);
        setIsPlaying(false);
        onScoreUpdate(score);
        return prev;
      }

      setBallVel({ x: newVelX, y: newVelY });
      return { x: newX, y: newY };
    });
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, ballVel, paddlePos, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, update]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPlaying) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = (clientX / window.innerWidth) * 100;
    setPaddlePos(Math.max(10, Math.min(90, x)));
  };

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setBallPos({ x: 50, y: 50 });
    setBallVel({ x: 0.5, y: -0.5 });
  };

  return (
    <div 
      className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden cursor-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
    >
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-cyan-400">{score}</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
      </div>

      <AnimatePresence>
        {isPlaying && (
          <>
            {/* The Ball */}
            <motion.div 
              className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_20px_#fff]"
              style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transform: 'translate(-50%, -50%)' }}
            />
            {/* The Paddle */}
            <motion.div 
              className="absolute h-3 bg-cyan-500 rounded-full shadow-[0_0_30px_#06b6d4]"
              style={{ width: '20%', left: `${paddlePos}%`, top: '92%', transform: 'translateX(-50%)' }}
            />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isPlaying && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-8 text-center bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl z-20 pointer-events-auto"
          >
            <h2 className="text-5xl font-black uppercase italic tracking-tighter">
              {gameOver ? 'MISSED' : 'NEON PADDLE'}
            </h2>
            <p className="text-white/50 text-sm font-bold uppercase tracking-widest max-w-xs">Move your mouse or finger to slide the paddle. Don't let the ball fall!</p>
            <button 
              onClick={startGame}
              className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-cyan-500 hover:text-white transition-all shadow-2xl"
            >
              {gameOver ? 'Try Again' : 'Start Game'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
