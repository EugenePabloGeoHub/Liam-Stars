import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = Number(process.env.PORT) || 3000;

  // State
  const allPlayers: Record<string, { id: string, name: string }> = {};
  const lobbyConnections: Record<string, { ws: WebSocket, playerId: string }> = {};
  const voiceRooms: Record<string, Set<string>> = {}; // roomId -> Set of playerIds
  const playerVoiceRoom: Record<string, string> = {}; // playerId -> roomId

  const broadcastLobbyUpdate = () => {
    const onlinePlayerIds = new Set(Object.values(lobbyConnections).map(c => c.playerId));
    const lobbyData = JSON.stringify({
      type: "LOBBY_UPDATE",
      onlineCount: onlinePlayerIds.size
    });

    Object.values(lobbyConnections).forEach(conn => {
      if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(lobbyData);
    });
  };

  wss.on("connection", (ws: WebSocket) => {
    let playerId: string = nanoid();
    const connectionId = nanoid();

    ws.on("message", (data: string) => {
      const message = JSON.parse(data.toString());
      if (message.playerId) playerId = message.playerId;

      switch (message.type) {
        case "LOBBY_JOIN":
          if (!allPlayers[playerId]) {
            allPlayers[playerId] = { 
              id: playerId, 
              name: message.name
            };
          } else {
            allPlayers[playerId].name = message.name;
          }
          lobbyConnections[connectionId] = { ws, playerId };
          
          ws.send(JSON.stringify({ 
            type: "LOBBY_INIT", 
            playerId,
            player: allPlayers[playerId]
          }));
          
          broadcastLobbyUpdate();
          break;

        case "CHAT_MESSAGE":
          const chatMsg = JSON.stringify({
            type: "CHAT_MESSAGE",
            sender: allPlayers[playerId]?.name || "Unknown",
            senderId: playerId,
            text: message.text,
            timestamp: Date.now(),
            scope: message.scope || "global"
          });

          Object.values(lobbyConnections).forEach(conn => {
            if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(chatMsg);
          });
          break;

        case "VOICE_JOIN":
          const vRoomId = message.roomId || "public";
          console.log(`[Voice] Player ${playerId} joining room: ${vRoomId}`);
          
          // Leave previous room if any
          if (playerVoiceRoom[playerId]) {
            const oldRoomId = playerVoiceRoom[playerId];
            voiceRooms[oldRoomId]?.delete(playerId);
            voiceRooms[oldRoomId]?.forEach(pId => {
              Object.values(lobbyConnections).forEach(conn => {
                if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.send(JSON.stringify({ type: "VOICE_PEER_LEFT", peerId: playerId }));
                }
              });
            });
          }

          if (!voiceRooms[vRoomId]) voiceRooms[vRoomId] = new Set();
          voiceRooms[vRoomId].add(playerId);
          playerVoiceRoom[playerId] = vRoomId;

          // Notify others in new room
          voiceRooms[vRoomId].forEach(pId => {
            if (pId !== playerId) {
              Object.values(lobbyConnections).forEach(conn => {
                if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.send(JSON.stringify({ type: "VOICE_PEER_JOINED", peerId: playerId }));
                }
              });
            }
          });

          // Send current peers to the joining player
          const peers = Array.from(voiceRooms[vRoomId]).filter(id => id !== playerId);
          ws.send(JSON.stringify({ type: "VOICE_JOIN_SUCCESS", roomId: vRoomId, peers }));
          break;

        case "VOICE_SIGNAL":
          Object.values(lobbyConnections).forEach(conn => {
            if (conn.playerId === message.targetId && conn.ws.readyState === WebSocket.OPEN) {
              conn.ws.send(JSON.stringify({ 
                type: "VOICE_SIGNAL", 
                senderId: playerId, 
                signal: message.signal 
              }));
            }
          });
          break;

        case "VOICE_LEAVE":
          if (playerVoiceRoom[playerId]) {
            const vRoomId = playerVoiceRoom[playerId];
            voiceRooms[vRoomId]?.delete(playerId);
            delete playerVoiceRoom[playerId];
            
            voiceRooms[vRoomId]?.forEach(pId => {
              Object.values(lobbyConnections).forEach(conn => {
                if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.send(JSON.stringify({ type: "VOICE_PEER_LEFT", peerId: playerId }));
                }
              });
            });
          }
          break;
      }
    });

    ws.on("close", () => {
      if (playerVoiceRoom[playerId]) {
        const vRoomId = playerVoiceRoom[playerId];
        voiceRooms[vRoomId]?.delete(playerId);
        delete playerVoiceRoom[playerId];
        voiceRooms[vRoomId]?.forEach(pId => {
          Object.values(lobbyConnections).forEach(conn => {
            if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
              conn.ws.send(JSON.stringify({ type: "VOICE_PEER_LEFT", peerId: playerId }));
            }
          });
        });
      }

      if (lobbyConnections[connectionId]) {
        delete lobbyConnections[connectionId];
        const onlinePlayerIds = new Set(Object.values(lobbyConnections).map(c => c.playerId));
        const countUpdate = JSON.stringify({ type: "ONLINE_COUNT", count: onlinePlayerIds.size });
        Object.values(lobbyConnections).forEach(conn => {
          if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(countUpdate);
        });
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
