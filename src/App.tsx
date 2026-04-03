import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Mic, MicOff, PhoneOff, Users, Settings, 
  MessageSquare, Send, Volume2, VolumeX, 
  Hash, Plus, LogOut, User, Activity,
  Rocket, Sparkles, Gamepad2, Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Stars, Float, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import SimplePeer from "simple-peer";
import { nanoid } from "nanoid";
import { Buffer } from "buffer";
import { GoogleGenAI, Type } from "@google/genai";

// Polyfill for simple-peer
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const FallingStars = () => {
  const count = 100;
  const mesh = useRef<THREE.Points>(null);
  const [positions] = useState(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  });

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= delta * 2; // Fall down
      if (pos[i * 3 + 1] < -10) {
        pos[i * 3 + 1] = 10;
        pos[i * 3] = (Math.random() - 0.5) * 20;
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#fb923c" transparent opacity={0.8} />
    </points>
  );
};

const Saturn = () => {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y += 0.005;
      group.current.rotation.z += 0.002;
    }
  });

  return (
    <group ref={group} position={[5, 2, -5]}>
      {/* Planet */}
      <Sphere args={[1.5, 64, 64]}>
        <meshStandardMaterial color="#fbbf24" roughness={0.8} />
      </Sphere>
      {/* Rings */}
      <mesh rotation={[Math.PI / 2.5, 0, 0]}>
        <ringGeometry args={[2, 3.5, 64]} />
        <meshStandardMaterial color="#d97706" side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
    </group>
  );
};

const SpaceWallpaper = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <Canvas camera={{ position: [0, 0, 10] }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#fb923c" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Saturn />
        <FallingStars />
      </Canvas>
    </div>
  );
};

const AIGameLab = ({ onGameCreated }: { onGameCreated: (code: string) => void }) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateGame = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a simple, self-contained React component for a mini-game based on this prompt: "${prompt}". 
        The game should be fun, visual, and use Tailwind CSS. 
        Return ONLY the code for the component, no markdown blocks, no extra text. 
        The component should be named 'MiniGame'. 
        Use standard React hooks. 
        Assume 'lucide-react' and 'motion/react' are available.`,
      });
      const code = response.text || "";
      onGameCreated(code);
    } catch (err) {
      console.error("AI Generation failed", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-3xl space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Cpu className="w-6 h-6 text-orange-500" />
        <h3 className="text-xl font-black text-white uppercase italic tracking-tight">AI Game Lab</h3>
      </div>
      <p className="text-sm text-neutral-400">Ask the AI to create a mini-game for you to play while you chat.</p>
      <div className="flex gap-3">
        <input 
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A space dodger game with falling stars..."
          className="flex-1 bg-neutral-800 border border-neutral-700 text-white px-4 py-3 rounded-2xl focus:outline-none focus:border-orange-500 transition-all"
        />
        <button 
          onClick={generateGame}
          disabled={isGenerating}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-lg shadow-orange-500/20 uppercase italic tracking-widest disabled:opacity-50"
        >
          {isGenerating ? <Activity className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

interface ChatMessage {
  sender: string;
  senderId: string;
  text: string;
  timestamp: number;
  scope: string;
}

const VoiceVisualizer = ({ analyzer, isMuted }: { analyzer: AnalyserNode | null, isMuted?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyzer || isMuted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrame = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(249, 115, 22, ${dataArray[i] / 255})`; // orange-500
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [analyzer, isMuted]);

  return <canvas ref={canvasRef} width={100} height={20} className="w-full h-4 opacity-50" />;
};

export default function App() {
  const [persistentId] = useState(() => {
    const saved = localStorage.getItem("persistentId");
    if (saved) return saved;
    const newId = nanoid();
    localStorage.setItem("persistentId", newId);
    return newId;
  });

  const [playerName, setPlayerName] = useState(() => localStorage.getItem("playerName") || "User_" + Math.floor(Math.random() * 1000));
  const [playerNameInput, setPlayerNameInput] = useState(playerName);
  const [isNameSet, setIsNameSet] = useState(() => !!localStorage.getItem("playerName"));

  const [onlineCount, setOnlineCount] = useState(0);
  const [voiceRoomId, setVoiceRoomId] = useState<string | null>(null);
  const [voicePeers, setVoicePeers] = useState<string[]>([]);
  const [speakingPeers, setSpeakingPeers] = useState<Set<string>>(new Set());
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isVoiceJoining, setIsVoiceJoining] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [privateRoomInput, setPrivateRoomInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "lab">("chat");
  const [generatedGameCode, setGeneratedGameCode] = useState<string | null>(null);

  const lobbySocketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, SimplePeer.Instance>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const analyzersRef = useRef<Record<string, AnalyserNode>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [selectedAudioDevice, setSelectedAudioDevice] = useState(() => localStorage.getItem("selectedAudioDevice") || "");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState(() => localStorage.getItem("selectedAudioOutputDevice") || "");
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);

  // Initialize WebSockets
  useEffect(() => {
    connectLobby();
    return () => lobbySocketRef.current?.close();
  }, []);

  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission first to get labeled devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        const audioOutputs = devices.filter(d => d.kind === "audiooutput");
        
        setAudioDevices(audioInputs);
        setAudioOutputDevices(audioOutputs);

        if (!selectedAudioDevice && audioInputs.length > 0) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (!selectedAudioOutputDevice && audioOutputs.length > 0) {
          setSelectedAudioOutputDevice(audioOutputs[0].deviceId);
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
    localStorage.setItem("selectedAudioOutputDevice", selectedAudioOutputDevice);
    // Apply to all active audio elements
    Object.values(audioRefs.current).forEach(audio => {
      if ((audio as any).setSinkId) {
        (audio as any).setSinkId(selectedAudioOutputDevice).catch(console.error);
      }
    });
  }, [selectedAudioOutputDevice]);

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
        case "LOBBY_INIT":
          setOnlineCount(data.onlineCount || 0);
          break;
        case "LOBBY_UPDATE":
        case "ONLINE_COUNT":
          setOnlineCount(data.onlineCount || data.count || 0);
          break;
        case "CHAT_MESSAGE":
          setChatMessages(prev => [...prev.slice(-99), data]);
          break;
        case "VOICE_JOIN_SUCCESS":
          setVoiceRoomId(data.roomId);
          setIsVoiceJoining(false);
          setPrivateRoomInput("");
          // Initiate connections to existing peers
          data.peers.forEach((peerId: string) => {
            const peer = createPeer(peerId, persistentId, localStreamRef.current!);
            peersRef.current[peerId] = peer;
          });
          setVoicePeers(data.peers);
          break;
        case "VOICE_PEER_JOINED":
          // We wait for them to signal us (they are the initiator)
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
          if (analyzersRef.current[data.peerId]) {
            delete analyzersRef.current[data.peerId];
          }
          setVoicePeers(prev => prev.filter(id => id !== data.peerId));
          setSpeakingPeers(prev => {
            const next = new Set(prev);
            next.delete(data.peerId);
            return next;
          });
          break;
      }
    };

    socket.onclose = () => {
      setTimeout(connectLobby, 3000);
    };
  };

  const createPeer = (targetId: string, callerId: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });

    peer.on("signal", signal => {
      lobbySocketRef.current?.send(JSON.stringify({ type: "VOICE_SIGNAL", targetId, signal }));
    });

    peer.on("stream", stream => handleRemoteStream(targetId, stream));
    
    peer.on("error", err => {
      console.error(`[Voice] Peer error with ${targetId}:`, err);
      setVoiceError(`Connection error with a peer.`);
    });

    return peer;
  };

  const addPeer = (incomingSignal: any, callerId: string, targetId: string, stream: MediaStream) => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });

    peer.on("signal", signal => {
      lobbySocketRef.current?.send(JSON.stringify({ type: "VOICE_SIGNAL", targetId: callerId, signal }));
    });

    peer.on("stream", stream => handleRemoteStream(callerId, stream));
    
    peer.on("error", err => {
      console.error(`[Voice] Peer error with ${callerId}:`, err);
    });

    peer.signal(incomingSignal);
    return peer;
  };

  const handleRemoteStream = (peerId: string, stream: MediaStream) => {
    console.log(`[Voice] Received remote stream from ${peerId}`);
    
    // Create audio element and append to DOM to ensure it's not throttled
    let audio = audioRefs.current[peerId];
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioRefs.current[peerId] = audio;
    }
    
    audio.srcObject = stream;
    if ((audio as any).setSinkId && selectedAudioOutputDevice) {
      (audio as any).setSinkId(selectedAudioOutputDevice).catch(console.error);
    }
    
    // Attempt to play (browsers might block)
    audio.play().catch(err => {
      console.warn(`[Voice] Autoplay blocked for ${peerId}, waiting for user interaction`, err);
    });

    // Speaking detection
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    const source = audioCtxRef.current.createMediaStreamSource(stream);
    const analyzer = audioCtxRef.current.createAnalyser();
    analyzer.fftSize = 512;
    source.connect(analyzer);
    analyzersRef.current[peerId] = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    const checkSpeaking = () => {
      if (!analyzersRef.current[peerId]) return;
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      setSpeakingPeers(prev => {
        const next = new Set(prev);
        if (average > 25) next.add(peerId);
        else next.delete(peerId);
        return next;
      });
      
      requestAnimationFrame(checkSpeaking);
    };
    checkSpeaking();
  };

  const joinVoice = async (roomId: string = "public") => {
    try {
      setVoiceError(null);
      if (!window.isSecureContext) {
        throw new Error("Voice chat requires a secure (HTTPS) connection.");
      }
      setIsVoiceJoining(true);

      // Ensure AudioContext is resumed
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined
        } 
      });
      localStreamRef.current = stream;

      // Local speaking detection
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyzer = audioCtxRef.current.createAnalyser();
      analyzer.fftSize = 512;
      source.connect(analyzer);
      analyzersRef.current["local"] = analyzer;

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const checkSpeaking = () => {
        if (!analyzersRef.current["local"]) return;
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setSpeakingPeers(prev => {
          const next = new Set(prev);
          if (average > 25 && !isVoiceMuted) next.add("local");
          else next.delete("local");
          return next;
        });
        requestAnimationFrame(checkSpeaking);
      };
      checkSpeaking();

      lobbySocketRef.current?.send(JSON.stringify({ type: "VOICE_JOIN", roomId }));
    } catch (err: any) {
      console.error("[Voice] Join failed:", err);
      setVoiceError(err.message || "Failed to access microphone.");
      setIsVoiceJoining(false);
    }
  };

  const leaveVoice = () => {
    lobbySocketRef.current?.send(JSON.stringify({ type: "VOICE_LEAVE" }));
    setVoiceRoomId(null);
    setVoicePeers([]);
    setSpeakingPeers(new Set());
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
    Object.values(audioRefs.current).forEach(audio => audio.remove());
    audioRefs.current = {};
    analyzersRef.current = {};
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
      audioCtxRef.current = null;
    }
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

  const sendChat = () => {
    if (!chatInput.trim()) return;
    lobbySocketRef.current?.send(JSON.stringify({
      type: "CHAT_MESSAGE",
      text: chatInput,
      playerId: persistentId
    }));
    setChatInput("");
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerNameInput.trim()) {
      setPlayerName(playerNameInput.trim());
      localStorage.setItem("playerName", playerNameInput.trim());
      setIsNameSet(true);
      lobbySocketRef.current?.send(JSON.stringify({ type: "LOBBY_JOIN", name: playerNameInput.trim(), playerId: persistentId }));
    }
  };

  if (!isNameSet) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Mic className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2 uppercase tracking-tight italic">VoiceHub</h1>
          <p className="text-neutral-500 text-center mb-8 text-sm">Set your display name to start chatting.</p>
          
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input 
              type="text"
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              placeholder="Enter your name..."
              maxLength={20}
              className="w-full bg-neutral-800 border border-neutral-700 text-white px-6 py-4 rounded-2xl focus:outline-none focus:border-orange-500 transition-all font-bold"
            />
            <button 
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 uppercase italic tracking-widest"
            >
              Enter Hub
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans flex flex-col md:flex-row overflow-hidden relative"
      onClick={() => {
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      }}
    >
      <SpaceWallpaper />
      
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-neutral-900/80 backdrop-blur-xl border-r border-neutral-800 flex flex-col shrink-0 relative z-10">
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-black text-white uppercase italic tracking-tight">VoiceHub</h1>
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <Users className="w-4 h-4" />
            <span className="text-xs font-bold">{onlineCount}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Rooms */}
          <section>
            <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4 px-2">Voice Channels</h2>
            <div className="space-y-1">
              {["Public Lobby", "Gaming", "Music", "Chill"].map((room) => (
                <button
                  key={room}
                  onClick={() => !voiceRoomId && joinVoice(room.toLowerCase().replace(" ", "_"))}
                  disabled={!!voiceRoomId && voiceRoomId !== room.toLowerCase().replace(" ", "_")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                    voiceRoomId === room.toLowerCase().replace(" ", "_") 
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/10" 
                    : "hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Hash className={`w-4 h-4 ${voiceRoomId === room.toLowerCase().replace(" ", "_") ? "text-white" : "text-neutral-600"}`} />
                    <span className="text-sm font-bold">{room}</span>
                  </div>
                  {voiceRoomId === room.toLowerCase().replace(" ", "_") && (
                    <Activity className="w-3 h-3 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Private Room */}
          <section>
            <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4 px-2">Private Room</h2>
            <div className="px-2 space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={privateRoomInput}
                  onChange={(e) => setPrivateRoomInput(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  maxLength={6}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-orange-500 transition-all"
                />
                <button 
                  onClick={() => privateRoomInput.length >= 3 && joinVoice(`private_${privateRoomInput}`)}
                  disabled={!!voiceRoomId || privateRoomInput.length < 3 || isVoiceJoining}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-orange-500 rounded-xl transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-tight">Enter a code to join or create a private room.</p>
            </div>
          </section>

          {/* Connected Peers */}
          {voiceRoomId && (
            <section>
              <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4 px-2">Participants</h2>
              <div className="space-y-2">
                <div className={`p-3 rounded-xl border transition-all ${speakingPeers.has("local") ? 'bg-orange-500/10 border-orange-500/50' : 'bg-neutral-800/50 border-neutral-700'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative">
                      <div className="w-8 h-8 bg-neutral-700 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-900 ${speakingPeers.has("local") ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate">{playerName} (You)</p>
                      <p className="text-[10px] text-neutral-500 uppercase font-bold">{isVoiceMuted ? 'Muted' : 'Active'}</p>
                    </div>
                  </div>
                  <VoiceVisualizer analyzer={analyzersRef.current["local"]} isMuted={isVoiceMuted} />
                </div>

                {voicePeers.map(peerId => (
                  <div key={peerId} className={`p-3 rounded-xl border transition-all ${speakingPeers.has(peerId) ? 'bg-green-500/10 border-green-500/50' : 'bg-neutral-800/50 border-neutral-700'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="relative">
                        <div className="w-8 h-8 bg-neutral-700 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-neutral-400" />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-900 ${speakingPeers.has(peerId) ? 'bg-green-500 animate-pulse' : 'bg-neutral-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate">User_{peerId.slice(0, 4)}</p>
                        <p className="text-[10px] text-neutral-500 uppercase font-bold">Connected</p>
                      </div>
                    </div>
                    <VoiceVisualizer analyzer={analyzersRef.current[peerId]} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* User Controls */}
        <div className="p-4 bg-neutral-950/50 border-t border-neutral-800">
          {voiceRoomId ? (
            <div className="flex items-center justify-between gap-2">
              <button 
                onClick={toggleMute}
                className={`flex-1 p-3 rounded-xl flex items-center justify-center transition-all ${isVoiceMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
              >
                {isVoiceMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button 
                onClick={leaveVoice}
                className="flex-1 p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/20"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => joinVoice("public")}
              disabled={isVoiceJoining}
              className="w-full p-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-500/20 uppercase italic tracking-widest disabled:opacity-50"
            >
              {isVoiceJoining ? <Activity className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
              Join Voice
            </button>
          )}
          {voiceError && (
            <p className="mt-3 text-[10px] font-bold text-red-500 uppercase text-center">{voiceError}</p>
          )}
        </div>
      </aside>

      {/* Main Content (Chat) */}
      <main className="flex-1 flex flex-col bg-neutral-950 relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        <header className="p-6 border-b border-neutral-900 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-lg font-black text-white uppercase italic tracking-tight">
                {voiceRoomId ? `# ${voiceRoomId.replace("_", " ")}` : "Global Hub"}
              </h2>
              <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                {voiceRoomId ? "Voice Connected" : "Select a channel to join voice"}
              </p>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1 bg-neutral-900/50 p-1 rounded-xl border border-neutral-800">
              <button 
                onClick={() => setActiveTab("chat")}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase italic transition-all ${activeTab === "chat" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                Chat
              </button>
              <button 
                onClick={() => setActiveTab("lab")}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase italic transition-all ${activeTab === "lab" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                AI Lab
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-neutral-500 hover:text-white transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem("playerName");
                window.location.reload();
              }}
              className="p-2 text-neutral-500 hover:text-red-500 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-10">
          {activeTab === "chat" ? (
            <AnimatePresence initial={false}>
              {chatMessages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-black text-orange-500 uppercase italic">{msg.sender}</span>
                    <span className="text-[10px] text-neutral-600 font-bold">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed max-w-2xl bg-neutral-900/50 p-3 rounded-2xl border border-neutral-800/50">
                    {msg.text}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="max-w-4xl mx-auto w-full space-y-8">
              <AIGameLab onGameCreated={(code) => setGeneratedGameCode(code)} />
              
              {generatedGameCode && (
                <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 min-h-[400px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="w-5 h-5 text-orange-500" />
                      <h4 className="text-sm font-black text-white uppercase italic tracking-tight">Generated Game</h4>
                    </div>
                    <button 
                      onClick={() => setGeneratedGameCode(null)}
                      className="text-xs font-bold text-neutral-500 hover:text-red-500 uppercase tracking-widest"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden relative">
                    {/* Game Sandbox Simulation */}
                    <div className="text-center p-8">
                      <Rocket className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-bounce" />
                      <h5 className="text-lg font-black text-white uppercase italic mb-2">Game Ready!</h5>
                      <p className="text-sm text-neutral-500 mb-6 max-w-xs">The AI has generated your game code. In a full production environment, this would be dynamically rendered here.</p>
                      <pre className="text-[10px] text-left bg-black p-4 rounded-xl overflow-auto max-h-40 border border-neutral-800 text-orange-400 font-mono">
                        {generatedGameCode.slice(0, 500)}...
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="h-4" />
        </div>

        <div className="p-6 border-t border-neutral-900 relative z-10">
          <form 
            onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 p-2 rounded-2xl focus-within:border-orange-500 transition-all"
          >
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-white px-4 py-2 focus:outline-none font-medium text-sm"
            />
            <button 
              type="submit"
              className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-lg shadow-orange-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-black text-white uppercase italic tracking-tight">Device Settings</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-neutral-500 hover:text-white transition-all"
                >
                  <LogOut className="w-5 h-5 rotate-180" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Input Device */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-neutral-500" />
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Input Device (Microphone)</label>
                  </div>
                  <select 
                    value={selectedAudioDevice}
                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 text-white px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500 transition-all appearance-none"
                  >
                    {audioDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0, 4)}`}</option>
                    ))}
                  </select>
                </div>

                {/* Output Device */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-neutral-500" />
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Output Device (Speakers)</label>
                  </div>
                  <select 
                    value={selectedAudioOutputDevice}
                    onChange={(e) => setSelectedAudioOutputDevice(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 text-white px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500 transition-all appearance-none"
                  >
                    {audioOutputDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${device.deviceId.slice(0, 4)}`}</option>
                    ))}
                  </select>
                  <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-tight">Note: Output device selection may not be supported in all browsers (e.g. Safari).</p>
                </div>
              </div>

              <div className="p-6 bg-neutral-950/50 border-t border-neutral-800">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 uppercase italic tracking-widest"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
