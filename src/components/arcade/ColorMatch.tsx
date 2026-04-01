import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = [
  { name: 'RED', value: '#ef4444' },
  { name: 'BLUE', value: '#3b82f6' },
  { name: 'GREEN', value: '#22c55e' },
  { name: 'YELLOW', value: '#eab308' },
  { name: 'PURPLE', value: '#a855f7' },
  { name: 'ORANGE', value: '#f97316' }
];

export const ColorMatch = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWord, setCurrentWord] = useState(COLORS[0]);
  const [currentColor, setCurrentColor] = useState(COLORS[1]);
  const [options, setOptions] = useState(COLORS);

  const generateNew = useCallback(() => {
    const word = COLORS[Math.floor(Math.random() * COLORS.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    setCurrentWord(word);
    setCurrentColor(color);
    setOptions([...COLORS].sort(() => Math.random() - 0.5));
  }, []);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      setIsPlaying(false);
      onScoreUpdate(score);
    }
  }, [isPlaying, timeLeft, score, onScoreUpdate]);

  const handleChoice = (colorValue: string) => {
    if (!isPlaying) return;
    if (colorValue === currentColor.value) {
      setScore(s => s + 100);
      generateNew();
    } else {
      setScore(s => Math.max(0, s - 50));
      generateNew();
    }
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setIsPlaying(true);
    generateNew();
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-blue-500">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Time</span>
          <span className="text-4xl font-black italic text-orange-500">{timeLeft}s</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all">Exit</button>
      </div>

      <div className="w-full max-w-md p-8 bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-2xl flex flex-col items-center gap-12">
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div 
              key="game"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-12 w-full"
            >
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Match the Color, not the Word</p>
                <motion.h2 
                  key={currentWord.name + currentColor.name}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-7xl font-black uppercase italic tracking-tighter"
                  style={{ color: currentColor.value }}
                >
                  {currentWord.name}
                </motion.h2>
              </div>

              <div className="grid grid-cols-3 gap-4 w-full">
                {options.map((color) => (
                  <motion.button
                    key={color.name}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleChoice(color.value)}
                    className="aspect-square rounded-2xl border-4 border-white/10 transition-all shadow-lg"
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-8 text-center"
            >
              <h2 className="text-5xl font-black uppercase italic tracking-tighter">COLOR MATCH</h2>
              <p className="text-white/50 text-sm font-bold uppercase tracking-widest">Click the color that matches the word's color, ignoring the text itself.</p>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-blue-500 hover:text-white transition-all shadow-2xl"
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
