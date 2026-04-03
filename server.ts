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

  // Game State
  const allPlayers: Record<string, { id: string, name: string, partyId: string | null, highScores: Record<string, number> }> = {};
  const lobbyConnections: Record<string, { ws: WebSocket, playerId: string }> = {};
  const parties: Record<string, { id: string, leaderId: string, members: string[] }> = {};
  const voiceRooms: Record<string, Set<string>> = {}; // roomId -> Set of playerIds
  const playerVoiceRoom: Record<string, string> = {}; // playerId -> roomId
  const pongRooms: Record<string, string[]> = {}; // roomId -> [p1Id, p2Id]
  const matchmakingQueues: Record<string, string[]> = {
    "block_blast": [],
    "online_pong": [],
    "neon_duel": [],
    "speed_typer": [],
    "grid_race": []
  };
  const gameRooms: Record<string, { mode: string, players: string[], state: any }> = {};

  const broadcastLobbyUpdate = () => {
    const onlinePlayerIds = new Set(Object.values(lobbyConnections).map(c => c.playerId));
    const lobbyData = JSON.stringify({
      type: "LOBBY_UPDATE",
      onlineCount: onlinePlayerIds.size,
      leaderboard: Object.values(allPlayers)
        .sort((a, b) => (Object.values(b.highScores).reduce((sum, s) => sum + s, 0)) - (Object.values(a.highScores).reduce((sum, s) => sum + s, 0)))
        .slice(0, 10)
        .map(p => ({ name: p.name, score: Object.values(p.highScores).reduce((sum, s) => sum + s, 0) }))
    });

    Object.values(lobbyConnections).forEach(conn => {
      if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(lobbyData);
    });
  };

  const broadcastPartyUpdate = (partyId: string) => {
    const party = parties[partyId];
    if (!party) return;

    const partyUpdate = JSON.stringify({ 
      type: "PARTY_UPDATE", 
      party: {
        id: partyId,
        leaderId: party.leaderId,
        members: party.members.map(mId => ({ 
          id: mId, 
          name: allPlayers[mId]?.name || "Unknown" 
        }))
      }
    });

    party.members.forEach(mId => {
      Object.values(lobbyConnections).forEach(conn => {
        if (conn.playerId === mId && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(partyUpdate);
        }
      });
    });
  };

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
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
              name: message.name, 
              partyId: null,
              highScores: {}
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

          // If already in a party, send update
          if (allPlayers[playerId].partyId) {
            broadcastPartyUpdate(allPlayers[playerId].partyId!);
          }
          break;

        case "HIGH_SCORE_UPDATE":
          if (allPlayers[playerId]) {
            const { game, score } = message;
            allPlayers[playerId].highScores[game] = Math.max(allPlayers[playerId].highScores[game] || 0, score);
            
            broadcastLobbyUpdate();
          }
          break;

        case "CHAT_MESSAGE":
          const chatMsg = JSON.stringify({
            type: "CHAT_MESSAGE",
            sender: allPlayers[playerId]?.name || "Unknown",
            senderId: playerId,
            text: message.text,
            timestamp: Date.now(),
            scope: message.scope || "global" // "global" or "room"
          });

          // Broadcast to all lobby connections for now
          Object.values(lobbyConnections).forEach(conn => {
            if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(chatMsg);
          });
          break;

        case "SEARCH_PLAYERS":
          const search_query = (message.query || "").toLowerCase();
          const search_onlinePlayerIds = new Set(Object.values(lobbyConnections).map(c => c.playerId));
          console.log(`[Search] Player ${playerId} searching for "${search_query}". Online players: ${search_onlinePlayerIds.size}`);
          const results = Object.values(allPlayers)
            .filter(p => {
              const isOnline = search_onlinePlayerIds.has(p.id);
              if (!isOnline) return false;
              if (p.id === playerId) return false;
              if (!search_query) return true;
              return p.name.toLowerCase().includes(search_query);
            })
            .map(p => ({ id: p.id, name: p.name }));
          ws.send(JSON.stringify({ type: "SEARCH_RESULTS", results }));
          break;

        case "VOICE_JOIN":
          const vRoomId = message.roomId || "public";
          console.log(`[Voice] Player ${playerId} joining room: ${vRoomId}`);
          
          // Leave previous room if any
          if (playerVoiceRoom[playerId]) {
            const oldRoomId = playerVoiceRoom[playerId];
            console.log(`[Voice] Player ${playerId} leaving old room: ${oldRoomId}`);
            voiceRooms[oldRoomId]?.delete(playerId);
            // Notify others in old room
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
                  console.log(`[Voice] Notifying ${pId} that ${playerId} joined`);
                  conn.ws.send(JSON.stringify({ type: "VOICE_PEER_JOINED", peerId: playerId }));
                }
              });
            }
          });

          // Send current peers to the joining player
          const peers = Array.from(voiceRooms[vRoomId]).filter(id => id !== playerId);
          console.log(`[Voice] Room ${vRoomId} now has ${voiceRooms[vRoomId].size} players. Peers for ${playerId}: ${peers.length}`);
          ws.send(JSON.stringify({ type: "VOICE_JOIN_SUCCESS", roomId: vRoomId, peers }));
          break;

        case "VOICE_SIGNAL":
          // Forward signal to target peer
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
        case "PARTY_INVITE":
          const targetConn = Object.values(lobbyConnections).find(c => c.playerId === message.targetId);
          if (targetConn && targetConn.ws.readyState === WebSocket.OPEN) {
            targetConn.ws.send(JSON.stringify({ 
              type: "PARTY_INVITE_RECEIVED", 
              fromId: playerId, 
              fromName: allPlayers[playerId]?.name 
            }));
          }
          break;

        case "PARTY_ACCEPT":
          const inviter = allPlayers[message.fromId];
          if (inviter) {
            let partyId = inviter.partyId;
            if (!partyId) {
              partyId = nanoid();
              parties[partyId] = { id: partyId, leaderId: inviter.id, members: [inviter.id] };
              inviter.partyId = partyId;
            }
            
            if (parties[partyId] && !parties[partyId].members.includes(playerId)) {
              parties[partyId].members.push(playerId);
              allPlayers[playerId].partyId = partyId;
            }

            broadcastPartyUpdate(partyId);
          }
          break;

        case "PARTY_LEAVE":
          const pId = allPlayers[playerId]?.partyId;
          if (pId && parties[pId]) {
            const party = parties[pId];
            party.members = party.members.filter(m => m !== playerId);
            allPlayers[playerId].partyId = null;
            
            if (party.members.length === 0) {
              delete parties[pId];
            } else {
              if (party.leaderId === playerId) {
                party.leaderId = party.members[0];
              }
              broadcastPartyUpdate(pId);
            }
            ws.send(JSON.stringify({ type: "PARTY_UPDATE", party: null }));
          }
          break;

        case "PONG_JOIN":
          if (!pongRooms[message.roomId]) pongRooms[message.roomId] = [];
          if (!pongRooms[message.roomId].includes(playerId)) {
            pongRooms[message.roomId].push(playerId);
          }
          ws.send(JSON.stringify({ 
            type: "PONG_INIT", 
            isHost: pongRooms[message.roomId][0] === playerId 
          }));
          break;

        case "PONG_SYNC":
          // Forward game state to other player in room
          pongRooms[message.roomId]?.forEach(pId => {
            if (pId !== playerId) {
              Object.values(lobbyConnections).forEach(conn => {
                if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.send(JSON.stringify({ type: "PONG_UPDATE", state: message.state }));
                }
              });
            }
          });
          break;

        case "PONG_PADDLE":
          // Forward paddle position to other player
          pongRooms[message.roomId]?.forEach(pId => {
            if (pId !== playerId) {
              Object.values(lobbyConnections).forEach(conn => {
                if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.send(JSON.stringify({ 
                    type: "PONG_PADDLE_UPDATE", 
                    player: message.player, 
                    pos: message.pos 
                  }));
                }
              });
            }
          });
          break;

        case "MATCHMAKING_JOIN":
          const mode = message.mode;
          if (!matchmakingQueues[mode]) matchmakingQueues[mode] = [];
          if (!matchmakingQueues[mode].includes(playerId)) {
            matchmakingQueues[mode].push(playerId);
          }

          if (matchmakingQueues[mode].length >= 2) {
            const p1 = matchmakingQueues[mode].shift()!;
            const p2 = matchmakingQueues[mode].shift()!;
            const roomId = nanoid();
            gameRooms[roomId] = { mode, players: [p1, p2], state: {} };

            const matchFound = (pId: string, opponentId: string, isHost: boolean) => {
              Object.values(lobbyConnections).forEach(conn => {
                if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.send(JSON.stringify({
                    type: "MATCH_FOUND",
                    mode,
                    roomId,
                    opponentName: allPlayers[opponentId]?.name || "Opponent",
                    isHost
                  }));
                }
              });
            };

            matchFound(p1, p2, true);
            matchFound(p2, p1, false);
          }
          break;

        case "MATCHMAKING_LEAVE":
          Object.keys(matchmakingQueues).forEach(m => {
            matchmakingQueues[m] = matchmakingQueues[m].filter(id => id !== playerId);
          });
          break;

        case "GAME_SYNC":
          // Generic game state sync for new games
          const gRoomId = message.roomId;
          const room = gameRooms[gRoomId];
          if (room) {
            room.players.forEach(pId => {
              if (pId !== playerId) {
                Object.values(lobbyConnections).forEach(conn => {
                  if (conn.playerId === pId && conn.ws.readyState === WebSocket.OPEN) {
                    conn.ws.send(JSON.stringify({ 
                      type: "GAME_UPDATE", 
                      state: message.state,
                      senderId: playerId
                    }));
                  }
                });
              }
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
        // Broadcast new count
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
