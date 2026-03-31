import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sword, 
  Target, 
  Zap, 
  Shield, 
  Trophy, 
  X, 
  Play, 
  ChevronRight, 
  User, 
  Plus,
  Settings,
  Gamepad2,
  Flame,
  Crown,
  Users,
  Search,
  UserPlus,
  LogOut,
  Bell
} from "lucide-react";

interface PartyMember {
  id: string;
  name: string;
}

interface Party {
  id: string;
  leaderId: string;
  members: PartyMember[];
}

interface Player {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  superCharge: number;
  angle: number;
  name: string;
  color: string;
  team?: number;
}

const PLAYER_COLORS = [
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
];

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "wall" | "bush";
}

interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  angle: number;
  isSuper: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [persistentId] = useState(() => {
    const saved = localStorage.getItem("persistentId");
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("persistentId", newId);
    return newId;
  });
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby");
  const [gameMode, setGameMode] = useState<"practice" | "showdown" | "duel" | "brawlball" | "knockout">("practice");
  const [gameStarted, setGameStarted] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("playerName") || "Brawler_" + Math.floor(Math.random() * 1000));
  const [roomId, setRoomId] = useState("");
  const [mapDim, setMapDim] = useState({ w: 1200, h: 800 });
  const shakeRef = useRef(0);

  const [isDead, setIsDead] = useState(false);

  const [ball, setBall] = useState<{ x: number, y: number } | null>(null);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });

  // Lobby & Party State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string, name: string }[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [invites, setInvites] = useState<{ fromId: string, fromName: string }[]>([]);
  const lobbySocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    localStorage.setItem("playerName", playerName);
    if (gameState === "lobby") {
      connectLobby();
    }
    return () => lobbySocketRef.current?.close();
  }, [playerName, gameState]);

  const connectLobby = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    lobbySocketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "LOBBY_JOIN", name: playerName, playerId: persistentId }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "SEARCH_RESULTS":
          setSearchResults(data.results);
          break;
        case "PARTY_INVITE_RECEIVED":
          setInvites(prev => [...prev, { fromId: data.fromId, fromName: data.fromName }]);
          playSound(600, "sine", 0.2);
          break;
        case "PARTY_UPDATE":
          setParty(data.party);
          break;
        case "GAME_START_REQUEST":
          setRoomId(data.roomId);
          connect(data.mode, data.roomId);
          break;
      }
    };
  };

  const searchPlayers = (query: string) => {
    setSearchQuery(query);
    if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
      lobbySocketRef.current.send(JSON.stringify({ type: "SEARCH_PLAYERS", query, playerId: persistentId }));
    }
  };

  const invitePlayer = (targetId: string) => {
    if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
      lobbySocketRef.current.send(JSON.stringify({ type: "PARTY_INVITE", targetId, playerId: persistentId }));
    }
  };

  const acceptInvite = (fromId: string) => {
    if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
      lobbySocketRef.current.send(JSON.stringify({ type: "PARTY_ACCEPT", fromId, playerId: persistentId }));
      setInvites(prev => prev.filter(i => i.fromId !== fromId));
    }
  };

  const leaveParty = () => {
    if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
      lobbySocketRef.current.send(JSON.stringify({ type: "PARTY_LEAVE", playerId: persistentId }));
    }
    setParty(null);
  };

  const playSound = (freq: number, type: OscillatorType = "square", duration: number = 0.1) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked
    }
  };

  const keys = useRef<Record<string, boolean>>({});
  const mousePos = useRef({ x: 0, y: 0 });
  const localPos = useRef({ x: 0, y: 0 });
  const lastMoveSent = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === " " && gameState === "playing") handleSuper();
    };
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  const connect = (mode: string = "practice", specificRoomId?: string) => {
    setGameMode(mode as any);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: "JOIN_QUEUE", 
        mode,
        roomId: specificRoomId || roomId || "default", 
        name: playerName || "Brawler",
        playerId: persistentId,
        partyId: party?.id,
        stats: {
          color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
        }
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "INIT") {
        setPlayerId(data.playerId);
        setObstacles(data.obstacles);
        setMapDim({ w: data.mapWidth, h: data.mapHeight });
        localPos.current = { x: data.x, y: data.y };
        setGameState("playing");
        setIsDead(false);
        setWinnerId(null);
        setGameStarted(data.mode === "practice");
      } else if (data.type === "STATE") {
        setGameStarted(data.started);
        setWinnerId(data.winner);
        setPlayerCount(data.playerCount || 0);
        setBall(data.ball);
        setScores(data.scores || { team1: 0, team2: 0 });
        
        if (playerId && data.players[playerId]) {
          const oldP = players[playerId];
          const newP = data.players[playerId];
          
          if (newP.health <= 0 && !isDead) {
            setIsDead(true);
          } else if (newP.health > 0 && isDead) {
            setIsDead(false);
          }

          if (oldP && newP.health < oldP.health) {
            shakeRef.current = 10;
            playSound(150, "sawtooth", 0.2);
          }
        }
        setPlayers(data.players);
        setBullets(data.bullets);
        
        if (playerId && data.players[playerId]) {
          const srvP = data.players[playerId];
          const dist = Math.sqrt(Math.pow(srvP.x - localPos.current.x, 2) + Math.pow(srvP.y - localPos.current.y, 2));
          if (dist > 50) { // Reduced threshold for better sync
            localPos.current = { x: srvP.x, y: srvP.y };
          }
        }
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
      if (playerId && players[playerId] && socketRef.current?.readyState === WebSocket.OPEN && !isDead) {
        const p = players[playerId];
        let dx = 0;
        let dy = 0;
        const speed = p.speed || 3.5;

        if (keys.current["w"] || keys.current["arrowup"]) dy -= speed;
        if (keys.current["s"] || keys.current["arrowdown"]) dy += speed;
        if (keys.current["a"] || keys.current["arrowleft"]) dx -= speed;
        if (keys.current["d"] || keys.current["arrowright"]) dx += speed;

        // Joystick movement
        if (joystick.current.active) {
          dx = joystick.current.x * speed;
          dy = joystick.current.y * speed;
        }

        if (dx !== 0 || dy !== 0) {
          // Normalize diagonal movement
          if (dx !== 0 && dy !== 0 && !joystick.current.active) {
            const factor = 1 / Math.sqrt(2);
            dx *= factor;
            dy *= factor;
          }

          let canMove = true;
          const nextX = localPos.current.x + dx;
          const nextY = localPos.current.y + dy;
          
          for (const obs of obstacles) {
            if (obs.type === "wall") {
              if (nextX + 20 > obs.x && nextX - 20 < obs.x + obs.w &&
                  nextY + 20 > obs.y && nextY - 20 < obs.y + obs.h) {
                canMove = false;
                break;
              }
            }
          }

          if (canMove) {
            localPos.current.x = Math.max(20, Math.min(mapDim.w - 20, nextX));
            localPos.current.y = Math.max(20, Math.min(mapDim.h - 20, nextY));
          }
        }

        // Single screen: no camera follow, just scale to fit
        const scaleX = canvas.width / mapDim.w;
        const scaleY = canvas.height / mapDim.h;
        const scale = Math.min(scaleX, scaleY);

        const angle = Math.atan2(
          (mousePos.current.y - (canvas.height - mapDim.h * scale) / 2) / scale - localPos.current.y,
          (mousePos.current.x - (canvas.width - mapDim.w * scale) / 2) / scale - localPos.current.x
        );
        
        // Only send MOVE if we actually moved or rotated significantly, throttled to 30fps
        const now = Date.now();
        if (now - lastMoveSent.current > 33) {
          socketRef.current.send(JSON.stringify({
            type: "MOVE",
            x: localPos.current.x,
            y: localPos.current.y,
            angle
          }));
          lastMoveSent.current = now;
        }
      }

      // Draw
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      
      // Center and scale map to fit screen
      const scaleX = canvas.width / mapDim.w;
      const scaleY = canvas.height / mapDim.h;
      const scale = Math.min(scaleX, scaleY);
      
      ctx.translate((canvas.width - mapDim.w * scale) / 2, (canvas.height - mapDim.h * scale) / 2);
      ctx.scale(scale, scale);

      if (shakeRef.current > 0) {
        const sx = (Math.random() - 0.5) * shakeRef.current;
        const sy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(sx, sy);
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.1) shakeRef.current = 0;
      }

      // Draw Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < mapDim.w; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapDim.h);
        ctx.stroke();
      }
      for (let y = 0; y < mapDim.h; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mapDim.w, y);
        ctx.stroke();
      }

      // Draw Obstacles
      obstacles.forEach(obs => {
        if (obs.type === "wall") {
          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(obs.x + 8, obs.y + 8, obs.w, obs.h);

          const gradient = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
          gradient.addColorStop(0, "#1a1a1a");
          gradient.addColorStop(1, "#333");
          
          ctx.fillStyle = gradient;
          ctx.shadowBlur = 15;
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 8);
          ctx.fill();
          
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Tech details
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(obs.x + 5, obs.y + 5, 2, 2);
          ctx.fillRect(obs.x + obs.w - 7, obs.y + 5, 2, 2);
          ctx.fillRect(obs.x + 5, obs.y + obs.h - 7, 2, 2);
          ctx.fillRect(obs.x + obs.w - 7, obs.y + obs.h - 7, 2, 2);
        } else {
          // Bush
          ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
          ctx.shadowBlur = 20;
          ctx.shadowColor = "rgba(34, 197, 94, 0.3)";
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 24);
          ctx.fill();
          
          ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Leaves
          ctx.fillStyle = "rgba(34, 197, 94, 0.2)";
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(obs.x + (i * 20) % obs.w, obs.y + (i * 15) % obs.h, 15, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      });

      // Draw Bullets
      bullets.forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        
        const color = b.isSuper ? "#f97316" : "#fff";
        ctx.shadowBlur = b.isSuper ? 20 : 10;
        ctx.shadowColor = color;
        
        ctx.fillStyle = color;
        if (b.isSuper) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-20, 10);
          ctx.lineTo(-15, 0);
          ctx.lineTo(-20, -10);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-10, -2, 12, 4);
        }
        
        ctx.restore();
      });

      // Draw Ball
      if (ball) {
        ctx.save();
        ctx.translate(ball.x, ball.y);
        
        // Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
        glow.addColorStop(0, "rgba(255,255,255,0.2)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#fff";
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Pattern
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(15, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(0, 15);
        ctx.stroke();
        
        ctx.restore();
      }

      // Draw Goals for Brawl Ball
      if (gameMode === "brawlball") {
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)"; // Team 1 Goal
        ctx.fillRect(0, mapDim.h / 2 - 100, 20, 200);
        ctx.fillStyle = "rgba(239, 68, 68, 0.2)"; // Team 2 Goal
        ctx.fillRect(mapDim.w - 20, mapDim.h / 2 - 100, 20, 200);
      }

      // Draw Players
      (Object.values(players) as any[]).forEach(p => {
        const isLocal = p.id === playerId;
        let inBush = false;
        for (const obs of obstacles) {
          if (obs.type === "bush") {
            if (p.x > obs.x && p.x < obs.x + obs.w && p.y > obs.y && p.y < obs.y + obs.h) {
              inBush = true;
              break;
            }
          }
        }

        if (inBush && !isLocal) {
          const lp = players[playerId!];
          if (lp) {
            const dist = Math.sqrt(Math.pow(lp.x - p.x, 2) + Math.pow(lp.y - p.y, 2));
            if (dist > 150) return;
          }
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        if (inBush) ctx.globalAlpha = 0.5;
        
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 25, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(p.angle);
        
        // Tank Body
        const baseColor = p.color || "#3b82f6";
        const bodyGradient = ctx.createLinearGradient(-20, -20, 20, 20);
        bodyGradient.addColorStop(0, baseColor);
        bodyGradient.addColorStop(1, "#000");
        
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.roundRect(-22, -22, 44, 44, 8);
        ctx.fill();
        
        // Treads
        ctx.fillStyle = "#111";
        ctx.fillRect(-24, -22, 8, 44);
        ctx.fillRect(16, -22, 8, 44);
        
        // Turret
        ctx.fillStyle = baseColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = baseColor;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Barrel
        ctx.fillStyle = "#222";
        ctx.fillRect(0, -6, 28, 12);
        ctx.fillStyle = baseColor;
        ctx.fillRect(24, -6, 6, 12);
        
        ctx.restore();

        // UI above player
        const isTeammate = currentPlayer?.team && p.team === currentPlayer.team;
        const healthColor = p.id === playerId ? "#22c55e" : (isTeammate ? "#3b82f6" : "#ef4444");

        // Name
        ctx.font = "bold 12px Inter";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(p.name, p.x, p.y - 45);

        // Health Bar
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.roundRect(p.x - 20, p.y - 35, 40, 6, 3);
        ctx.fill();
        ctx.fillStyle = healthColor;
        ctx.roundRect(p.x - 20, p.y - 35, (p.health / p.maxHealth) * 40, 6, 3);
        ctx.fill();
      });

      ctx.restore();

      animationFrame = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, players, bullets, playerId, obstacles]);

  const handleShoot = () => {
    if (gameState === "playing" && playerId && players[playerId] && socketRef.current?.readyState === WebSocket.OPEN) {
      playSound(400, "square", 0.05);
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scaleX = canvas.width / mapDim.w;
      const scaleY = canvas.height / mapDim.h;
      const scale = Math.min(scaleX, scaleY);
      
      const angle = Math.atan2(
        (mousePos.current.y - (canvas.height - mapDim.h * scale) / 2) / scale - localPos.current.y,
        (mousePos.current.x - (canvas.width - mapDim.w * scale) / 2) / scale - localPos.current.x
      );

      socketRef.current.send(JSON.stringify({
        type: "SHOOT",
        x: localPos.current.x,
        y: localPos.current.y,
        angle,
        isSuper: false
      }));
    }
  };

  const handleSuper = () => {
    if (playerId && players[playerId] && players[playerId].superCharge >= 100 && socketRef.current?.readyState === WebSocket.OPEN) {
      playSound(600, "sawtooth", 0.4);
      shakeRef.current = 20;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scaleX = canvas.width / mapDim.w;
      const scaleY = canvas.height / mapDim.h;
      const scale = Math.min(scaleX, scaleY);

      const angle = Math.atan2(
        (mousePos.current.y - (canvas.height - mapDim.h * scale) / 2) / scale - localPos.current.y,
        (mousePos.current.x - (canvas.width - mapDim.w * scale) / 2) / scale - localPos.current.x
      );

      socketRef.current.send(JSON.stringify({
        type: "SHOOT",
        x: localPos.current.x,
        y: localPos.current.y,
        angle,
        isSuper: true
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

  const joystick = useRef({ active: false, x: 0, y: 0, startX: 0, startY: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX < window.innerWidth / 2) {
      joystick.current = { active: true, x: 0, y: 0, startX: touch.clientX, startY: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!joystick.current.active) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystick.current.startX;
    const dy = touch.clientY - joystick.current.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 50;
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxDist);
    
    joystick.current.x = (Math.cos(angle) * clampedDist) / maxDist;
    joystick.current.y = (Math.sin(angle) * clampedDist) / maxDist;
  };

  const handleTouchEnd = () => {
    joystick.current.active = false;
    joystick.current.x = 0;
    joystick.current.y = 0;
  };

  const handleRespawn = () => {
    setIsDead(false);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "RESPAWN" }));
    }
  };

  const handleBackToMenu = () => {
    setGameState("lobby");
    setIsDead(false);
    socketRef.current?.close();
  };

  const currentPlayer = playerId ? players[playerId] : null;
  const leaderboard = (Object.values(players) as Player[])
    .sort((a, b) => b.health - a.health)
    .slice(0, 5);

  return (
    <div 
      className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col items-center justify-center touch-none select-none relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-500/10 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 blur-[160px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
        
        {/* Particle System */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/10 rounded-full"
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: Math.random() * window.innerHeight,
                opacity: Math.random() * 0.5
              }}
              animate={{ 
                y: [null, Math.random() * -100],
                opacity: [0, 0.5, 0]
              }}
              transition={{ 
                duration: 5 + Math.random() * 10, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {gameState === "lobby" ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-6xl p-6 flex flex-col gap-8 z-10"
          >
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <motion.div 
                    className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl shadow-2xl flex items-center justify-center transform -rotate-6 group-hover:rotate-0 transition-transform duration-500"
                    whileHover={{ scale: 1.1 }}
                  >
                    <Sword className="w-12 h-12 text-white" />
                  </motion.div>
                  <div className="absolute -bottom-2 -right-2 bg-white text-black p-2 rounded-xl shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                    <Crown className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h1 className="text-7xl font-black tracking-tighter uppercase italic leading-none font-display bg-gradient-to-r from-white via-white to-orange-500 bg-clip-text text-transparent">
                    LIAM<span className="text-orange-500">STARS</span>
                  </h1>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-500/20 backdrop-blur-md">Alpha 4.0</span>
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Next-Gen Multiplayer Arena</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-full border border-white/10 backdrop-blur-xl">
                  <div className="flex items-center gap-3 px-6 py-3 bg-black/40 rounded-full border border-white/5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <div>
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Network</p>
                      <p className="text-sm font-black leading-none">STABLE</p>
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all">
                    <Bell className="w-6 h-6 text-white/60" />
                  </button>
                  {invites.length > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-[#050505]">
                      {invites.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Profile & Search */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Settings className="w-32 h-32" />
                  </div>
                  
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-8 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Brawler Profile
                  </h3>

                  <div className="space-y-8 relative z-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Identity</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          placeholder="Enter Name"
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-5 focus:outline-none focus:border-orange-500 transition-all font-black uppercase italic text-2xl tracking-tight placeholder:text-white/10"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                          <Plus className="w-4 h-4 text-orange-500" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Global Search</label>
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => searchPlayers(e.target.value)}
                          placeholder="Search Players..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm tracking-tight placeholder:text-white/10"
                        />
                      </div>
                      
                      <AnimatePresence>
                        {searchQuery && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-black/60 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5"
                          >
                            {searchResults.length > 0 ? searchResults.map(p => (
                              <div key={p.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                                <span className="font-bold text-sm">{p.name}</span>
                                <button 
                                  onClick={() => invitePlayer(p.id)}
                                  className="p-2 bg-blue-500/20 hover:bg-blue-500 text-blue-500 hover:text-white rounded-xl transition-all"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                              </div>
                            )) : (
                              <div className="p-4 text-center text-white/20 text-xs font-bold uppercase tracking-widest">No Players Found</div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Party Section */}
                <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] backdrop-blur-2xl shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Your Party
                    </h3>
                    {party && (
                      <button onClick={leaveParty} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all">
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {party ? party.members.map(m => (
                      <div key={m.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-black text-sm">
                          {m.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{m.name}</p>
                          <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                            {m.id === party.leaderId ? "Party Leader" : "Member"}
                          </p>
                        </div>
                        {m.id === party.leaderId && <Crown className="w-4 h-4 text-yellow-500" />}
                      </div>
                    )) : (
                      <div className="text-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                          <Users className="w-8 h-8 text-white/10" />
                        </div>
                        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Solo Queue Active</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Column: Game Modes */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="bg-white/5 border border-white/10 p-10 rounded-[3.5rem] backdrop-blur-2xl shadow-2xl flex-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 blur-[100px] rounded-full -mr-48 -mt-48" />
                  
                  <div className="flex items-center justify-between mb-12 relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-3">
                      <Target className="w-4 h-4" />
                      Select Battle Arena
                    </h3>
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Servers Operational</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <motion.button
                      whileHover={{ scale: 1.02, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("practice")}
                      className="group relative bg-white/5 hover:bg-white/10 border border-white/10 p-8 rounded-[2.5rem] transition-all text-left overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Target className="w-32 h-32" />
                      </div>
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                        <Play className="w-6 h-6 text-white/40" />
                      </div>
                      <h4 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Practice</h4>
                      <p className="text-white/40 text-sm font-medium">Refine your skills against advanced AI bots in a safe environment.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("showdown")}
                      className="group relative bg-gradient-to-br from-orange-500 to-red-600 p-8 rounded-[2.5rem] transition-all text-left overflow-hidden shadow-2xl shadow-orange-500/20"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-20">
                        <Flame className="w-32 h-32" />
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Showdown</h4>
                      <p className="text-white/70 text-sm font-medium">The ultimate test. 10 players, one winner. Survival of the fittest.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("duel")}
                      className="group relative bg-gradient-to-br from-purple-600 to-indigo-800 p-8 rounded-[2.5rem] transition-all text-left overflow-hidden shadow-2xl shadow-purple-500/20"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-20">
                        <Sword className="w-32 h-32" />
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-3xl font-black uppercase italic tracking-tighter mb-2">1v1 Duel</h4>
                      <p className="text-white/70 text-sm font-medium">Pure mechanical skill. Face off against a single opponent.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("brawlball")}
                      className="group relative bg-gradient-to-br from-blue-600 to-cyan-700 p-8 rounded-[2.5rem] transition-all text-left overflow-hidden shadow-2xl shadow-blue-500/20"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-20">
                        <Gamepad2 className="w-32 h-32" />
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Brawl Ball</h4>
                      <p className="text-white/70 text-sm font-medium">Teamwork makes the dream work. Score goals to dominate.</p>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>

            {/* Invite Notifications */}
            <div className="fixed bottom-8 right-8 space-y-4 z-[100]">
              <AnimatePresence>
                {invites.map(invite => (
                  <motion.div
                    key={invite.fromId}
                    initial={{ opacity: 0, x: 50, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white text-black p-6 rounded-3xl shadow-2xl flex items-center gap-6 border-4 border-orange-500"
                  >
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Party Invite</p>
                      <p className="font-black text-lg uppercase italic">{invite.fromName}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => acceptInvite(invite.fromId)}
                        className="px-6 py-3 bg-black text-white font-black rounded-xl uppercase italic text-xs hover:bg-orange-500 transition-all"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => setInvites(prev => prev.filter(i => i.fromId !== invite.fromId))}
                        className="p-3 bg-gray-100 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative w-full h-full flex items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              width={window.innerWidth}
              height={window.innerHeight}
              onMouseMove={handleMouseMove}
              onClick={handleShoot}
              className="bg-[#080808] cursor-crosshair"
            />

            {/* HUD */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
              <div className="flex flex-col gap-4">
                {gameMode === "brawlball" && (
                  <div className="bg-black/80 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-6 shadow-2xl pointer-events-auto mb-2">
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Blue</p>
                      <p className="text-2xl font-black text-white leading-none">{scores.team1}</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest">Red</p>
                      <p className="text-2xl font-black text-white leading-none">{scores.team2}</p>
                    </div>
                  </div>
                )}
                <div className="bg-black/80 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-4 shadow-2xl pointer-events-auto">
                  <button 
                    onClick={handleBackToMenu}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: currentPlayer?.color }} />
                  <div>
                    <h3 className="font-black uppercase italic tracking-tight leading-none font-display">{currentPlayer?.name}</h3>
                  </div>
                </div>

                <div className="w-48 space-y-2">
                  <div className="h-3 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                    <motion.div 
                      className="h-full bg-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentPlayer?.health || 0) / (currentPlayer?.maxHealth || 100)) * 100}%` }}
                    />
                  </div>
                  <div className="h-2 bg-black/40 rounded-full border border-white/5 overflow-hidden">
                    <motion.div 
                      className={`h-full ${currentPlayer?.superCharge === 100 ? 'bg-orange-500 shadow-[0_0_10px_#f97316]' : 'bg-orange-500/50'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${currentPlayer?.superCharge || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-black/80 backdrop-blur-xl border border-white/5 p-4 rounded-2xl shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-3 h-3 text-orange-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Leaderboard</span>
                </div>
                <div className="space-y-1">
                  {leaderboard.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between gap-8">
                      <span className={`text-[10px] font-bold ${p.id === playerId ? 'text-orange-500' : 'text-gray-400'}`}>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Controls */}
            <div className="absolute inset-0 pointer-events-none md:hidden">
              {/* Joystick Area */}
              <div className="absolute bottom-12 left-12 w-32 h-32 bg-white/5 rounded-full border border-white/10 flex items-center justify-center">
                {joystick.current.active && (
                  <motion.div 
                    className="absolute w-12 h-12 bg-white/20 rounded-full border border-white/30"
                    style={{ 
                      left: `calc(50% + ${joystick.current.x * 40}px - 24px)`,
                      top: `calc(50% + ${joystick.current.y * 40}px - 24px)`
                    }}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="absolute bottom-12 right-12 flex flex-col gap-4 pointer-events-auto">
                <button 
                  onTouchStart={(e) => { e.stopPropagation(); handleSuper(); }}
                  disabled={currentPlayer?.superCharge < 100}
                  className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all ${
                    currentPlayer?.superCharge === 100 
                    ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/40 scale-110' 
                    : 'bg-black/40 border-white/10 opacity-50'
                  }`}
                >
                  <Zap className="w-8 h-8 text-white" />
                </button>
                <button 
                  onTouchStart={(e) => { e.stopPropagation(); handleShoot(); }}
                  className="w-24 h-24 bg-white/10 border-4 border-white/20 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-2xl"
                >
                  <Sword className="w-10 h-10 text-white" />
                </button>
              </div>
            </div>

            {/* Matchmaking Overlay */}
            <AnimatePresence>
              {gameMode !== "practice" && !gameStarted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-xl"
                >
                  <div className="text-center space-y-8">
                    <div className="relative w-32 h-32 mx-auto">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Users className="w-12 h-12 text-orange-500" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white">Matchmaking</h2>
                      <p className="text-orange-500 font-bold uppercase tracking-[0.3em] mt-2">
                        {gameMode === "duel" ? "Waiting for 2 players..." : 
                         gameMode === "showdown" ? "Waiting for 10 players..." : 
                         "Waiting for 6 players..."}
                      </p>
                    </div>
                    <div className="bg-white/5 border border-white/10 px-8 py-4 rounded-2xl">
                      <p className="text-2xl font-black">
                        {playerCount} / {gameMode === "duel" ? 2 : gameMode === "showdown" ? 10 : 6}
                      </p>
                    </div>
                    <button
                      onClick={handleBackToMenu}
                      className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl uppercase italic tracking-tight transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Winner Screen */}
            <AnimatePresence>
              {winnerId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 z-[80] flex items-center justify-center bg-orange-500/20 backdrop-blur-xl"
                >
                  <div className="text-center space-y-6 p-12 bg-black/80 rounded-[3rem] border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.3)]">
                    <Trophy className="w-24 h-24 text-yellow-400 mx-auto animate-bounce" />
                    <h2 className="text-7xl font-black uppercase italic tracking-tighter text-white">
                      {(winnerId === playerId || (currentPlayer && ((winnerId === "team1" && currentPlayer.team === 1) || (winnerId === "team2" && currentPlayer.team === 2)))) ? "VICTORY!" : "GAME OVER"}
                    </h2>
                    <p className="text-orange-500 font-bold uppercase tracking-[0.3em] mb-4">
                      {winnerId.startsWith("team") ? (winnerId === "team1" ? "Blue Team Wins!" : "Red Team Wins!") : `${players[winnerId]?.name} is the winner!`}
                    </p>
                    <div className="pt-8">
                      <button
                        onClick={handleBackToMenu}
                        className="px-12 py-5 bg-orange-500 text-white font-black rounded-2xl uppercase italic tracking-tight text-xl hover:bg-orange-600 transition-all shadow-lg"
                      >
                        Back to Menu
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Death Screen (Modified for "No Death") */}
            <AnimatePresence>
              {isDead && !winnerId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[60] flex items-center justify-center bg-red-900/20 backdrop-blur-sm pointer-events-none"
                >
                  <div className="text-center space-y-4 pointer-events-auto">
                    <motion.h2 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-6xl font-black uppercase italic tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                    >
                      Brawler Down!
                    </motion.h2>
                    <p className="text-white/80 font-bold uppercase tracking-[0.3em] mb-8">You are at 0 health!</p>
                    <div className="flex gap-4 justify-center">
                      {(gameMode === "practice" || gameMode === "brawlball") ? (
                        <button
                          onClick={handleRespawn}
                          className="px-10 py-4 bg-white text-black font-black rounded-2xl uppercase italic tracking-tight text-lg hover:bg-gray-200 transition-all shadow-xl"
                        >
                          Respawn
                        </button>
                      ) : (
                        <p className="text-red-400 font-black uppercase italic">Wait for game to end or leave</p>
                      )}
                      <button
                        onClick={handleBackToMenu}
                        className="px-10 py-4 bg-white/10 border border-white/10 text-white font-black rounded-2xl uppercase italic tracking-tight text-lg hover:bg-white/20 transition-all"
                      >
                        Back to Menu
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
