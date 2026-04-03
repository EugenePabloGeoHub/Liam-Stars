import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, X, Zap } from 'lucide-react';

const PADDLE_HEIGHT = 80;
const PADDLE_WIDTH = 10;
const BALL_SIZE = 10;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

interface PongState {
  p1: number;
  p2: number;
  ball: { x: number, y: number, vx: number, vy: number };
  score: { p1: number, p2: number };
}

export const OnlinePong = ({ 
  onExit, 
  onScoreUpdate, 
  socket, 
  playerId, 
  roomId,
  isHost
}: { 
  onExit: () => void, 
  onScoreUpdate: (score: number) => void,
  socket: WebSocket | null,
  playerId: string,
  roomId: string,
  isHost: boolean
}) => {
  const [gameState, setGameState] = useState<PongState>({
    p1: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    p2: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 4, vy: 4 },
    score: { p1: 0, p2: 0 }
  });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const update = useCallback((time: number) => {
    if (gameOver || !socket || socket.readyState !== WebSocket.OPEN) return;

    if (isHost) {
      setGameState(prev => {
        let { x, y, vx, vy } = prev.ball;
        let { p1, p2 } = prev.score;

        x += vx;
        y += vy;

        // Wall bounce
        if (y <= 0 || y >= CANVAS_HEIGHT - BALL_SIZE) vy *= -1;

        // Paddle collision P1
        if (x <= PADDLE_WIDTH && y + BALL_SIZE >= prev.p1 && y <= prev.p1 + PADDLE_HEIGHT) {
          x = PADDLE_WIDTH;
          vx *= -1.1; // Speed up
          vy += (Math.random() - 0.5) * 2;
        }

        // Paddle collision P2
        if (x >= CANVAS_WIDTH - PADDLE_WIDTH - BALL_SIZE && y + BALL_SIZE >= prev.p2 && y <= prev.p2 + PADDLE_HEIGHT) {
          x = CANVAS_WIDTH - PADDLE_WIDTH - BALL_SIZE;
          vx *= -1.1;
          vy += (Math.random() - 0.5) * 2;
        }

        // Scoring
        if (x <= 0) {
          p2 += 1;
          x = CANVAS_WIDTH / 2;
          y = CANVAS_HEIGHT / 2;
          vx = 4;
          vy = (Math.random() - 0.5) * 8;
        } else if (x >= CANVAS_WIDTH) {
          p1 += 1;
          x = CANVAS_WIDTH / 2;
          y = CANVAS_HEIGHT / 2;
          vx = -4;
          vy = (Math.random() - 0.5) * 8;
        }

        const newState = { ...prev, ball: { x, y, vx, vy }, score: { p1, p2 } };
        
        // Sync with server
        if (time - lastUpdateRef.current > 30) {
          socket.send(JSON.stringify({
            type: "PONG_SYNC",
            roomId,
            state: newState
          }));
          lastUpdateRef.current = time;
        }

        if (p1 >= 5 || p2 >= 5) {
          setGameOver(true);
          setWinner(p1 >= 5 ? "Player 1" : "Player 2");
          onScoreUpdate(p1 >= 5 ? 1000 : 500);
        }

        return newState;
      });
    }

    requestRef.current = requestAnimationFrame(update);
  }, [isHost, socket, roomId, gameOver, onScoreUpdate]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "PONG_UPDATE" && !isHost) {
        setGameState(data.state);
      }
      if (data.type === "PONG_PADDLE_UPDATE") {
        setGameState(prev => ({
          ...prev,
          [data.player === "p1" ? "p1" : "p2"]: data.pos
        }));
      }
    };

    socket.addEventListener("message", handleMessage);
    requestRef.current = requestAnimationFrame(update);

    return () => {
      socket.removeEventListener("message", handleMessage);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [socket, isHost, update]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gameOver || !socket) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top - PADDLE_HEIGHT / 2;
    const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, y));
    
    const playerKey = isHost ? "p1" : "p2";
    setGameState(prev => ({ ...prev, [playerKey]: clampedY }));
    
    socket.send(JSON.stringify({
      type: "PONG_PADDLE",
      roomId,
      player: playerKey,
      pos: clampedY
    }));
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Match Score</span>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-black italic text-blue-500">{gameState.score.p1}</span>
            <span className="text-xl font-black text-white/20">:</span>
            <span className="text-4xl font-black italic text-red-500">{gameState.score.p2}</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="px-4 py-1 bg-white/5 border border-white/10 rounded-full text-[8px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
            {isHost ? "Host (P1)" : "Guest (P2)"}
          </div>
          <button onClick={onExit} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500 transition-all pointer-events-auto">Exit</button>
        </div>
      </div>

      <div 
        className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden cursor-none"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
        onMouseMove={handleMouseMove}
      >
        {/* Center Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 border-l border-dashed border-white/10" />

        {/* Paddles */}
        <motion.div 
          className="absolute left-0 w-2.5 bg-blue-500 shadow-[0_0_20px_#3b82f6]"
          style={{ height: PADDLE_HEIGHT, top: gameState.p1 }}
        />
        <motion.div 
          className="absolute right-0 w-2.5 bg-red-500 shadow-[0_0_20px_#ef4444]"
          style={{ height: PADDLE_HEIGHT, top: gameState.p2 }}
        />

        {/* Ball */}
        <motion.div 
          className="absolute bg-white rounded-full shadow-[0_0_15px_#fff]"
          style={{ 
            width: BALL_SIZE, 
            height: BALL_SIZE, 
            left: gameState.ball.x, 
            top: gameState.ball.y 
          }}
        />

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20"
            >
              <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-white mb-2">{winner} Wins!</h2>
              <button 
                onClick={onExit}
                className="mt-6 px-12 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-blue-500 hover:text-white transition-all shadow-2xl"
              >
                Return to Lobby
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">
        Move mouse to control paddle • First to 5 wins
      </div>
    </div>
  );
};
