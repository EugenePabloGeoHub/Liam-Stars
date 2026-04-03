import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const PulseWave = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [pulseSize, setPulseSize] = useState(0);
  const [targetSize, setTargetSize] = useState(150);
  const [isExpanding, setIsExpanding] = useState(true);
  const requestRef = useRef<number | null>(null);

  const update = useCallback(() => {
    if (!isPlaying) return;
    
    setPulseSize(s => {
      if (isExpanding) {
        if (s >= 300) {
          setIsPlaying(false);
          setGameOver(true);
          return s;
        }
        return s + 2;
      }
      return s;
    });
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, isExpanding, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, update]);

  const handlePulse = () => {
    if (!isPlaying) return;
    
    const diff = Math.abs(pulseSize - targetSize);
    if (diff < 20) {
      setScore(s => s + 1000);
      setPulseSize(0);
      setTargetSize(Math.random() * 150 + 50);
    } else {
      setGameOver(true);
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (gameOver && score > 0) {
      onScoreUpdate(score);
    }
  }, [gameOver, score, onScoreUpdate]);

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setPulseSize(0);
    setTargetSize(150);
  };

  return (
    <div 
      className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden"
      onClick={handlePulse}
    >
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-green-500">{score}</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {isPlaying && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* The Target Ring */}
              <div 
                className="absolute border-4 border-green-500/30 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.1)]"
                style={{ width: targetSize, height: targetSize }}
              />
              
              {/* The Pulse */}
              <motion.div 
                className="absolute border-4 border-green-500 rounded-full shadow-[0_0_50px_#22c55e]"
                style={{ width: pulseSize, height: pulseSize }}
              />
            </div>
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
                {gameOver ? 'OUT OF SYNC' : 'PULSE WAVE'}
              </h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest max-w-xs">Click when the expanding pulse matches the target ring. Don't miss!</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-green-500 hover:text-white transition-all shadow-2xl"
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
