import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Trophy, X, ChevronRight } from 'lucide-react';

export const VoidDash = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('void_high_score') || 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState({ y: 50, vy: 0 });
  const [obstacles, setObstacles] = useState<{ id: number, x: number, gapY: number, gapH: number }[]>([]);
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlaying) {
      const update = (time: number) => {
        if (time - lastSpawnRef.current > 1500) {
          setObstacles(prev => [...prev, {
            id: Date.now(),
            x: 110,
            gapY: Math.random() * 40 + 20,
            gapH: Math.random() * 10 + 20
          }]);
          lastSpawnRef.current = time;
        }

        setPlayer(p => {
          const nvy = p.vy + 0.1; // gravity
          const ny = p.y + nvy;

          if (ny < 0 || ny > 100) {
            setIsPlaying(false);
            return p;
          }

          // Collision check
          setObstacles(prev => {
            const hit = prev.find(obs => 
              obs.x > 15 && obs.x < 25 && 
              (ny < obs.gapY || ny > obs.gapY + obs.gapH)
            );
            if (hit) {
              setIsPlaying(false);
              return [];
            }
            const next = prev.map(obs => ({ ...obs, x: obs.x - 0.5 }));
            const filtered = next.filter(obs => obs.x > -10);
            if (filtered.length < next.length) setScore(s => s + 100);
            return filtered;
          });

          return { y: ny, vy: nvy };
        });

        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(frameRef.current);
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);

  const handleJump = () => {
    if (!isPlaying) return;
    setPlayer(p => ({ ...p, vy: -3 }));
    // Play a simple sound
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  };

  useEffect(() => {
    if (!isPlaying && score > 0) {
      onScoreUpdate(score);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('void_high_score', score.toString());
      }
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);

  const startGame = () => {
    setScore(0);
    setPlayer({ y: 50, vy: 0 });
    setObstacles([]);
    setIsPlaying(true);
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={handleJump}
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-sans overflow-hidden touch-none select-none"
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
        {obstacles.map(obs => (
          <React.Fragment key={obs.id}>
            <div 
              className="absolute w-16 bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] border-r border-white/20"
              style={{ left: `${obs.x}%`, top: 0, height: `${obs.gapY}%` }}
            />
            <div 
              className="absolute w-16 bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] border-r border-white/20"
              style={{ left: `${obs.x}%`, top: `${obs.gapY + obs.gapH}%`, bottom: 0 }}
            />
          </React.Fragment>
        ))}

        <motion.div 
          className="absolute left-[20%] w-12 h-12 bg-white rounded-full shadow-[0_0_30px_rgba(255,255,255,0.5)] border-2 border-cyan-500 flex items-center justify-center"
          style={{ top: `${player.y}%`, transform: 'translate(-50%, -50%)' }}
          animate={{ rotate: player.vy * 10 }}
        >
          <Zap className="w-6 h-6 text-cyan-500" />
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
                <div className="w-24 h-24 bg-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl transform -rotate-6">
                  <Zap className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white mb-2">VOID DASH</h2>
                  <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Tap to jump. Avoid the neon pillars.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={startGame}
                    className="px-12 py-4 bg-white text-black font-black uppercase italic tracking-tighter rounded-2xl hover:bg-cyan-500 hover:text-white transition-all shadow-xl"
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

      {/* Speed Lines Background */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {[...Array(20)].map((_, i) => (
          <motion.div 
            key={i}
            className="absolute h-[1px] bg-white"
            style={{ 
              left: `${Math.random() * 100}%`, 
              top: `${Math.random() * 100}%`, 
              width: `${Math.random() * 100 + 50}px` 
            }}
            animate={{ x: [-100, 2000] }}
            transition={{ duration: 0.5 + Math.random() * 1, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>
    </div>
  );
};
