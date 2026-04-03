import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Target, Zap, X } from 'lucide-react';

interface SpeedTyperDuelProps {
  onExit: () => void;
  onScoreUpdate: (score: number) => void;
  socket: WebSocket | null;
  playerId: string;
  roomId: string;
  isHost: boolean;
  opponentName: string;
}

const WORDS = [
  "neon", "arcade", "cyber", "synth", "grid", "pulse", "void", "pixel", "retro", "wave",
  "laser", "glow", "fast", "speed", "type", "duel", "match", "win", "lose", "game",
  "player", "score", "high", "level", "xp", "rank", "top", "best", "cool", "fun",
  "code", "dev", "web", "app", "site", "page", "link", "url", "api", "json",
  "react", "vite", "node", "npm", "git", "hub", "lab", "box", "cloud", "data"
];

export const SpeedTyperDuel: React.FC<SpeedTyperDuelProps> = ({ onExit, onScoreUpdate, socket, playerId, roomId, isHost, opponentName }) => {
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameover'>('waiting');
  const [currentWord, setCurrentWord] = useState("");
  const [input, setInput] = useState("");
  const [myProgress, setMyProgress] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  
  const lastSyncRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.type === "GAME_UPDATE") {
        if (data.state.progress !== undefined) {
          setOpponentProgress(data.state.progress);
        }
        if (data.state.words) {
          setTargetWords(data.state.words);
          setCurrentWord(data.state.words[0]);
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
    if (isHost) {
      const words = Array.from({ length: 20 }, () => WORDS[Math.floor(Math.random() * WORDS.length)]);
      setTargetWords(words);
      setCurrentWord(words[0]);
      socket?.send(JSON.stringify({
        type: "GAME_SYNC",
        roomId,
        state: { words }
      }));
    }
    setGameState('playing');
  }, [isHost, roomId, socket]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    if (val.trim() === currentWord) {
      const nextProgress = myProgress + 1;
      setMyProgress(nextProgress);
      setInput("");
      
      if (nextProgress >= targetWords.length) {
        socket?.send(JSON.stringify({
          type: "GAME_SYNC",
          roomId,
          state: { gameOver: true, winner: "You" }
        }));
        setGameState('gameover');
        setWinner("You");
        onScoreUpdate(100);
      } else {
        setCurrentWord(targetWords[nextProgress]);
        socket?.send(JSON.stringify({
          type: "GAME_SYNC",
          roomId,
          state: { progress: nextProgress }
        }));
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black/90 backdrop-blur-3xl p-8">
      <div className="max-w-2xl w-full bg-white/5 border border-white/10 p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <MessageSquare className="w-48 h-48" />
        </div>

        <div className="flex items-center justify-between mb-12">
          <div className="space-y-4 flex-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              <span>You</span>
              <span>{Math.round((myProgress / targetWords.length) * 100)}%</span>
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                animate={{ width: `${(myProgress / targetWords.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="w-12" />
          <div className="space-y-4 flex-1">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              <span>{opponentName}</span>
              <span>{Math.round((opponentProgress / targetWords.length) * 100)}%</span>
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.5)]"
                animate={{ width: `${(opponentProgress / targetWords.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-center space-y-8 relative z-10">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Type this word</p>
            <h2 className="text-7xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              {currentWord}
            </h2>
          </div>

          <input
            autoFocus
            type="text"
            value={input}
            onChange={handleInput}
            className="w-full bg-white/5 border-4 border-white/10 rounded-3xl px-8 py-6 text-3xl font-black text-center focus:outline-none focus:border-cyan-500 transition-all placeholder:text-white/5"
            placeholder="Type here..."
          />
        </div>

        <AnimatePresence>
          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50"
            >
              <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white mb-4">
                {winner === "You" ? "Victory" : "Defeat"}
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
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Speed Typer Duel</p>
          </div>
        </div>
      </div>
    </div>
  );
};
