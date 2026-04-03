import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, Zap, Trophy, X } from 'lucide-react';

export const PixelJump = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('pixel_high_score') || 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState({ x: 50, y: 80, vy: 0 });
  const [platforms, setPlatforms] = useState<{ id: number, x: number, y: number, w: number }[]>([]);
  const frameRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        setPlayer(p => {
          let nx = p.x;
          if (keys.current['ArrowLeft']) nx -= 1.5;
          if (keys.current['ArrowRight']) nx += 1.5;
          nx = Math.max(0, Math.min(100, nx));

          let nvy = p.vy + 0.15; // gravity
          let ny = p.y + nvy;

          if (ny > 100) {
            setIsPlaying(false);
            return p;
          }

          // Collision check
          setPlatforms(prev => {
            const hit = prev.find(plat => 
              nvy > 0 && 
              ny > plat.y - 2 && 
              ny < plat.y + 2 && 
              nx > plat.x - plat.w/2 && 
              nx < plat.x + plat.w/2
            );
            if (hit) {
              nvy = -5; // jump
              ny = hit.y - 2;
              // Play a simple sound
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(400, audioCtx.currentTime);
              gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.1);
            }
            return prev;
          });

          // Scroll world
          if (ny < 40) {
            const diff = 40 - ny;
            setScore(s => s + Math.floor(diff));
            setPlatforms(prev => {
              const next = prev.map(plat => ({ ...plat, y: plat.y + diff }));
              const filtered = next.filter(plat => plat.y < 110);
              if (filtered.length < 10) {
                filtered.push({
                  id: Date.now() + Math.random(),
                  x: Math.random() * 80 + 10,
                  y: filtered[filtered.length - 1].y - (Math.random() * 15 + 15),
                  w: Math.random() * 10 + 15
                });
              }
              return filtered;
            });
            ny = 40;
          }

          return { x: nx, y: ny, vy: nvy };
        });

        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);

      const handleKeyDown = (e: KeyboardEvent) => keys.current[e.key] = true;
      const handleKeyUp = (e: KeyboardEvent) => keys.current[e.key] = false;
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        cancelAnimationFrame(frameRef.current);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);

  useEffect(() => {
    if (!isPlaying && score > 0) {
      onScoreUpdate(score);
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('pixel_high_score', score.toString());
      }
    }
  }, [isPlaying, score, highScore, onScoreUpdate]);

  const startGame = () => {
    setScore(0);
    setPlayer({ x: 50, y: 80, vy: 0 });
    const initialPlatforms = [];
    for (let i = 0; i < 10; i++) {
      initialPlatforms.push({
        id: i,
        x: i === 0 ? 50 : Math.random() * 80 + 10,
        y: 90 - i * 20,
        w: 20
      });
    }
    setPlatforms(initialPlatforms);
    setIsPlaying(true);
  };

  return (
    <div 
      ref={containerRef}
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

      <div className="relative w-full max-w-xl h-full bg-white/5 border-x border-white/10">
        {platforms.map(plat => (
          <div 
            key={plat.id}
            className="absolute h-4 bg-green-500 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] border border-green-400/50"
            style={{ left: `${plat.x}%`, top: `${plat.y}%`, width: `${plat.w}%`, transform: 'translateX(-50%)' }}
          />
        ))}

        <motion.div 
          className="absolute w-12 h-12 bg-yellow-500 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.5)] border-2 border-white/20 flex items-center justify-center"
          style={{ left: `${player.x}%`, top: `${player.y}%`, transform: 'translate(-50%, -100%)' }}
          animate={{ rotate: player.vy * 5 }}
        >
          <ArrowUp className="w-6 h-6 text-white" />
        </motion.div>

        {/* Mobile Controls */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-between px-8 md:hidden">
          <button 
            onPointerDown={() => keys.current['ArrowLeft'] = true}
            onPointerUp={() => keys.current['ArrowLeft'] = false}
            className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:bg-white/20"
          >
            <ArrowUp className="w-10 h-10 -rotate-90" />
          </button>
          <button 
            onPointerDown={() => keys.current['ArrowRight'] = true}
            onPointerUp={() => keys.current['ArrowRight'] = false}
            className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:bg-white/20"
          >
            <ArrowUp className="w-10 h-10 rotate-90" />
          </button>
        </div>

        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-20"
            >
              <div className="flex flex-col items-center gap-8 bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
                <div className="w-24 h-24 bg-yellow-500 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-6">
                  <ArrowUp className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                  <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white mb-2">PIXEL JUMP</h2>
                  <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Jump higher and higher. Don't fall down.</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={startGame}
                    className="px-12 py-4 bg-white text-black font-black uppercase italic tracking-tighter rounded-2xl hover:bg-yellow-500 hover:text-white transition-all shadow-xl"
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

      {/* Clouds Background */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {[...Array(5)].map((_, i) => (
          <motion.div 
            key={i}
            className="absolute w-64 h-32 bg-white rounded-full blur-3xl"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ x: [0, 100, 0] }}
            transition={{ duration: 10 + Math.random() * 20, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
};
