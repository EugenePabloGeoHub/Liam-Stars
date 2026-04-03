import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Target, Shield, X } from 'lucide-react';

interface Player {
  x: number;
  y: number;
  health: number;
  angle: number;
}

interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
}

interface NeonDuelProps {
  onExit: () => void;
  onScoreUpdate: (score: number) => void;
  socket: WebSocket | null;
  playerId: string;
  roomId: string;
  isHost: boolean;
}

export const NeonDuel: React.FC<NeonDuelProps> = ({ onExit, onScoreUpdate, socket, playerId, roomId, isHost }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameover'>('waiting');
  const [winner, setWinner] = useState<string | null>(null);
  
  const playersRef = useRef<Record<string, Player>>({});
  const bulletsRef = useRef<Bullet[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.type === "GAME_UPDATE") {
        const { players, bullets } = data.state;
        if (players) {
          Object.keys(players).forEach(id => {
            if (id !== playerId) {
              playersRef.current[id] = players[id];
            }
          });
        }
        if (bullets) {
          // Only sync bullets from opponent
          const opponentBullets = bullets.filter((b: Bullet) => b.ownerId !== playerId);
          const myBullets = bulletsRef.current.filter(b => b.ownerId === playerId);
          bulletsRef.current = [...myBullets, ...opponentBullets];
        }
        if (data.state.gameOver) {
          setGameState('gameover');
          setWinner(data.state.winner);
        }
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, playerId]);

  useEffect(() => {
    playersRef.current[playerId] = {
      x: isHost ? 100 : 700,
      y: 300,
      health: 100,
      angle: 0
    };
    setGameState('playing');

    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrame: number;
    const update = () => {
      const canvas = canvasRef.current;
      if (!canvas || gameState !== 'playing') return;

      const me = playersRef.current[playerId];
      if (!me) return;

      // Movement
      const speed = 5;
      if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) me.y -= speed;
      if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) me.y += speed;
      if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) me.x -= speed;
      if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) me.x += speed;

      // Boundary check
      me.x = Math.max(20, Math.min(780, me.x));
      me.y = Math.max(20, Math.min(580, me.y));

      // Shooting
      if (keysRef.current.has('Space') && Date.now() - lastSyncRef.current > 200) {
        const bulletId = Math.random().toString(36).substring(7);
        bulletsRef.current.push({
          id: bulletId,
          x: me.x,
          y: me.y,
          vx: Math.cos(me.angle) * 10,
          vy: Math.sin(me.angle) * 10,
          ownerId: playerId
        });
        lastSyncRef.current = Date.now();
      }

      // Update bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.x += b.vx;
        b.y += b.vy;
        
        // Collision with me
        if (b.ownerId !== playerId) {
          const dist = Math.hypot(b.x - me.x, b.y - me.y);
          if (dist < 20) {
            me.health -= 10;
            if (me.health <= 0) {
              socket?.send(JSON.stringify({
                type: "GAME_SYNC",
                roomId,
                state: { gameOver: true, winner: "Opponent" }
              }));
              setGameState('gameover');
              setWinner("Opponent");
            }
            return false;
          }
        }

        return b.x > 0 && b.x < 800 && b.y > 0 && b.y < 600;
      });

      // Sync
      if (Date.now() - lastSyncRef.current > 50) {
        socket?.send(JSON.stringify({
          type: "GAME_SYNC",
          roomId,
          state: {
            players: { [playerId]: me },
            bullets: bulletsRef.current.filter(b => b.ownerId === playerId)
          }
        }));
      }

      // Draw
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 800, 600);
        
        // Draw players
        Object.entries(playersRef.current).forEach(([id, p]) => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          
          ctx.shadowBlur = 15;
          ctx.shadowColor = id === playerId ? '#06b6d4' : '#f97316';
          ctx.strokeStyle = id === playerId ? '#06b6d4' : '#f97316';
          ctx.lineWidth = 3;
          
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-10, 10);
          ctx.lineTo(-10, -10);
          ctx.closePath();
          ctx.stroke();
          
          // Health bar
          ctx.restore();
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(p.x - 20, p.y - 30, 40, 5);
          ctx.fillStyle = id === playerId ? '#06b6d4' : '#f97316';
          ctx.fillRect(p.x - 20, p.y - 30, (p.health / 100) * 40, 5);
        });

        // Draw bullets
        bulletsRef.current.forEach(b => {
          ctx.shadowBlur = 10;
          ctx.shadowColor = b.ownerId === playerId ? '#06b6d4' : '#f97316';
          ctx.fillStyle = b.ownerId === playerId ? '#06b6d4' : '#f97316';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const me = playersRef.current[playerId];
      if (me) {
        me.angle = Math.atan2(my - me.y, mx - me.x);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
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
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Neon Duel</p>
          </div>
        </div>
      </div>
    </div>
  );
};
