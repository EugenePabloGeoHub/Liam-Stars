import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Zap, Trophy } from 'lucide-react';

export const NeonNeon = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('neon_high_score') || 0));
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      setIsPlaying(false);
      onScoreUpdate(score);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('neon_high_score', score.toString());
      }
    }
  }, [isPlaying, timeLeft, score, highScore, onScoreUpdate]);

  const spawnTarget = () => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setTarget({
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 100) + 50
    });
  };

  const handleHit = () => {
    if (!isPlaying) return;
    setScore(s => s + 100);
    spawnTarget();
    // Play a simple sound
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setIsPlaying(true);
    spawnTarget();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-white tracking-tighter">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Time</span>
          <span className="text-4xl font-black italic text-orange-500 tracking-tighter">{timeLeft}s</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">High Score</span>
          <span className="text-4xl font-black italic text-white/60 tracking-tighter">{highScore}</span>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {isPlaying ? (
            <motion.button
              key="target"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={handleHit}
              className="absolute w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.5)] border-4 border-white/20"
              style={{ left: target.x - 48, top: target.y - 48 }}
            >
              <Target className="w-12 h-12 text-white animate-pulse" />
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-8 bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl"
            >
              <div className="w-24 h-24 bg-orange-500 rounded-3xl flex items-center justify-center shadow-2xl transform -rotate-6">
                <Zap className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white mb-2">NEON NEON</h2>
                <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Test your reflexes. Click the targets.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={startGame}
                  className="px-12 py-4 bg-white text-black font-black uppercase italic tracking-tighter rounded-2xl hover:bg-orange-500 hover:text-white transition-all shadow-xl"
                >
                  {timeLeft === 0 ? 'Try Again' : 'Start Game'}
                </button>
                <button
                  onClick={onExit}
                  className="px-12 py-4 bg-white/5 text-white font-black uppercase italic tracking-tighter rounded-2xl border border-white/10 hover:bg-red-500 transition-all"
                >
                  Exit Arcade
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0%,transparent_70%)]" />
        <div className="grid grid-cols-12 h-full w-full">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="border-r border-white/5 h-full" />
          ))}
        </div>
      </div>
    </div>
  );
};
