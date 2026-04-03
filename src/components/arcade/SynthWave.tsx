import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Zap, Trophy, X } from 'lucide-react';

export const SynthWave = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('synth_high_score') || 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState<{ id: number, lane: number, y: number }[]>([]);
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const lanes = [0, 1, 2, 3];

  useEffect(() => {
    if (isPlaying) {
      const update = (time: number) => {
        if (time - lastSpawnRef.current > 600) {
          setNotes(prev => [...prev, { id: Date.now(), lane: Math.floor(Math.random() * 4), y: -10 }]);
          lastSpawnRef.current = time;
        }

        setNotes(prev => {
          const next = prev.map(n => ({ ...n, y: n.y + 1.5 }));
          const missed = next.find(n => n.y > 100);
          if (missed) {
            setIsPlaying(false);
            return [];
          }
          return next;
        });

        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(frameRef.current);
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);

  const handleTap = (lane: number) => {
    if (!isPlaying) return;
    const hit = notes.find(n => n.lane === lane && n.y > 75 && n.y < 95);
    if (hit) {
      setScore(s => s + 250);
      setNotes(prev => prev.filter(n => n.id !== hit.id));
      // Play a simple sound
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200 + lane * 100, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } else {
      // Missed tap penalty
      setScore(s => Math.max(0, s - 50));
    }
  };

  useEffect(() => {
    if (!isPlaying && score > 0) {
      onScoreUpdate(score);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('synth_high_score', score.toString());
      }
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);

  const startGame = () => {
    setScore(0);
    setNotes([]);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center font-sans overflow-hidden touch-none select-none">
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

      <div className="relative w-full max-w-2xl h-full flex gap-4 px-4">
        {lanes.map(lane => (
          <div key={lane} className="flex-1 relative bg-white/5 border-x border-white/10">
            <div className="absolute bottom-12 left-0 right-0 h-24 bg-white/10 border-y border-white/20 flex items-center justify-center">
              <button 
                onPointerDown={() => handleTap(lane)}
                className="w-full h-full active:bg-purple-500/40 transition-colors"
              />
            </div>
            {notes.filter(n => n.lane === lane).map(n => (
              <motion.div 
                key={n.id}
                className="absolute w-full h-12 bg-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.5)] border-y border-white/20"
                style={{ top: `${n.y}%` }}
              />
            ))}
          </div>
        ))}

        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-20"
            >
              <div className="flex flex-col items-center gap-8 bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
                <div className="w-24 h-24 bg-purple-500 rounded-3xl flex items-center justify-center shadow-2xl transform -rotate-6">
                  <Music className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white mb-2">SYNTH WAVE</h2>
                  <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Tap the notes to the rhythm. Don't miss a single one.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={startGame}
                    className="px-12 py-4 bg-white text-black font-black uppercase italic tracking-tighter rounded-2xl hover:bg-purple-500 hover:text-white transition-all shadow-xl"
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

      {/* Retro Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-purple-500/20 to-transparent" />
        <div className="absolute bottom-0 w-full h-[1px] bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)]" />
      </div>
    </div>
  );
};
