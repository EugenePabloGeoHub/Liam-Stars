import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Peer from "simple-peer";
import { 
  Target, 
  Zap, 
  X, 
  Play, 
  ChevronRight, 
  User, 
  Settings,
  Gamepad2,
  Crown,
  Users,
  Search,
  UserPlus,
  LogOut,
  Bell,
  MessageSquare,
  Send,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Square,
  Music,
  ArrowUp,
  Trophy,
  LayoutGrid
} from "lucide-react";
import { NeonNeon } from './components/arcade/NeonNeon';
import { GridRunner } from './components/arcade/GridRunner';
import { SynthWave } from './components/arcade/SynthWave';
import { PixelJump } from './components/arcade/PixelJump';
import { VoidDash } from './components/arcade/VoidDash';
import { BlockBlast } from './components/arcade/BlockBlast';
import { NeonSnake } from './components/arcade/NeonSnake';
import { ColorMatch } from './components/arcade/ColorMatch';
import { MemoryGrid } from './components/arcade/MemoryGrid';
import { SpeedTyper } from './components/arcade/SpeedTyper';
import { CircleSurvive } from './components/arcade/CircleSurvive';
import { GravityBall } from './components/arcade/GravityBall';
import { NeonPaddle } from './components/arcade/NeonPaddle';
import { HexEscape } from './components/arcade/HexEscape';
import { BitDrifter } from './components/arcade/BitDrifter';
import { PulseWave } from './components/arcade/PulseWave';

interface PartyMember {
  id: string;
  name: string;
  isTalking?: boolean;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
}

interface Party {
  id: string;
  leaderId: string;
  members: PartyMember[];
}

export default function App() {
  const [persistentId] = useState(() => {
    const saved = localStorage.getItem("persistentId");
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("persistentId", newId);
    return newId;
  });
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby");
  const [gameMode, setGameMode] = useState<"neon_neon" | "grid_runner" | "synth_wave" | "pixel_jump" | "void_dash" | "block_blast" | "neon_snake" | "color_match" | "memory_grid" | "speed_typer" | "circle_survive" | "gravity_ball" | "neon_paddle" | "hex_escape" | "bit_drifter" | "pulse_wave">("neon_neon");
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("playerName") || "Brawler_" + Math.floor(Math.random() * 1000));
  const [playerNameInput, setPlayerNameInput] = useState(playerName);
  const [roomId, setRoomId] = useState("");

  // Player Stats
  const [xp, setXp] = useState(() => Number(localStorage.getItem("xp")) || 0);
  const [level, setLevel] = useState(() => Number(localStorage.getItem("level")) || 1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [neonColor, setNeonColor] = useState(() => localStorage.getItem("neonColor") || "orange");
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => localStorage.getItem("isAudioEnabled") !== "false");
  const [achievements, setAchievements] = useState<string[]>(() => JSON.parse(localStorage.getItem("achievements") || "[]"));
  const [showSettings, setShowSettings] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isSearching, setIsSearching] = useState(false);
  const [dailyChallenge] = useState({ game: "neon_neon", goal: 5000, reward: 500 });

  // Lobby & Party State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string, name: string }[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [invites, setInvites] = useState<{ fromId: string, fromName: string }[]>([]);
  const [voiceRoomId, setVoiceRoomId] = useState<string | null>(null);
  const [voiceRoomInput, setVoiceRoomInput] = useState("");
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [voicePeers, setVoicePeers] = useState<string[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, any>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const [onlineCount, setOnlineCount] = useState(0);
  const [isOffline, setIsOffline] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(() => localStorage.getItem("selectedAudioDevice") || "");
  const [chatMessages, setChatMessages] = useState<{ sender: string, text: string, timestamp: number, scope: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const lobbySocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        setAudioDevices(audioInputs);
        if (!selectedAudioDevice && audioInputs.length > 0) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error getting audio devices", err);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedAudioDevice", selectedAudioDevice);
  }, [selectedAudioDevice]);

  useEffect(() => {
    localStorage.setItem("xp", xp.toString());
    localStorage.setItem("level", level.toString());
  }, [xp, level]);

  useEffect(() => {
    localStorage.setItem("playerName", playerName);
    if (gameState === "lobby") {
      connectLobby();
    }
    return () => lobbySocketRef.current?.close();
  }, [gameState]); // Removed playerName from dependencies to prevent reconnection on every keystroke

  useEffect(() => {
    if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
      lobbySocketRef.current.send(JSON.stringify({ type: "LOBBY_JOIN", name: playerName, playerId: persistentId }));
    }
  }, [playerName]);

  const connectLobby = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    lobbySocketRef.current = socket;

    socket.onopen = () => {
      setIsOffline(false);
      socket.send(JSON.stringify({ type: "LOBBY_JOIN", name: playerName, playerId: persistentId }));
      socket.send(JSON.stringify({ type: "SEARCH_PLAYERS", query: "", playerId: persistentId }));
    };

    socket.onclose = () => {
      setIsOffline(true);
    };

    socket.onerror = () => {
      setIsOffline(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "LOBBY_INIT":
          if (data.player) {
            setLevel(data.player.level);
            setXp(data.player.xp);
          }
          setOnlineCount(data.onlineCount || 0);
          break;
        case "LOBBY_UPDATE":
          setOnlineCount(data.onlineCount);
          setLeaderboard(data.leaderboard);
          break;
        case "ONLINE_COUNT":
          setOnlineCount(data.count);
          break;
        case "SEARCH_RESULTS":
          setSearchResults(data.results);
          break;
        case "CHAT_MESSAGE":
          setChatMessages(prev => [...prev.slice(-49), data]);
          playSound(400, "sine", 0.05);
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
          connect(data.mode);
          break;
        case "VOICE_JOIN_SUCCESS":
          setVoiceRoomId(data.roomId);
          // Initiate connections to existing peers
          data.peers.forEach((peerId: string) => {
            const peer = createPeer(peerId, persistentId, localStreamRef.current!);
            peersRef.current[peerId] = peer;
          });
          setVoicePeers(data.peers);
          break;
        case "VOICE_PEER_JOINED":
          // Wait for them to send a signal (they are the initiator)
          setVoicePeers(prev => [...new Set([...prev, data.peerId])]);
          break;
        case "VOICE_SIGNAL":
          if (peersRef.current[data.senderId]) {
            peersRef.current[data.senderId].signal(data.signal);
          } else {
            // We are the receiver of an initial signal
            const peer = addPeer(data.signal, data.senderId, persistentId, localStreamRef.current!);
            peersRef.current[data.senderId] = peer;
            setVoicePeers(prev => [...new Set([...prev, data.senderId])]);
          }
          break;
        case "VOICE_PEER_LEFT":
          if (peersRef.current[data.peerId]) {
            peersRef.current[data.peerId].destroy();
            delete peersRef.current[data.peerId];
          }
          if (audioRefs.current[data.peerId]) {
            audioRefs.current[data.peerId].remove();
            delete audioRefs.current[data.peerId];
          }
          setVoicePeers(prev => prev.filter(id => id !== data.peerId));
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

  const sendChat = (scope: "global" | "room" = "global") => {
    if (!chatInput.trim()) return;
    const socket = lobbySocketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "CHAT_MESSAGE",
        text: chatInput,
        scope,
        playerId: persistentId
      }));
      setChatInput("");
    }
  };

  const updateHighScore = (game: string, score: number, earnedXp: number) => {
    // Local XP/Level update for offline compatibility
    setXp(prev => {
      const newXp = prev + earnedXp;
      const nextLevelXp = level * 1000;
      if (newXp >= nextLevelXp) {
        setLevel(l => l + 1);
        return newXp - nextLevelXp;
      }
      return newXp;
    });

    if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
      lobbySocketRef.current.send(JSON.stringify({
        type: "HIGH_SCORE_UPDATE",
        game,
        score,
        xp: earnedXp,
        playerId: persistentId
      }));
    }
  };

  const quickChat = (emoji: string) => {
    setChatInput(prev => prev + emoji);
  };

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (freq: number, type: OscillatorType = "square", duration: number = 0.1) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === "suspended") audioCtx.resume();
      
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

  const connect = (mode: string) => {
    setGameMode(mode as any);
    setGameState("playing");
  };

  const createPeer = (peerToId: string, myId: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on("signal", (signal) => {
      lobbySocketRef.current?.send(JSON.stringify({
        type: "VOICE_SIGNAL",
        targetId: peerToId,
        signal,
      }));
    });

    peer.on("stream", (remoteStream) => {
      handleRemoteStream(peerToId, remoteStream);
    });

    return peer;
  };

  const addPeer = (incomingSignal: any, callerId: string, myId: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on("signal", (signal) => {
      lobbySocketRef.current?.send(JSON.stringify({
        type: "VOICE_SIGNAL",
        targetId: callerId,
        signal,
      }));
    });

    peer.on("stream", (remoteStream) => {
      handleRemoteStream(callerId, remoteStream);
    });

    peer.signal(incomingSignal);
    return peer;
  };

  const handleRemoteStream = (peerId: string, stream: MediaStream) => {
    if (!audioRefs.current[peerId]) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.srcObject = stream;
      audioRefs.current[peerId] = audio;
      document.body.appendChild(audio);
    }
  };

  const joinVoice = async (roomId: string = "public") => {
    try {
      console.log(`[Voice] Requesting microphone access for room: ${roomId}`);
      const constraints = {
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (lobbySocketRef.current?.readyState === WebSocket.OPEN) {
        lobbySocketRef.current.send(JSON.stringify({ type: "VOICE_JOIN", roomId }));
      } else {
        console.error("[Voice] Lobby socket not open");
      }
    } catch (err) {
      console.error("[Voice] Failed to get local stream", err);
    }
  };

  const leaveVoice = () => {
    lobbySocketRef.current?.send(JSON.stringify({ type: "VOICE_LEAVE" }));
    setVoiceRoomId(null);
    setVoicePeers([]);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
    Object.values(audioRefs.current).forEach(audio => audio.remove());
    audioRefs.current = {};
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsVoiceMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#050505] text-white font-sans overflow-y-auto flex flex-col items-center justify-center touch-none select-none relative"
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

      {/* Offline Mode Indicator */}
      {isOffline && (
        <div className="fixed top-4 right-4 z-[200] bg-red-500/20 border border-red-500/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Offline Mode</span>
        </div>
      )}

      {/* Persistent Voice Overlay */}
      {voiceRoomId && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed bottom-8 left-8 z-[150] flex flex-col gap-2"
        >
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isVoiceMuted ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Voice: {voiceRoomId}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleMute}
                className={`p-2 rounded-xl transition-all ${isVoiceMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
              >
                {isVoiceMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button 
                onClick={leaveVoice}
                className="p-2 bg-white/5 text-white/60 hover:bg-red-500 hover:text-white rounded-xl transition-all"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {voicePeers.map(peerId => (
              <motion.div 
                key={peerId}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-3 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/60">Peer_{peerId.slice(0, 4)}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

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
                    <Gamepad2 className="w-12 h-12 text-white" />
                  </motion.div>
                  <div className="absolute -bottom-2 -right-2 bg-white text-black p-2 rounded-xl shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                    <Crown className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none font-display bg-gradient-to-r from-white via-white to-orange-500 bg-clip-text text-transparent">
                    NEON<span className="text-orange-500">ARCADE</span>
                  </h1>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Neon-fueled retro gaming</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-full border border-white/10 backdrop-blur-xl">
                  <div className="flex items-center gap-3 px-6 py-3 bg-black/40 rounded-full border border-white/5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <div>
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Players Online</p>
                      <p className="text-sm font-black leading-none">{onlineCount}</p>
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all mr-2"
                  >
                    <Settings className="w-6 h-6 text-white/60" />
                  </button>
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
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Settings className="w-24 h-24" />
                  </div>
                  
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-6 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    My Stats
                  </h3>

                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
                      <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center font-black text-xl italic shadow-lg shadow-orange-500/20">
                        {level}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/40">
                          <span>Your Progress</span>
                          <span>{xp} / {level * 1000} XP</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-orange-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(xp / (level * 1000)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Your Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={playerNameInput}
                          onChange={(e) => setPlayerNameInput(e.target.value)}
                          onBlur={() => setPlayerName(playerNameInput)}
                          onKeyDown={(e) => e.key === "Enter" && setPlayerName(playerNameInput)}
                          placeholder="What should we call you?"
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all font-black uppercase italic text-lg tracking-tight placeholder:text-white/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Find Friends</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => searchPlayers(e.target.value)}
                          placeholder="Search Players..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-all font-bold text-xs tracking-tight placeholder:text-white/10"
                        />
                      </div>
                      
                      <AnimatePresence>
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-black/60 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5"
                        >
                          {searchResults.length > 0 ? searchResults.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                              <span className="font-bold text-xs">{p.name}</span>
                              <button 
                                onClick={() => invitePlayer(p.id)}
                                className="p-1.5 bg-blue-500/20 hover:bg-blue-500 text-blue-500 hover:text-white rounded-lg transition-all"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )) : (
                            <div className="p-3 text-center text-white/20 text-[10px] font-bold uppercase tracking-widest">
                              {searchQuery ? "No Players Found" : "No Players Online"}
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Voice Chat Section */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      Voice Chat
                    </h3>
                  </div>

                  {!voiceRoomId ? (
                    <div className="space-y-4">
                      <button 
                        onClick={() => joinVoice("public")}
                        className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-2xl font-black uppercase italic text-sm tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                      >
                        <Mic className="w-5 h-5" />
                        Join Public Room
                      </button>
                      
                      <div className="relative group/voice">
                        <input
                          type="text"
                          value={voiceRoomInput}
                          onChange={(e) => setVoiceRoomInput(e.target.value)}
                          placeholder="Private Code"
                          className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 pr-16 focus:outline-none focus:border-orange-500 transition-all font-black uppercase italic text-xs tracking-tight placeholder:text-white/10"
                        />
                        <button 
                          onClick={() => voiceRoomInput && joinVoice(voiceRoomInput)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl font-black uppercase italic text-[10px] tracking-widest transition-all"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-black/40 p-5 rounded-3xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Volume2 className="w-16 h-16" />
                      </div>
                      
                      <div className="flex items-center justify-between relative z-10">
                        <div>
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Active Room</p>
                          <p className="text-sm font-black uppercase italic text-orange-500 tracking-tight">{voiceRoomId}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={toggleMute}
                            className={`p-3 rounded-xl transition-all ${isVoiceMuted ? 'bg-red-500/20 text-red-500 shadow-lg shadow-red-500/10' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                          >
                            {isVoiceMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                          </button>
                          <button 
                            onClick={leaveVoice}
                            className="p-3 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-xl transition-all shadow-lg shadow-red-500/10"
                          >
                            <PhoneOff className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 relative z-10">
                        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Connected ({voicePeers.length + 1})</p>
                        <div className="flex flex-wrap gap-2">
                          <div className="px-3 py-1.5 bg-orange-500/20 rounded-xl border border-orange-500/30 flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase italic text-orange-500">You</span>
                          </div>
                          {voicePeers.map(peerId => (
                            <div key={peerId} className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-[10px] font-black uppercase italic text-white/60">Brawler</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Party Section */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
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

                  <div className="space-y-2">
                    {party ? party.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="relative">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-black text-xs">
                            {m.name[0].toUpperCase()}
                          </div>
                          {m.isTalking && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#050505] animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-xs">{m.name}</p>
                          <p className="text-[7px] font-black text-white/20 uppercase tracking-widest">
                            {m.id === party.leaderId ? "Party Leader" : "Member"}
                          </p>
                        </div>
                        {m.id === party.leaderId && <Crown className="w-3 h-3 text-yellow-500" />}
                      </div>
                    )) : (
                      <div className="text-center py-6 space-y-3">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6 text-white/10" />
                        </div>
                        <p className="text-white/20 text-[8px] font-black uppercase tracking-widest">Solo Queue Active</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Leaderboard Section */}
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-6 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Top Players
                  </h3>
                  <div className="space-y-3">
                    {leaderboard.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-white/20 w-4">{i + 1}</span>
                          <div>
                            <p className="text-xs font-bold">{entry.name}</p>
                            <p className="text-[7px] font-black text-white/20 uppercase tracking-widest">Level {entry.level}</p>
                          </div>
                        </div>
                        <span className="text-xs font-black italic text-yellow-500">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle Column: Game Modes */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                {/* Daily Challenge & Matchmaking */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-white/10 p-6 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <Zap className="w-16 h-16" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Today's Quest</h4>
                    <p className="text-sm font-black uppercase italic mb-1">Score {dailyChallenge.goal} in {dailyChallenge.game.replace('_', ' ')}</p>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Reward: {dailyChallenge.reward} XP</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">Quick Match</h4>
                      <p className="text-xs font-bold text-white/60">{isSearching ? "Searching for players..." : "Ready to play?"}</p>
                    </div>
                    <button 
                      onClick={() => setIsSearching(!isSearching)}
                      className={`px-6 py-3 rounded-xl font-black uppercase italic text-xs transition-all ${isSearching ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20'}`}
                    >
                      {isSearching ? "Cancel" : "Find Match"}
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] backdrop-blur-2xl shadow-2xl flex-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-72 h-72 bg-orange-500/5 blur-[80px] rounded-full -mr-36 -mt-36" />
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4" />
                      Choose Your Game
                    </h3>
                    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                      {(['easy', 'medium', 'hard'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${difficulty === d ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("neon_neon")}
                      className="group relative bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-orange-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Target className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Neon Neon</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Reflex test. Click the targets before they vanish.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("grid_runner")}
                      className="group relative bg-gradient-to-br from-blue-600 to-cyan-700 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-blue-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Square className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Grid Runner</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Survival. Dodge the falling red blocks.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("synth_wave")}
                      className="group relative bg-gradient-to-br from-purple-600 to-indigo-800 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-purple-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Music className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Music className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Synth Wave</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Rhythm. Tap the notes to the beat.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("pixel_jump")}
                      className="group relative bg-gradient-to-br from-yellow-500 to-orange-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-yellow-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <ArrowUp className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <ArrowUp className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Pixel Jump</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Platformer. Jump higher and higher.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("void_dash")}
                      className="group relative bg-gradient-to-br from-gray-800 to-black p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-black/50 border border-white/5"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <ChevronRight className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                        <Zap className="w-5 h-5 text-cyan-500" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Void Dash</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Side-scroller. Avoid the neon pillars.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("block_blast")}
                      className="group relative bg-gradient-to-br from-cyan-500/80 to-blue-600/80 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-cyan-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <LayoutGrid className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <LayoutGrid className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Block Blast</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Puzzle. Clear lines with neon blocks.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("neon_snake")}
                      className="group relative bg-gradient-to-br from-green-500 to-emerald-700 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-green-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Zap className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Neon Snake</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Classic. Eat to grow, don't hit the walls.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("color_match")}
                      className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-blue-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Target className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Color Match</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Reflex. Match the color, not the word.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("memory_grid")}
                      className="group relative bg-gradient-to-br from-purple-500 to-pink-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-purple-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <LayoutGrid className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <LayoutGrid className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Memory Grid</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Brain. Remember the glowing pattern.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("speed_typer")}
                      className="group relative bg-gradient-to-br from-cyan-500 to-blue-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-cyan-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <MessageSquare className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Speed Typer</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Skill. Type the words as fast as you can.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("circle_survive")}
                      className="group relative bg-gradient-to-br from-yellow-500 to-orange-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-yellow-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Target className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Circle Survive</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Precision. Stay inside the moving ring.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("gravity_ball")}
                      className="group relative bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-pink-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <ArrowUp className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <ArrowUp className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Gravity Ball</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Control. Navigate the ball through obstacles.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("neon_paddle")}
                      className="group relative bg-gradient-to-br from-cyan-400 to-blue-500 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-cyan-400/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Square className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Square className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Neon Paddle</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Arcade. Classic paddle survival.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("hex_escape")}
                      className="group relative bg-gradient-to-br from-red-500 to-orange-700 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-red-500/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Target className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Hex Escape</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Dodge. Escape the closing hexagons.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("bit_drifter")}
                      className="group relative bg-gradient-to-br from-blue-400 to-indigo-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-blue-400/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Zap className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Bit Drifter</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Racing. Dodge traffic at high speed.</p>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connect("pulse_wave")}
                      className="group relative bg-gradient-to-br from-green-400 to-emerald-600 p-6 rounded-[2rem] transition-all text-left overflow-hidden shadow-2xl shadow-green-400/20"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                        <Target className="w-24 h-24" />
                      </div>
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter mb-1">Pulse Wave</h4>
                      <p className="text-white/70 text-[10px] font-medium leading-tight">Rhythm. Tap when the pulse matches.</p>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Right Column: Chat */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl flex-1 flex flex-col overflow-hidden">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-6 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Community Chat
                  </h3>

                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-hide">
                    {chatMessages.filter(m => m.scope === "global").length > 0 ? (
                      chatMessages.filter(m => m.scope === "global").map((m, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase tracking-tighter ${(m as any).senderId === persistentId ? "text-orange-500" : "text-white/40"}`}>
                              {m.sender}
                            </span>
                            <span className="text-[7px] text-white/20 font-bold">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-white/80 leading-relaxed bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">
                            {m.text}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                        <MessageSquare className="w-12 h-12" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No messages yet</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mb-3">
                    {["🔥", "GG", "GL", "LOL", "🎮"].map(e => (
                      <button 
                        key={e}
                        onClick={() => quickChat(e)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black transition-all border border-white/5"
                      >
                        {e}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat("global")}
                      placeholder="Say something..."
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-green-500 transition-all font-bold text-xs placeholder:text-white/10"
                    />
                    <button 
                      onClick={() => sendChat("global")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-green-500 hover:text-white transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
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
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Game Invitation</p>
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
            {gameMode === "neon_neon" && <NeonNeon onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("neon_neon", s, Math.floor(s/10))} />}
            {gameMode === "grid_runner" && <GridRunner onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("grid_runner", s, Math.floor(s/5))} />}
            {gameMode === "synth_wave" && <SynthWave onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("synth_wave", s, Math.floor(s/2))} />}
            {gameMode === "pixel_jump" && <PixelJump onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("pixel_jump", s, Math.floor(s/1))} />}
            {gameMode === "void_dash" && <VoidDash onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("void_dash", s, Math.floor(s/10))} />}
            {gameMode === "block_blast" && <BlockBlast onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("block_blast", s, Math.floor(s/1))} />}
            {gameMode === "neon_snake" && <NeonSnake onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("neon_snake", s, Math.floor(s/1))} />}
            {gameMode === "color_match" && <ColorMatch onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("color_match", s, Math.floor(s/1))} />}
            {gameMode === "memory_grid" && <MemoryGrid onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("memory_grid", s, Math.floor(s/1))} />}
            {gameMode === "speed_typer" && <SpeedTyper onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("speed_typer", s, Math.floor(s/1))} />}
            {gameMode === "circle_survive" && <CircleSurvive onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("circle_survive", s, Math.floor(s/1))} />}
            {gameMode === "gravity_ball" && <GravityBall onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("gravity_ball", s, Math.floor(s/1))} />}
            {gameMode === "neon_paddle" && <NeonPaddle onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("neon_paddle", s, Math.floor(s/1))} />}
            {gameMode === "hex_escape" && <HexEscape onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("hex_escape", s, Math.floor(s/1))} />}
            {gameMode === "bit_drifter" && <BitDrifter onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("bit_drifter", s, Math.floor(s/1))} />}
            {gameMode === "pulse_wave" && <PulseWave onExit={() => setGameState("lobby")} onScoreUpdate={(s) => updateHighScore("pulse_wave", s, Math.floor(s/1))} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white/5 border border-white/10 p-10 rounded-[3rem] max-w-md w-full relative overflow-hidden"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-6 h-6 text-white/40" />
              </button>

              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white mb-8">Preferences</h2>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Microphone Selection</label>
                  <select 
                    value={selectedAudioDevice}
                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all font-bold text-xs"
                  >
                    {audioDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Interface Color</label>
                  <div className="flex gap-3">
                    {["orange", "blue", "purple", "green", "pink"].map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          setNeonColor(c);
                          localStorage.setItem("neonColor", c);
                        }}
                        className={`w-10 h-10 rounded-xl border-2 transition-all ${neonColor === c ? 'border-white scale-110' : 'border-transparent opacity-40 hover:opacity-100'}`}
                        style={{ backgroundColor: c === "orange" ? "#f97316" : c === "blue" ? "#3b82f6" : c === "purple" ? "#a855f7" : c === "green" ? "#22c55e" : "#ec4899" }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold">Sound Effects</p>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Mute All Sounds</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsAudioEnabled(!isAudioEnabled);
                      localStorage.setItem("isAudioEnabled", (!isAudioEnabled).toString());
                    }}
                    className={`w-12 h-6 rounded-full transition-all relative ${isAudioEnabled ? 'bg-green-500' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                      animate={{ x: isAudioEnabled ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">My Trophies</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className={`aspect-square rounded-xl flex items-center justify-center border ${i < achievements.length ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/10 text-white/10'}`}>
                        <Trophy className="w-5 h-5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
