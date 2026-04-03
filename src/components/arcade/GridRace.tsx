import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Target, Zap, X } from 'lucide-react';

interface GridRaceProps {
  onExit: () => void;
  onScoreUpdate: (score: number) => void;
  socket: WebSocket | null;
  playerId: string;
  roomId: string;
  isHost: boolean;
  opponentName: string;
}

export const GridRace: React.FC<GridRaceProps> = ({ onExit, onScoreUpdate, socket, playerId, roomId, isHost, opponentName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameover'>('waiting');
  const [winner, setWinner] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  
  const playerPosRef = useRef({ x: 100, y: 300 });
  const opponentPosRef = useRef({ x: 100, y: 300 });
  const obstaclesRef = useRef<{ x: number, y: number, width: number, height: number }[]>([]);
  const lastSyncRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.type === "GAME_UPDATE") {
        if (data.state.pos) {
          opponentPosRef.current = data.state.pos;
        }
        if (data.state.obstacles) {
          obstaclesRef.current = data.state.obstacles;
        }
        if (data.state.gameOver) {
          setGameState('gameover');
          setWinner(data.state.winner);
        }
        if (data.state.score !== undefined) {
          setScore(data.state.score);
        }
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, playerId]);

  useEffect(() => {
    setGameState('playing');

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrame: number;
    let frameCount = 0;
    const update = () => {
      const canvas = canvasRef.current;
      if (!canvas || gameState !== 'playing') return;

      frameCount++;
      const me = playerPosRef.current;

      // Movement
      const speed = 5;
      if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) me.y -= speed;
      if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) me.y += speed;
      
      me.y = Math.max(50, Math.min(550, me.y));

      // Obstacle generation (Host only)
      if (isHost && frameCount % 60 === 0) {
        obstaclesRef.current.push({
          x: 800,
          y: Math.random() * 500 + 50,
          width: 40,
          height: 100
        });
      }

      // Update obstacles
      obstaclesRef.current = obstaclesRef.current.filter(obs => {
        obs.x -= 8;
        
        // Collision check
        if (Math.abs(obs.x - me.x) < 30 && Math.abs(obs.y - me.y) < 60) {
          socket?.send(JSON.stringify({
            type: "GAME_SYNC",
            roomId,
            state: { gameOver: true, winner: "Opponent" }
          }));
          setGameState('gameover');
          setWinner("Opponent");
        }

        return obs.x > -100;
      });

      // Sync
      if (Date.now() - lastSyncRef.current > 50) {
        const syncData: any = { pos: me };
        if (isHost) syncData.obstacles = obstaclesRef.current;
        socket?.send(JSON.stringify({
          type: "GAME_SYNC",
          roomId,
          state: syncData
        }));
        lastSyncRef.current = Date.now();
      }

      // Draw
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 800, 600);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 800; i += 50) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 600);
          ctx.stroke();
        }
        for (let i = 0; i < 600; i += 50) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(800, i);
          ctx.stroke();
        }

        // Draw players
        const drawPlayer = (p: { x: number, y: number }, color: string, isMe: boolean) => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(20, 0);
          ctx.lineTo(-10, 15);
          ctx.lineTo(-10, -15);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };

        drawPlayer(me, '#06b6d4', true);
        drawPlayer(opponentPosRef.current, '#f97316', false);

        // Draw obstacles
        obstaclesRef.current.forEach(obs => {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ef4444';
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(obs.x - obs.width/2, obs.y - obs.height/2, obs.width, obs.height);
        });
      }

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, playerId, isHost, roomId, socket]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black/90 backdrop-blur-3xl p-8">
      <div className="relative bg-black border-4 border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-cyan-500/20">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600}
          className="max-w-full h-auto"
        />

        <AnimatePresence>
          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white mb-4">
                {winner === "Opponent" ? "Defeat" : "Victory"}
              </h2>
              <button 
                onClick={onExit}
                className="px-8 py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-cyan-500 hover:text-white transition-all"
              >
                Back to Lobby
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-6 left-6 flex items-center gap-4">
          <button 
            onClick={onExit}
            className="p-3 bg-white/5 hover:bg-red-500 rounded-2xl transition-all group"
          >
            <X className="w-6 h-6 text-white/40 group-hover:text-white" />
          </button>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Grid Race</p>
          </div>
        </div>
      </div>
    </div>
  );
};
