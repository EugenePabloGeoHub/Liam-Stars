import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { LayoutGrid, RotateCcw, Trophy, X, Sparkles } from 'lucide-react';

const GRID_SIZE = 8;
const CELL_SIZE = 44; // px
const SHAPES = [
  { id: 1, color: '#3b82f6', matrix: [[1, 1], [1, 1]] }, // Square
  { id: 2, color: '#ef4444', matrix: [[1, 1, 1, 1]] }, // Horizontal Line 4
  { id: 3, color: '#ef4444', matrix: [[1], [1], [1], [1]] }, // Vertical Line 4
  { id: 4, color: '#a855f7', matrix: [[1, 1, 1], [0, 1, 0]] }, // T-Shape
  { id: 5, color: '#22c55e', matrix: [[1, 0], [1, 0], [1, 1]] }, // L-Shape
  { id: 6, color: '#eab308', matrix: [[1, 1, 1], [1, 0, 0]] }, // Reverse L
  { id: 7, color: '#f97316', matrix: [[1, 1, 0], [0, 1, 1]] }, // Z-Shape
  { id: 8, color: '#06b6d4', matrix: [[1, 1, 1]] }, // Horizontal Line 3
  { id: 9, color: '#06b6d4', matrix: [[1], [1], [1]] }, // Vertical Line 3
  { id: 10, color: '#ec4899', matrix: [[1, 1], [1, 0]] }, // Small L
  { id: 11, color: '#f43f5e', matrix: [[1]] }, // Single Block
];

interface ShapeInstance {
  id: number;
  color: string;
  matrix: number[][];
  used: boolean;
}

export const BlockBlast = ({ onExit, onScoreUpdate }: { onExit: () => void, onScoreUpdate: (score: number) => void }) => {
  const [grid, setGrid] = useState<(string | null)[][]>(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('block_high_score') || 0));
  const [gameOver, setGameOver] = useState(false);
  const [currentShapes, setCurrentShapes] = useState<ShapeInstance[]>([]);
  const [preview, setPreview] = useState<{ r: number, c: number, shape: ShapeInstance } | null>(null);
  
  const gridRef = useRef<HTMLDivElement>(null);

  const generateShapes = useCallback(() => {
    const newShapes = [];
    for (let i = 0; i < 3; i++) {
      const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      newShapes.push({ ...template, id: Date.now() + i, used: false });
    }
    setCurrentShapes(newShapes);
  }, []);

  useEffect(() => {
    generateShapes();
  }, [generateShapes]);

  const canPlace = (matrix: number[][], row: number, col: number, currentGrid: (string | null)[][]) => {
    if (row < 0 || col < 0 || row + matrix.length > GRID_SIZE || col + matrix[0].length > GRID_SIZE) return false;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] === 1 && currentGrid[row + r][col + c] !== null) return false;
      }
    }
    return true;
  };

  const placeShape = (shape: ShapeInstance, row: number, col: number) => {
    if (!canPlace(shape.matrix, row, col, grid)) return;

    const newGrid = grid.map(r => [...r]);
    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (shape.matrix[r][c] === 1) {
          newGrid[row + r][col + c] = shape.color;
        }
      }
    }

    // Check for completed lines
    const rowsToClear: number[] = [];
    const colsToClear: number[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      if (newGrid[r].every(cell => cell !== null)) rowsToClear.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let isFull = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (newGrid[r][c] === null) {
          isFull = false;
          break;
        }
      }
      if (isFull) colsToClear.push(c);
    }

    rowsToClear.forEach(r => {
      for (let c = 0; c < GRID_SIZE; c++) newGrid[r][c] = null;
    });
    colsToClear.forEach(c => {
      for (let r = 0; r < GRID_SIZE; r++) newGrid[r][c] = null;
    });

    const linesCleared = rowsToClear.length + colsToClear.length;
    const blockCount = shape.matrix.flat().filter(x => x === 1).length;
    const points = (blockCount * 10) + (linesCleared * 100 * (linesCleared > 1 ? linesCleared : 1));
    
    setGrid(newGrid);
    setScore(s => s + points);

    const nextShapes = currentShapes.map(s => s.id === shape.id ? { ...s, used: true } : s);
    setCurrentShapes(nextShapes);

    if (nextShapes.every(s => s.used)) {
      generateShapes();
    }

    checkGameOver(newGrid, nextShapes.every(s => s.used) ? SHAPES.map(s => ({ ...s, used: false, id: 0 })) : nextShapes.filter(s => !s.used), score + points);
  };

  const checkGameOver = (currentGrid: (string | null)[][], shapesToCheck: any[], currentScore: number) => {
    let possibleMove = false;
    shapesToCheck.forEach(shape => {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlace(shape.matrix, r, c, currentGrid)) {
            possibleMove = true;
            break;
          }
        }
        if (possibleMove) break;
      }
    });

    if (!possibleMove) {
      setGameOver(true);
      onScoreUpdate(currentScore);
      if (currentScore > highScore) {
        setHighScore(currentScore);
        localStorage.setItem('block_high_score', currentScore.toString());
      }
    }
  };

  const handleDrag = (event: any, info: any, shape: ShapeInstance) => {
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    
    // Calculate which cell the top-left of the shape is over
    // We want the shape to be centered or offset slightly above the finger/mouse
    const x = info.point.x - gridRect.left;
    const y = info.point.y - gridRect.top - 60; // Offset to see block above finger

    const col = Math.round(x / CELL_SIZE);
    const row = Math.round(y / CELL_SIZE);

    if (canPlace(shape.matrix, row, col, grid)) {
      setPreview({ r: row, c: col, shape });
    } else {
      setPreview(null);
    }
  };

  const handleDragEnd = (event: any, info: any, shape: ShapeInstance) => {
    if (preview) {
      placeShape(shape, preview.r, preview.c);
      setPreview(null);
    }
  };

  const resetGame = () => {
    setGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
    setScore(0);
    setGameOver(false);
    generateShapes();
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0c] z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Current Score</span>
          <motion.span 
            key={score}
            initial={{ scale: 1.2, color: '#fff' }}
            animate={{ scale: 1, color: '#fff' }}
            className="text-5xl font-black italic tracking-tighter"
          >
            {score}
          </motion.span>
        </div>

        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          <div className="px-6 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl flex items-center gap-3 shadow-2xl">
            <LayoutGrid className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black uppercase tracking-widest text-white/80 italic">Neon Blast</span>
          </div>
          <button 
            onClick={onExit}
            className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-500 transition-colors"
          >
            Exit Game
          </button>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Best Record</span>
          <span className="text-4xl font-black italic tracking-tighter text-white/40">{highScore}</span>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative flex flex-col items-center gap-16 mt-12">
        {/* Grid Container */}
        <div className="relative p-3 bg-[#1a1a1e] rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5">
          <div 
            ref={gridRef}
            className="grid grid-cols-8 gap-1.5 p-1"
            style={{ width: GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * 6, height: GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * 6 }}
          >
            {grid.map((row, r) => (
              row.map((cell, c) => {
                const isPreview = preview && 
                  r >= preview.r && r < preview.r + preview.shape.matrix.length &&
                  c >= preview.c && c < preview.c + preview.shape.matrix[0].length &&
                  preview.shape.matrix[r - preview.r][c - preview.c] === 1;

                return (
                  <div
                    key={`${r}-${c}`}
                    className="relative w-[44px] h-[44px] rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor: cell || (isPreview ? `${preview.shape.color}44` : 'rgba(255,255,255,0.03)'),
                      border: cell ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.02)',
                      boxShadow: cell ? `0 0 15px ${cell}44` : 'none'
                    }}
                  >
                    {cell && (
                      <div className="absolute inset-1 bg-white/10 rounded-md blur-[1px]" />
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Shapes Dock */}
        <div className="flex gap-8 items-center justify-center min-h-[140px]">
          {currentShapes.map((shape, i) => (
            <div key={shape.id} className="relative w-32 h-32 flex items-center justify-center">
              {!shape.used && (
                <motion.div
                  drag
                  dragSnapToOrigin
                  onDrag={(e, info) => handleDrag(e, info, shape)}
                  onDragEnd={(e, info) => handleDragEnd(e, info, shape)}
                  whileDrag={{ scale: 1.1, zIndex: 100 }}
                  className="cursor-grab active:cursor-grabbing touch-none"
                >
                  <div 
                    className="grid gap-1"
                    style={{ 
                      gridTemplateColumns: `repeat(${shape.matrix[0].length}, 1fr)`,
                      transform: 'scale(0.8)'
                    }}
                  >
                    {shape.matrix.map((row, r) => (
                      row.map((cell, c) => (
                        <div
                          key={`${r}-${c}`}
                          className="w-8 h-8 rounded-md"
                          style={{
                            backgroundColor: cell === 1 ? shape.color : 'transparent',
                            border: cell === 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                            boxShadow: cell === 1 ? `0 0 10px ${shape.color}44` : 'none'
                          }}
                        />
                      ))
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-8"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1e] border border-white/10 p-12 rounded-[4rem] text-center max-w-md w-full shadow-[0_0_100px_rgba(0,0,0,0.8)]"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/20">
                <X className="w-12 h-12 text-white" />
              </div>
              
              <h2 className="text-6xl font-black uppercase italic tracking-tighter text-white mb-2">BLASTED!</h2>
              <p className="text-white/40 font-bold uppercase tracking-[0.3em] text-[10px] mb-10">No more moves available</p>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Score</p>
                  <p className="text-3xl font-black italic text-white">{score}</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Best</p>
                  <p className="text-3xl font-black italic text-white/60">{highScore}</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={resetGame}
                  className="w-full py-6 bg-white text-black font-black uppercase italic tracking-tighter rounded-[2rem] hover:bg-cyan-400 hover:text-black transition-all shadow-xl flex items-center justify-center gap-3 text-xl"
                >
                  <RotateCcw className="w-6 h-6" />
                  Restart
                </button>
                <button
                  onClick={onExit}
                  className="w-full py-4 text-white/40 font-black uppercase tracking-widest text-xs hover:text-white transition-colors"
                >
                  Back to Arcade
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full" />
      </div>
    </div>
  );
};

