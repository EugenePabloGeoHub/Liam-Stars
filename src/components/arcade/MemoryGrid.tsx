import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const GRID_SIZE = 4;
const INITIAL_SEQUENCE_LENGTH = 3;

export const MemoryGrid = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [score, setScore] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [isShowingSequence, setIsShowingSequence] = useState(false);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [level, setLevel] = useState(1);

  const generateSequence = useCallback((len: number) => {
    const newSeq = [];
    for (let i = 0; i < len; i++) {
      newSeq.push(Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE)));
    }
    setSequence(newSeq);
    showSequence(newSeq);
  }, []);

  const showSequence = async (seq: number[]) => {
    setIsShowingSequence(true);
    setUserSequence([]);
    for (let i = 0; i < seq.length; i++) {
      setActiveTile(seq[i]);
      await new Promise(r => setTimeout(r, 600));
      setActiveTile(null);
      await new Promise(r => setTimeout(r, 200));
    }
    setIsShowingSequence(false);
  };

  const handleTileClick = (index: number) => {
    if (isShowingSequence || gameOver) return;
    
    const newUserSeq = [...userSequence, index];
    setUserSequence(newUserSeq);

    if (index !== sequence[userSequence.length]) {
      setGameOver(true);
      return;
    }

    if (newUserSeq.length === sequence.length) {
      setScore(s => s + level * 500);
      setLevel(l => l + 1);
      setTimeout(() => generateSequence(INITIAL_SEQUENCE_LENGTH + level), 1000);
    }
  };

  useEffect(() => {
    if (gameOver && score > 0) {
      onScoreUpdate(score);
    }
  }, [gameOver, score, onScoreUpdate]);

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setGameOver(false);
    generateSequence(INITIAL_SEQUENCE_LENGTH);
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-purple-500">{score}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Level</span>
          <span className="text-4xl font-black italic text-white">{level}</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all">Exit</button>
      </div>

      <div className="w-full max-w-md p-8 flex flex-col items-center gap-8">
        <div className="grid grid-cols-4 gap-4 w-full aspect-square">
          {[...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTileClick(i)}
              className={`aspect-square rounded-2xl border-2 transition-all duration-300 ${
                activeTile === i ? 'bg-purple-500 border-white shadow-[0_0_30px_#a855f7]' : 
                'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {gameOver ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-red-500">MEMORY FAILED</h2>
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-purple-500 hover:text-white transition-all shadow-2xl"
              >
                Try Again
              </button>
            </motion.div>
          ) : sequence.length === 0 && (
            <button 
              onClick={startGame}
              className="px-12 py-4 bg-purple-500 text-white font-black uppercase italic rounded-2xl hover:scale-105 transition-all shadow-2xl"
            >
              Start Game
            </button>
          )}
        </AnimatePresence>

        {isShowingSequence && (
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 animate-pulse">Watch Closely...</p>
        )}
      </div>
    </div>
  );
};
