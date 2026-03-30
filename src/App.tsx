import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sword, Target, Users, Zap, Shield, Trophy } from "lucide-react";

interface Player {
  id: string;
  x: number;
  y: number;
  health: number;
  angle: number;
  name: string;
  color: string;
}

interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby");
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");

  const keys = useRef<Record<string, boolean>>({});
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "JOIN_ROOM", roomId: roomId || "default", name: playerName || "Brawler" }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "INIT") {
        setPlayerId(data.playerId);
        setGameState("playing");
      } else if (data.type === "STATE") {
        setPlayers(data.players);
        setBullets(data.bullets);
      }
    };
  };

  useEffect(() => {
    if (gameState !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;

    const loop = () => {
      // Update local player movement
      if (playerId && players[playerId] && socketRef.current?.readyState === WebSocket.OPEN) {
        const p = players[playerId];
        let dx = 0;
        let dy = 0;
        const speed = 5;

        if (keys.current["w"] || keys.current["arrowup"]) dy -= speed;
        if (keys.current["s"] || keys.current["arrowdown"]) dy += speed;
        if (keys.current["a"] || keys.current["arrowleft"]) dx -= speed;
        if (keys.current["d"] || keys.current["arrowright"]) dx += speed;

        if (dx !== 0 || dy !== 0) {
          const angle = Math.atan2(mousePos.current.y - p.y, mousePos.current.x - p.x);
          socketRef.current.send(JSON.stringify({
            type: "MOVE",
            x: p.x + dx,
            y: p.y + dy,
            angle
          }));
        }
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Grid
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Bullets
      bullets.forEach(b => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#fff";
      });
      ctx.shadowBlur = 0;

      // Draw Players
      (Object.values(players) as Player[]).forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        // Health Bar
        ctx.fillStyle = "#333";
        ctx.fillRect(-20, -35, 40, 6);
        ctx.fillStyle = p.health > 30 ? "#4ade80" : "#f87171";
        ctx.fillRect(-20, -35, (p.health / 100) * 40, 6);

        // Name
        ctx.fillStyle = "#fff";
        ctx.font = "12px Inter";
        ctx.textAlign = "center";
        ctx.fillText(p.name, 0, -45);

        // Body
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Direction Indicator
        ctx.fillStyle = "#fff";
        ctx.fillRect(10, -2, 15, 4);

        ctx.restore();
      });

      animationFrame = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, players, bullets, playerId]);

  const handleShoot = () => {
    if (gameState === "playing" && playerId && players[playerId] && socketRef.current?.readyState === WebSocket.OPEN) {
      const p = players[playerId];
      const angle = Math.atan2(mousePos.current.y - p.y, mousePos.current.x - p.x);
      socketRef.current.send(JSON.stringify({
        type: "SHOOT",
        x: p.x,
        y: p.y,
        angle
      }));
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {gameState === "lobby" ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md p-8 bg-[#151515] border border-[#333] rounded-2xl shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-orange-500 rounded-xl">
                <Sword className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Brawl Arena</h1>
                <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Multiplayer Mayhem</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Brawler Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Room ID (Optional)</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Join specific room..."
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <button
                onClick={connect}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/20 uppercase italic tracking-tight text-xl"
              >
                Enter Arena
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500">Online</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500">Fast</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-xl border border-[#333]">
                <Trophy className="w-5 h-5 text-purple-400" />
                <span className="text-[10px] uppercase font-bold text-gray-500">Ranked</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            <div className="absolute top-4 left-4 flex items-center gap-4 z-10">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="font-mono text-sm">{Object.keys(players).length} Players</span>
              </div>
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="font-mono text-sm">{players[playerId!]?.health}% HP</span>
              </div>
            </div>

            <div className="absolute top-4 right-4 z-10">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
                <span className="font-mono text-sm text-gray-400">Room: <span className="text-white">{roomId || "Default"}</span></span>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              onMouseMove={handleMouseMove}
              onClick={handleShoot}
              className="bg-[#111] rounded-2xl border-4 border-[#222] shadow-2xl cursor-crosshair"
            />

            <div className="mt-6 flex justify-center gap-8 text-gray-500 uppercase tracking-widest text-[10px] font-bold">
              <div className="flex items-center gap-2">
                <kbd className="bg-[#222] px-2 py-1 rounded text-white">WASD</kbd> Move
              </div>
              <div className="flex items-center gap-2">
                <kbd className="bg-[#222] px-2 py-1 rounded text-white">MOUSE</kbd> Aim
              </div>
              <div className="flex items-center gap-2">
                <kbd className="bg-[#222] px-2 py-1 rounded text-white">CLICK</kbd> Shoot
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
