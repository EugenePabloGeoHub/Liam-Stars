import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const WORDS = [
  'NEON', 'ARCADE', 'BRAWLER', 'CYBER', 'PULSE', 'GRID', 'VOID', 'SYNTH', 'WAVE', 'PIXEL',
  'GLOW', 'LASER', 'DASH', 'JUMP', 'BLAST', 'SURGE', 'DATA', 'CORE', 'BEAM', 'FLASH'
];

export const SpeedTyper = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [input, setInput] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateWord = useCallback(() => {
    setCurrentWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setInput('');
  }, []);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      onScoreUpdate(score);
    }
  }, [isPlaying, timeLeft, score, onScoreUpdate]);

  useEffect(() => {
    if (isPlaying && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPlaying]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setInput(val);
    if (val === currentWord) {
      setScore(s => s + 100 * multiplier);
      setMultiplier(m => Math.min(5, m + 0.1));
      generateWord();
    }
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setMultiplier(1);
    setIsPlaying(true);
    generateWord();
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-cyan-500">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Time</span>
          <span className="text-4xl font-black italic text-orange-500">{timeLeft}s</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all">Exit</button>
      </div>

      <div className="w-full max-w-xl p-12 bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-2xl flex flex-col items-center gap-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <span className="text-9xl font-black italic">{multiplier.toFixed(1)}x</span>
        </div>

        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div 
              key="game"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-12 w-full"
            >
              <div className="text-center space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-500 animate-pulse">Type the Word</p>
                <motion.h2 
                  key={currentWord}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-8xl font-black uppercase italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                >
                  {currentWord}
                </motion.h2>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInput}
                className="w-full bg-black/60 border-4 border-white/10 rounded-2xl px-8 py-6 text-4xl font-black uppercase italic tracking-widest text-center focus:outline-none focus:border-cyan-500 transition-all shadow-2xl"
                placeholder="..."
              />
            </motion.div>
          ) : (
            <motion.div 
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-8 text-center"
            >
              <h2 className="text-5xl font-black uppercase italic tracking-tighter">SPEED TYPER</h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest">How fast can you type? Each word increases your multiplier.</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-cyan-500 hover:text-white transition-all shadow-2xl"
              >
                {timeLeft === 0 ? 'Try Again' : 'Start Game'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
