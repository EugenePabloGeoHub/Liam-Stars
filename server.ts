import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = Number(process.env.PORT) || 3000;

  // State
  const allPlayers: Record<string, { id: string, name: string, photoURL?: string, isSpeaking?: boolean, isMuted?: boolean }> = {};
  const playerSocketId: Record<string, string> = {}; // playerId -> socketId
  const socketPlayerId: Record<string, string> = {}; // socketId -> playerId
  const voiceRooms: Record<string, Set<string>> = {}; // roomId -> Set of playerIds

  const broadcastLobbyUpdate = () => {
    const onlinePlayers = Object.values(allPlayers).filter(p => playerSocketId[p.id]);
    io.emit("LOBBY_UPDATE", {
      onlineCount: onlinePlayers.length,
      players: onlinePlayers
    });
  };

  io.on("connection", (socket) => {
    let playerId: string = "";

    socket.on("LOBBY_JOIN", (data: { playerId: string, name: string, photoURL?: string }) => {
      playerId = data.playerId;
      socketPlayerId[socket.id] = playerId;
      playerSocketId[playerId] = socket.id;

      allPlayers[playerId] = { 
        id: playerId, 
        name: data.name,
        photoURL: data.photoURL,
        isSpeaking: false,
        isMuted: false
      };
      
      socket.emit("LOBBY_INIT", { 
        playerId,
        player: allPlayers[playerId]
      });
      
      broadcastLobbyUpdate();
    });

    socket.on("CHAT_MESSAGE", (data: { text: string, scope?: string }) => {
      if (!playerId) return;
      io.emit("CHAT_MESSAGE", {
        sender: allPlayers[playerId]?.name || "Unknown",
        senderId: playerId,
        text: data.text,
        timestamp: Date.now(),
        scope: data.scope || "global"
      });
    });

    socket.on("VOICE_JOIN", (data: { roomId: string }) => {
      if (!playerId) return;
      const vRoomId = data.roomId || "public";
      console.log(`[Voice] Player ${playerId} joining room: ${vRoomId}`);
      
      // Leave previous room if any
      const oldRoomId = Object.keys(voiceRooms).find(rid => voiceRooms[rid].has(playerId));
      if (oldRoomId) {
        voiceRooms[oldRoomId].delete(playerId);
        socket.to(oldRoomId).emit("VOICE_PEER_LEFT", { peerId: playerId });
        socket.leave(oldRoomId);
      }

      if (!voiceRooms[vRoomId]) voiceRooms[vRoomId] = new Set();
      voiceRooms[vRoomId].add(playerId);
      socket.join(vRoomId);

      // Notify others in new room
      socket.to(vRoomId).emit("VOICE_PEER_JOINED", { peerId: playerId });

      // Send current peers to the joining player
      const peers = Array.from(voiceRooms[vRoomId]).filter(id => id !== playerId);
      socket.emit("VOICE_JOIN_SUCCESS", { roomId: vRoomId, peers });
      
      broadcastLobbyUpdate();
    });

    socket.on("VOICE_SIGNAL", (data: { targetId: string, signal: any }) => {
      const targetSocketId = playerSocketId[data.targetId];
      if (targetSocketId) {
        io.to(targetSocketId).emit("VOICE_SIGNAL", { 
          senderId: playerId, 
          signal: data.signal 
        });
      }
    });

    socket.on("VOICE_STATE", (data: { isMuted?: boolean, isSpeaking?: boolean }) => {
      if (!playerId || !allPlayers[playerId]) return;
      if (data.isMuted !== undefined) allPlayers[playerId].isMuted = data.isMuted;
      if (data.isSpeaking !== undefined) allPlayers[playerId].isSpeaking = data.isSpeaking;
      broadcastLobbyUpdate();
    });

    socket.on("disconnect", () => {
      if (playerId) {
        const roomId = Object.keys(voiceRooms).find(rid => voiceRooms[rid].has(playerId));
        if (roomId) {
          voiceRooms[roomId].delete(playerId);
          io.to(roomId).emit("VOICE_PEER_LEFT", { peerId: playerId });
        }
        delete playerSocketId[playerId];
        delete socketPlayerId[socket.id];
        // We keep allPlayers for history but they are "offline" if no socketId
        broadcastLobbyUpdate();
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
