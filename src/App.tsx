import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sword, 
  Target, 
  Users, 
  Zap, 
  Shield, 
  Trophy, 
  Coins, 
  Palette, 
  Package, 
  X, 
  Play, 
  ChevronRight, 
  User, 
  Plus,
  LogOut,
  LogIn
} from "lucide-react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

interface Player {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  money: number;
  kills: number;
  deaths: number;
  damage: number;
  speed: number;
  superCharge: number;
  angle: number;
  name: string;
  color: string;
  skin: string;
  team?: number;
}

const SKINS: Record<string, { name: string, color: string, pattern?: string, price: number }> = {
  default: { name: "Classic", color: "#3b82f6", price: 0 },
  tiger: { name: "Tiger", color: "#f59e0b", pattern: "stripe", price: 200 },
  neon: { name: "Neon", color: "#10b981", pattern: "glow", price: 500 },
  gold: { name: "Royal Gold", color: "#fbbf24", pattern: "shine", price: 1000 },
  void: { name: "Void", color: "#8b5cf6", pattern: "pulse", price: 2000 },
};

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
  isSuper: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby");
  const [gameMode, setGameMode] = useState<"practice" | "showdown" | "duel" | "brawlball" | "knockout">("practice");
  const [gameStarted, setGameStarted] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [showShop, setShowShop] = useState(false);
  const [shopTab, setShopTab] = useState<"skins" | "packs">("skins");
  const [killNotify, setKillNotify] = useState<string | null>(null);
  const [mapDim, setMapDim] = useState({ w: 1200, h: 800 });
  const shakeRef = useRef(0);

  // Firebase Auth & Persistence State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [money, setMoney] = useState(0);
  const [kills, setKills] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(["default"]);
  const [currentSkin, setCurrentSkin] = useState("default");
  const [isDead, setIsDead] = useState(false);
  const [trophies, setTrophies] = useState(0);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<string[]>([]);
  const [showFriends, setShowFriends] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");

  const [ball, setBall] = useState<{ x: number, y: number } | null>(null);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });

  const statsRef = useRef({ money, kills, deaths, trophies });
  const lastSavedStats = useRef({ money, kills, deaths, trophies });

  useEffect(() => {
    statsRef.current = { money, kills, deaths, trophies };
  }, [money, kills, deaths, trophies]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Load Profile
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setMoney(data.money || 0);
          setTrophies(data.trophies || 0);
          setKills(data.kills || 0);
          setDeaths(data.deaths || 0);
          setUnlockedSkins(data.unlockedSkins || ["default"]);
          setCurrentSkin(data.currentSkin || "default");
          setFriends(data.friends || []);
          setFriendRequests(data.friendRequests || []);
          setPlayerName(data.name || u.displayName || "Brawler");
          lastSavedStats.current = { 
            money: data.money || 0, 
            trophies: data.trophies || 0, 
            kills: data.kills || 0, 
            deaths: data.deaths || 0 
          };
        } else {
          // Create Profile
          const initialData = {
            uid: u.uid,
            name: u.displayName || "Brawler",
            money: 0,
            trophies: 0,
            kills: 0,
            deaths: 0,
            unlockedSkins: ["default"],
            currentSkin: "default",
            friends: [],
            friendRequests: []
          };
          await setDoc(doc(db, "users", u.uid), initialData);
          setPlayerName(initialData.name);
          lastSavedStats.current = { money: 0, trophies: 0, kills: 0, deaths: 0 };
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Save Progress to Firestore
  const saveProgress = async (updates: any) => {
    if (!user) return;
    
    // Optimistically update lastSavedStats to prevent redundant triggers
    if (updates.money !== undefined) lastSavedStats.current.money = updates.money;
    if (updates.trophies !== undefined) lastSavedStats.current.trophies = updates.trophies;
    if (updates.kills !== undefined) lastSavedStats.current.kills = updates.kills;
    if (updates.deaths !== undefined) lastSavedStats.current.deaths = updates.deaths;

    try {
      console.log("Saving progress to Firebase:", updates);
      await updateDoc(doc(db, "users", user.uid), updates);
      console.log("Progress saved successfully");
    } catch (e) {
      console.error("Error saving progress:", e);
      // Rollback on error if needed, but for stats we usually just wait for next update
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  const handleLogout = () => signOut(auth);

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

  const connect = (mode: string = "practice") => {
    setGameMode(mode as any);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: "JOIN_QUEUE", 
        mode,
        roomId: roomId || "default", 
        name: playerName || "Brawler",
        stats: {
          money,
          trophies,
          kills,
          deaths,
          skin: currentSkin,
          color: SKINS[currentSkin].color
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
        
        const currentStats = statsRef.current;
        if (playerId && data.players[playerId]) {
          const oldP = players[playerId];
          const newP = data.players[playerId];
          
          // Update local persistence
          if (newP.money !== lastSavedStats.current.money) {
            setMoney(newP.money);
            saveProgress({ money: newP.money });
          }
          if (newP.trophies !== lastSavedStats.current.trophies) {
            setTrophies(newP.trophies);
            saveProgress({ trophies: newP.trophies });
          }
          if (newP.kills > lastSavedStats.current.kills) {
            setKills(newP.kills);
            saveProgress({ kills: newP.kills });
            setKillNotify("YOU GOT A KILL!");
            playSound(800, "square", 0.3);
            setTimeout(() => setKillNotify(null), 2000);
          }
          
          // "Dying doesn't work" - we just track it for stats but don't trigger the death screen automatically
          if (newP.deaths > lastSavedStats.current.deaths) {
            setDeaths(newP.deaths);
            saveProgress({ deaths: newP.deaths });
            playSound(100, "sawtooth", 0.5);
          }

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
      if (playerId && players[playerId] && socketRef.current?.readyState === WebSocket.OPEN && !showShop && !isDead) {
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
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      for (let x = 0; x < mapDim.w; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapDim.h);
        ctx.stroke();
      }
      for (let y = 0; y < mapDim.h; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mapDim.w, y);
        ctx.stroke();
      }

      // Draw Obstacles
      obstacles.forEach(obs => {
        if (obs.type === "wall") {
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 4;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          
          // Texture
          ctx.fillStyle = "#222";
          for (let i = 10; i < obs.w; i += 40) {
            for (let j = 10; j < obs.h; j += 40) {
              ctx.fillRect(obs.x + i, obs.y + j, 20, 20);
            }
          }
        } else {
          ctx.fillStyle = "rgba(34, 197, 94, 0.3)";
          ctx.beginPath();
          ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 20);
          ctx.fill();
          ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
          ctx.stroke();
        }
      });

      // Draw Bullets
      bullets.forEach(b => {
        ctx.fillStyle = b.isSuper ? "#f97316" : "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isSuper ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
        if (b.isSuper) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#f97316";
        }
      });
      ctx.shadowBlur = 0;

      // Draw Ball
      if (ball) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Ball pattern
        ctx.beginPath();
        ctx.moveTo(ball.x - 15, ball.y);
        ctx.lineTo(ball.x + 15, ball.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y - 15);
        ctx.lineTo(ball.x, ball.y + 15);
        ctx.stroke();
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
        
        // Health Bar
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-25, -45, 50, 8);
        ctx.fillStyle = p.health > (p.maxHealth * 0.3) ? (p.team === 1 ? "#3b82f6" : (p.team === 2 ? "#ef4444" : "#4ade80")) : "#f87171";
        ctx.fillRect(-25, -45, (p.health / p.maxHealth) * 50, 8);

        // Name
        ctx.fillStyle = isLocal ? "#f97316" : (p.team === 1 ? "#3b82f6" : (p.team === 2 ? "#ef4444" : "#fff"));
        ctx.font = "bold 14px Inter";
        ctx.textAlign = "center";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "black";
        ctx.fillText(p.name, 0, -55);
        ctx.shadowBlur = 0;

        // Tank Body
        ctx.rotate(p.angle);
        
        // Treads
        ctx.fillStyle = "#111";
        ctx.fillRect(-22, -22, 44, 10);
        ctx.fillRect(-22, 12, 44, 10);

        // Main Body
        const skinData = SKINS[p.skin || "default"];
        ctx.fillStyle = skinData.color;
        ctx.beginPath();
        ctx.roundRect(-18, -18, 36, 36, 8);
        ctx.fill();
        
        // Pattern
        if (skinData.pattern === "stripe") {
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(-18, -5, 36, 10);
        } else if (skinData.pattern === "glow") {
          ctx.strokeStyle = "rgba(255,255,255,0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(-15, -15, 30, 30);
        } else if (skinData.pattern === "shine") {
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillRect(-10, -18, 5, 36);
        }

        // Turret
        ctx.fillStyle = skinData.color;
        ctx.fillRect(0, -6, 28, 12);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -6, 28, 12);
        
        // Hatch
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      ctx.restore();

      animationFrame = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, players, bullets, playerId, showShop, obstacles]);

  const handleShoot = () => {
    if (gameState === "playing" && playerId && players[playerId] && socketRef.current?.readyState === WebSocket.OPEN && !showShop) {
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
    if (playerId && players[playerId] && players[playerId].superCharge >= 100 && socketRef.current?.readyState === WebSocket.OPEN && !showShop) {
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

  const buyPack = () => {
    if (money >= 1000) {
      const newMoney = money - 1000;
      setMoney(newMoney);
      const skinKeys = Object.keys(SKINS).filter(k => !unlockedSkins.includes(k));
      if (skinKeys.length > 0) {
        const newSkin = skinKeys[Math.floor(Math.random() * skinKeys.length)];
        const newSkins = [...unlockedSkins, newSkin];
        setUnlockedSkins(newSkins);
        saveProgress({ money: newMoney, unlockedSkins: newSkins });
        setKillNotify(`UNLOCKED: ${SKINS[newSkin].name}!`);
        setTimeout(() => setKillNotify(null), 3000);
      } else {
        saveProgress({ money: newMoney });
        setKillNotify("ALL SKINS UNLOCKED!");
        setTimeout(() => setKillNotify(null), 2000);
      }
    }
  };

  const selectSkin = (skin: string) => {
    setCurrentSkin(skin);
    saveProgress({ currentSkin: skin });
  };

  const buySkin = (id: string) => {
    if (unlockedSkins.includes(id)) {
      selectSkin(id);
      return;
    }
    if (money >= SKINS[id].price) {
      const newMoney = money - SKINS[id].price;
      const newSkins = [...unlockedSkins, id];
      setMoney(newMoney);
      setUnlockedSkins(newSkins);
      selectSkin(id);
      saveProgress({ money: newMoney, unlockedSkins: newSkins, currentSkin: id });
      playSound(880, "sine", 0.1);
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

  const sendFriendRequest = async (targetUid: string) => {
    if (!user || targetUid === user.uid) return;
    try {
      const targetDoc = await getDoc(doc(db, "users", targetUid));
      if (targetDoc.exists()) {
        const targetData = targetDoc.data();
        const currentRequests = targetData.friendRequests || [];
        if (!currentRequests.includes(user.uid)) {
          await updateDoc(doc(db, "users", targetUid), {
            friendRequests: [...currentRequests, user.uid]
          });
          setKillNotify("FRIEND REQUEST SENT!");
          setTimeout(() => setKillNotify(null), 2000);
        }
      }
    } catch (e) {
      console.error("Error sending friend request:", e);
    }
  };

  const acceptFriendRequest = async (requestUid: string) => {
    if (!user) return;
    try {
      const newRequests = friendRequests.filter(id => id !== requestUid);
      const newFriends = [...friends, requestUid];
      
      // Update my profile
      await updateDoc(doc(db, "users", user.uid), {
        friendRequests: newRequests,
        friends: newFriends
      });
      setFriendRequests(newRequests);
      setFriends(newFriends);

      // Update their profile
      const otherDoc = await getDoc(doc(db, "users", requestUid));
      if (otherDoc.exists()) {
        const otherFriends = otherDoc.data().friends || [];
        await updateDoc(doc(db, "users", requestUid), {
          friends: [...otherFriends, user.uid]
        });
      }
      
      setKillNotify("FRIEND ADDED!");
      setTimeout(() => setKillNotify(null), 2000);
    } catch (e) {
      console.error("Error accepting friend request:", e);
    }
  };

  const currentPlayer = playerId ? players[playerId] : null;
  const leaderboard = (Object.values(players) as Player[])
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 5);

  const kdRatio = currentPlayer ? (currentPlayer.kills / (currentPlayer.deaths || 1)).toFixed(2) : "0.00";

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
      />
    </div>
  );

  return (
    <div 
      className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col items-center justify-center touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait">
        {gameState === "lobby" ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="w-full max-w-4xl p-10 flex flex-col md:flex-row gap-10"
          >
            {/* Left Side: Profile & Stats */}
            <div className="flex-1 space-y-6">
              <div className="bg-[#0f0f0f] border border-[#222] p-8 rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-20 h-20 rounded-2xl shadow-xl flex items-center justify-center" style={{ backgroundColor: SKINS[currentSkin].color }}>
                    <Users className="w-10 h-10 text-white/50" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => {
                          setPlayerName(e.target.value);
                          saveProgress({ name: e.target.value });
                        }}
                        placeholder="Brawler Name"
                        className="bg-transparent text-3xl font-black uppercase italic tracking-tighter focus:outline-none border-b-2 border-white/5 focus:border-orange-500 transition-all w-full"
                      />
                      {user && (
                        <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-red-500">
                          <LogOut className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Player Profile</p>
                  </div>
                </div>

                {!user ? (
                  <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-3xl text-center">
                    <p className="text-sm font-bold text-orange-200 mb-4">Sign in to save your progress!</p>
                    <button 
                      onClick={handleLogin}
                      className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all"
                    >
                      <LogIn className="w-5 h-5" />
                      Login with Google
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Kills</p>
                      <p className="text-2xl font-black">{kills}</p>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Deaths</p>
                      <p className="text-2xl font-black">{deaths}</p>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Trophies</p>
                      <p className="text-2xl font-black text-orange-500 flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        {trophies}
                      </p>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Balance</p>
                      <p className="text-2xl font-black text-yellow-400">${money}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#0f0f0f] border border-[#222] p-8 rounded-[2.5rem] shadow-2xl">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Friends</h3>
                <div className="space-y-4">
                  <button 
                    onClick={() => setShowFriends(true)}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Users className="w-5 h-5" />
                    Manage Friends ({friends.length})
                  </button>
                  {friendRequests.length > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl text-center">
                      <p className="text-xs font-bold text-orange-200">{friendRequests.length} New Friend Requests!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Play & Shop */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="bg-[#0f0f0f] border border-[#222] p-8 rounded-[2.5rem] shadow-2xl flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-12">
                  <div className="p-4 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20">
                    <Sword className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">Liam Stars</h1>
                    <p className="text-[10px] text-orange-500 font-mono uppercase tracking-[0.3em] mt-1">Arena Combat v3.1</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Join Room ID (Optional)"
                    className="w-full bg-[#050505] border border-[#222] rounded-2xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-all placeholder:text-gray-700 text-sm font-bold"
                  />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => connect("practice")}
                    className="bg-white text-black font-black py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] uppercase italic tracking-tight text-xl"
                  >
                    Practice
                  </button>
                  <button
                    onClick={() => connect("showdown")}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/20 uppercase italic tracking-tight text-xl"
                  >
                    Showdown
                  </button>
                  <button
                    onClick={() => connect("duel")}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20 uppercase italic tracking-tight text-xl"
                  >
                    1v1 Duel
                  </button>
                  <button
                    onClick={() => connect("brawlball")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20 uppercase italic tracking-tight text-xl"
                  >
                    Brawl Ball
                  </button>
                  <button
                    onClick={() => connect("knockout")}
                    className="bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-500/20 uppercase italic tracking-tight text-xl col-span-2"
                  >
                    Knockout
                  </button>
                </div>
                <button
                  onClick={() => { setShopTab("skins"); setShowShop(true); }}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all uppercase italic tracking-tight text-sm border border-white/5"
                >
                  Open Shop
                </button>
                </div>
              </div>

              <div className="bg-[#0f0f0f] border border-[#222] p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl" style={{ backgroundColor: SKINS[currentSkin].color }} />
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Current Skin</p>
                    <p className="font-black uppercase italic">{SKINS[currentSkin].name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShopTab("skins"); setShowShop(true); }}
                  className="px-6 py-3 bg-white text-black font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors"
                >
                  Change
                </button>
              </div>
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
                    <h3 className="font-black uppercase italic tracking-tight leading-none">{currentPlayer?.name}</h3>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">K: {currentPlayer?.kills}</span>
                      <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">D: {currentPlayer?.deaths}</span>
                    </div>
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
                      <span className="text-[10px] font-black">{p.kills}</span>
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
                    {(winnerId === playerId || (currentPlayer && ((winnerId === "team1" && currentPlayer.team === 1) || (winnerId === "team2" && currentPlayer.team === 2)))) && (
                      <div className="bg-orange-500/20 border border-orange-500/30 p-4 rounded-2xl inline-flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        <span className="text-2xl font-black text-white">+10 Trophies</span>
                      </div>
                    )}
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

            {/* Kill Notification */}
            <AnimatePresence>
              {killNotify && (
                <motion.div
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -100, opacity: 0 }}
                  className="absolute top-32 left-1/2 -translate-x-1/2 bg-orange-500 px-8 py-4 rounded-2xl shadow-2xl z-50 border-2 border-orange-400"
                >
                  <p className="font-black uppercase italic tracking-widest text-white text-2xl">{killNotify}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Overlay (Shared) */}
      <AnimatePresence>
        {showShop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f0f0f] border border-[#222] p-8 md:p-10 rounded-[3rem] shadow-3xl w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter">Brawler Shop</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Balance: <span className="text-yellow-400">${money}</span></p>
                </div>
                <button onClick={() => setShowShop(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors">
                  <kbd className="text-xs font-bold">ESC</kbd>
                </button>
              </div>

              <div className="flex gap-2 mb-8 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                {(["skins", "packs"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setShopTab(tab)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      shopTab === tab ? "bg-orange-500 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
                {shopTab === "skins" && (
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(SKINS).map(([id, skin]) => (
                      <button
                        key={id}
                        onClick={() => buySkin(id)}
                        className={`p-6 rounded-2xl border transition-all text-left flex flex-col items-center gap-4 ${
                          currentSkin === id 
                          ? "border-orange-500 bg-orange-500/10" 
                          : "border-[#222] bg-[#151515] hover:border-white/20"
                        } ${!unlockedSkins.includes(id) && money < skin.price ? "opacity-50 grayscale" : ""}`}
                      >
                        <div className="w-16 h-16 rounded-2xl shadow-2xl" style={{ backgroundColor: skin.color }} />
                        <div className="text-center">
                          <h4 className="font-black uppercase italic tracking-tight">{skin.name}</h4>
                          {!unlockedSkins.includes(id) ? (
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <Coins className="w-3 h-3 text-yellow-400" />
                              <span className="text-xs font-black text-yellow-400">{skin.price}</span>
                            </div>
                          ) : (
                            <span className={`text-[8px] font-black uppercase tracking-widest ${currentSkin === id ? 'text-orange-500' : 'text-green-500'}`}>
                              {currentSkin === id ? "Equipped" : "Unlocked"}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {shopTab === "packs" && (
                  <div className="flex flex-col items-center justify-center p-10 text-center">
                    <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-orange-500/20 animate-bounce">
                      <Target className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Mystery Skin Pack</h3>
                    <p className="text-gray-500 text-sm mb-8 max-w-xs">Unlock a random premium skin for your tank!</p>
                    <button
                      onClick={buyPack}
                      disabled={money < 1000}
                      className="w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black rounded-2xl uppercase italic tracking-tight text-xl shadow-xl shadow-orange-500/20 transition-all transform active:scale-95"
                    >
                      Buy Pack - $1000
                    </button>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setShowShop(false)}
                className="w-full mt-8 py-4 bg-white text-black font-black rounded-2xl uppercase italic tracking-tight hover:bg-gray-200 transition-colors"
              >
                Close Shop
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Friends Overlay */}
      <AnimatePresence>
        {showFriends && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f0f0f] border border-[#222] p-8 md:p-10 rounded-[3rem] shadow-3xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter">Friends</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{friends.length} Friends</p>
                </div>
                <button onClick={() => setShowFriends(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Add Friend</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      placeholder="Enter User ID"
                      className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all text-sm"
                    />
                    <button 
                      onClick={() => { sendFriendRequest(friendSearch); setFriendSearch(""); }}
                      className="p-3 bg-orange-500 rounded-xl hover:bg-orange-600 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {friendRequests.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-4">Pending Requests</h3>
                    <div className="space-y-2">
                      {friendRequests.map(reqId => (
                        <div key={reqId} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5">
                          <span className="text-xs font-bold text-gray-400 truncate max-w-[150px]">{reqId}</span>
                          <button 
                            onClick={() => acceptFriendRequest(reqId)}
                            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-tight hover:bg-orange-600 transition-all"
                          >
                            Accept
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Your Friends</h3>
                  {friends.length === 0 ? (
                    <p className="text-center text-gray-600 text-xs py-8">No friends yet. Add some!</p>
                  ) : (
                    <div className="space-y-2">
                      {friends.map(fId => (
                        <div key={fId} className="bg-white/5 p-4 rounded-2xl flex items-center gap-4 border border-white/5">
                          <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                          <span className="text-sm font-bold truncate">{fId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
