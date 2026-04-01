import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };

export const NeonSnake = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  const generateFood = useCallback((currentSnake: {x: number, y: number}[]) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      if (!currentSnake.some(segment => segment.x === newFood?.x && segment.y === newFood?.y)) break;
    }
    setFood(newFood);
  }, []);

  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE
      };

      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        setIsPaused(true);
        onScoreUpdate(score);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 100);
        generateFood(newSnake);
      } else {
        newSnake.pop();
      }
      return newSnake;
    });
  }, [direction, food, score, generateFood, onScoreUpdate]);

  useEffect(() => {
    if (!isPaused && !gameOver) {
      gameLoopRef.current = setInterval(moveSnake, 150);
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [isPaused, gameOver, moveSnake]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
        case ' ': setIsPaused(p => !p); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Score</span>
          <span className="text-4xl font-black italic text-green-500">{score}</span>
        </div>
        <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all">Exit</button>
      </div>

      <div className="relative bg-white/5 border border-white/10 p-1 rounded-xl shadow-2xl">
        <div 
          className="grid gap-px bg-white/5" 
          style={{ 
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            width: 'min(80vw, 500px)',
            height: 'min(80vw, 500px)'
          }}
        >
          {[...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isSnake = snake.some(s => s.x === x && s.y === y);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isFood = food.x === x && food.y === y;

            return (
              <div 
                key={i} 
                className={`rounded-sm transition-all duration-200 ${
                  isHead ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 
                  isSnake ? 'bg-green-600/50' : 
                  isFood ? 'bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse' : 
                  'bg-transparent'
                }`}
              />
            );
          })}
        </div>

        <AnimatePresence>
          {(isPaused || gameOver) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl"
            >
              <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
                {gameOver ? 'GAME OVER' : 'PAUSED'}
              </h2>
              <button 
                onClick={() => {
                  if (gameOver) {
                    setSnake(INITIAL_SNAKE);
                    setDirection(INITIAL_DIRECTION);
                    setScore(0);
                    setGameOver(false);
                  }
                  setIsPaused(false);
                }}
                className="px-8 py-3 bg-green-500 text-black font-black uppercase italic rounded-xl hover:scale-105 transition-all"
              >
                {gameOver ? 'RESTART' : 'RESUME'}
              </button>
              <p className="mt-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Use Arrow Keys to Move</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
