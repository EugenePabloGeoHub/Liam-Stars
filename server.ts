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
  const rooms: Record<string, any> = {};
  const allPlayers: Record<string, { id: string, name: string, partyId: string | null }> = {};
  const lobbySockets: Record<string, WebSocket> = {};
  const parties: Record<string, { id: string, leaderId: string, members: string[] }> = {};

  const MODE_CONFIGS: Record<string, { players: number, teams: boolean, hasBall?: boolean }> = {
    practice: { players: 100, teams: false },
    showdown: { players: 10, teams: false },
    duel: { players: 2, teams: false },
    brawlball: { players: 6, teams: true, hasBall: true },
    knockout: { players: 6, teams: true }
  };

  // Game Constants
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 800;

  const generateObstacles = () => {
    const obstacles = [];
    for (let i = 0; i < 15; i++) {
      obstacles.push({
        x: Math.random() * (MAP_WIDTH - 200) + 100,
        y: Math.random() * (MAP_HEIGHT - 200) + 100,
        w: 60 + Math.random() * 100,
        h: 60 + Math.random() * 100,
        type: Math.random() > 0.7 ? "wall" : "bush",
      });
    }
    return obstacles;
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
      const ws = lobbySockets[mId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(partyUpdate);
      }
    });
  };

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let playerId: string = nanoid();

    ws.on("message", (data: string) => {
      const message = JSON.parse(data.toString());
      if (message.playerId) playerId = message.playerId;

      switch (message.type) {
        case "LOBBY_JOIN":
          if (!allPlayers[playerId]) {
            allPlayers[playerId] = { id: playerId, name: message.name, partyId: null };
          } else {
            allPlayers[playerId].name = message.name;
          }
          lobbySockets[playerId] = ws;
          ws.send(JSON.stringify({ type: "LOBBY_INIT", playerId }));
          
          // If already in a party, send update
          if (allPlayers[playerId].partyId) {
            broadcastPartyUpdate(allPlayers[playerId].partyId!);
          }
          break;

        case "SEARCH_PLAYERS":
          const query = message.query.toLowerCase();
          const results = Object.values(allPlayers)
            .filter(p => p.name.toLowerCase().includes(query) && p.id !== playerId && lobbySockets[p.id])
            .map(p => ({ id: p.id, name: p.name }));
          ws.send(JSON.stringify({ type: "SEARCH_RESULTS", results }));
          break;

        case "PARTY_INVITE":
          const targetWs = lobbySockets[message.targetId];
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({ 
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

        case "JOIN_ROOM":
        case "JOIN_QUEUE":
          const mode = message.mode || "practice";
          const config = MODE_CONFIGS[mode] || MODE_CONFIGS.practice;
          const partyIdJoin = allPlayers[playerId]?.partyId;
          const isLeader = partyIdJoin && parties[partyIdJoin]?.leaderId === playerId;
          const partyMembers = isLeader ? parties[partyIdJoin].members : [playerId];
          const partySize = partyMembers.length;
          
          if (mode !== "practice") {
            // Find a room for this mode that hasn't started and has enough space for the whole party
            currentRoomId = Object.keys(rooms).find(id => 
              rooms[id].mode === mode && 
              !rooms[id].started && 
              (Object.keys(rooms[id].players).length + partySize) <= config.players
            ) || `${mode}_${nanoid(5)}`;
          } else {
            currentRoomId = message.roomId || "default";
          }

          if (!rooms[currentRoomId]) {
            rooms[currentRoomId] = { 
              players: {}, 
              bullets: [], 
              obstacles: generateObstacles(),
              lastUpdate: Date.now(),
              mode: mode,
              started: mode === "practice",
              winner: null,
              scores: { team1: 0, team2: 0 },
              ball: config.hasBall ? { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, vx: 0, vy: 0 } : null
            };
          }
          
          const room = rooms[currentRoomId];

          // If leader, tell all other party members to join this specific room
          if (isLeader) {
            partyMembers.forEach(mId => {
              if (mId !== playerId) {
                const mWs = lobbySockets[mId];
                if (mWs && mWs.readyState === WebSocket.OPEN) {
                  mWs.send(JSON.stringify({
                    type: "GAME_START_REQUEST",
                    mode,
                    roomId: currentRoomId
                  }));
                }
              }
            });
          }
          
          const stats = message.stats || {};
          
          // Assign team if needed
          let team = 0;
          if (config.teams) {
            const team1Count = Object.values(room.players).filter((p: any) => p.team === 1).length;
            const team2Count = Object.values(room.players).filter((p: any) => p.team === 2).length;
            team = team1Count <= team2Count ? 1 : 2;
          }

          room.players[playerId] = {
            id: playerId,
            x: team === 1 ? 100 : (team === 2 ? MAP_WIDTH - 100 : Math.random() * MAP_WIDTH),
            y: Math.random() * MAP_HEIGHT,
            health: stats.maxHealth || 100,
            maxHealth: stats.maxHealth || 100,
            damage: stats.damage || 10,
            speed: stats.speed || 3.5,
            superCharge: 0,
            angle: 0,
            team,
            name: message.name || "Player",
            color: stats.color || `hsl(${Math.random() * 360}, 70%, 50%)`,
            ws: ws
          };

          // Check if game should start
          if (mode !== "practice" && Object.keys(room.players).length >= config.players) {
            room.started = true;
          }

          ws.send(JSON.stringify({ 
            type: "INIT", 
            playerId, 
            roomId: currentRoomId,
            mode: room.mode,
            x: room.players[playerId].x,
            y: room.players[playerId].y,
            obstacles: room.obstacles,
            mapWidth: MAP_WIDTH,
            mapHeight: MAP_HEIGHT,
            team: room.players[playerId].team
          }));
          break;

        case "MOVE":
          if (currentRoomId && rooms[currentRoomId].players[playerId]) {
            const p = rooms[currentRoomId].players[playerId];
            const room = rooms[currentRoomId];
            if (p.health <= 0 || (room.mode === "showdown" && !room.started)) break;
            
            // Boundary check
            let nextX = Math.max(20, Math.min(MAP_WIDTH - 20, message.x));
            let nextY = Math.max(20, Math.min(MAP_HEIGHT - 20, message.y));

            // Basic wall collision check for movement
            let canMove = true;
            for (const obs of room.obstacles) {
              if (obs.type === "wall") {
                if (nextX + 20 > obs.x && nextX - 20 < obs.x + obs.w &&
                    nextY + 20 > obs.y && nextY - 20 < obs.y + obs.h) {
                  canMove = false;
                  break;
                }
              }
            }

            if (canMove) {
              p.x = nextX;
              p.y = nextY;
            }
            p.angle = message.angle;
          }
          break;

        case "SHOOT":
          if (currentRoomId && rooms[currentRoomId].players[playerId]) {
            const p = rooms[currentRoomId].players[playerId];
            const room = rooms[currentRoomId];
            if (p.health <= 0 || (room.mode === "showdown" && !room.started)) break;

            const isSuper = message.isSuper && p.superCharge >= 100;
            
            if (isSuper) {
              p.superCharge = 0;
              for (let i = -2; i <= 2; i++) {
                const angle = message.angle + (i * 0.2);
                room.bullets.push({
                  id: nanoid(),
                  ownerId: playerId,
                  damage: p.damage * 1.5,
                  x: message.x,
                  y: message.y,
                  vx: Math.cos(angle) * 22,
                  vy: Math.sin(angle) * 22,
                  life: 100,
                  isSuper: true,
                });
              }
            } else {
              room.bullets.push({
                id: nanoid(),
                ownerId: playerId,
                damage: p.damage,
                x: message.x,
                y: message.y,
                vx: Math.cos(message.angle) * 18,
                vy: Math.sin(message.angle) * 18,
                life: 80,
                isSuper: false,
              });
            }
          }
          break;

        case "RESPAWN":
          if (currentRoomId && rooms[currentRoomId].players[playerId]) {
            const p = rooms[currentRoomId].players[playerId];
            const room = rooms[currentRoomId];
            // Only allow respawn in practice and brawlball
            if (p.health <= 0 && (room.mode === "practice" || room.mode === "brawlball")) {
              p.health = p.maxHealth;
              p.x = p.team === 1 ? 100 : (p.team === 2 ? MAP_WIDTH - 100 : Math.random() * MAP_WIDTH);
              p.y = Math.random() * MAP_HEIGHT;
              p.superCharge = 0;
            }
          }
          break;

        case "UPGRADE":
          // Removed as stats are gone
          break;
      }
    });

    ws.on("close", () => {
      if (currentRoomId && rooms[currentRoomId]) {
        delete rooms[currentRoomId].players[playerId];
        if (Object.keys(rooms[currentRoomId].players).length === 0) {
          delete rooms[currentRoomId];
        }
      }

      if (lobbySockets[playerId] === ws) {
        delete lobbySockets[playerId];
      }
    });
  });

  // Game Loop (Server Side)
  setInterval(() => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      
      // Update Bullets
      room.bullets = room.bullets.filter((bullet: any) => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life--;

        // Obstacle Collision
        for (const obs of room.obstacles) {
          if (obs.type === "wall") {
            if (bullet.x > obs.x && bullet.x < obs.x + obs.w &&
                bullet.y > obs.y && bullet.y < obs.y + obs.h) {
              return false; // Bullet hits wall
            }
          }
        }

        // Collision Detection
        for (const pId in room.players) {
          const player = room.players[pId];
          if (pId !== bullet.ownerId && player.health > 0) {
            const dx = player.x - bullet.x;
            const dy = player.y - bullet.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
              player.health -= bullet.damage;
              
              // Charge Super for the shooter
              const shooter = room.players[bullet.ownerId];
              if (shooter) {
                shooter.superCharge = Math.min(100, shooter.superCharge + 10);
              }

              // Death Logic
              if (player.health <= 0) {
                player.health = 0; // Stay dead until RESPAWN
                
                // Reward Killer
                if (shooter) {
                  shooter.superCharge = Math.min(100, shooter.superCharge + 25);
                }
              }
              return false; // Bullet disappears
            }
          }
        }

        return bullet.life > 0;
      });

      // Update Ball
      if (room.ball) {
        const playersArr = Object.values(room.players) as any[];
        room.ball.x += room.ball.vx;
        room.ball.y += room.ball.vy;
        room.ball.vx *= 0.95;
        room.ball.vy *= 0.95;

        // Ball Boundary
        if (room.ball.x < 0 || room.ball.x > MAP_WIDTH) room.ball.vx *= -1;
        if (room.ball.y < 0 || room.ball.y > MAP_HEIGHT) room.ball.vy *= -1;

        // Ball Player Collision
        for (const pId in room.players) {
          const p = room.players[pId];
          if (p.health > 0) {
            const dx = p.x - room.ball.x;
            const dy = p.y - room.ball.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 40) {
              const angle = Math.atan2(-dy, -dx);
              room.ball.vx = Math.cos(angle) * 10;
              room.ball.vy = Math.sin(angle) * 10;
            }
          }
        }

        // Brawl Ball Scoring
        if (room.mode === "brawlball") {
          if (room.ball.x < 50 && room.ball.y > MAP_HEIGHT / 3 && room.ball.y < (MAP_HEIGHT * 2) / 3) {
            room.scores.team2++;
            room.ball = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, vx: 0, vy: 0 };
          } else if (room.ball.x > MAP_WIDTH - 50 && room.ball.y > MAP_HEIGHT / 3 && room.ball.y < (MAP_HEIGHT * 2) / 3) {
            room.scores.team1++;
            room.ball = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, vx: 0, vy: 0 };
          }

          if (room.scores.team1 >= 2 && !room.winner) {
            room.winner = "team1";
          }
          if (room.scores.team2 >= 2 && !room.winner) {
            room.winner = "team2";
          }
        }
      }

      // Broadcast State
      const playersArr = Object.values(room.players) as any[];
      const alivePlayers = playersArr.filter((p: any) => p.health > 0);
      
      if (room.started && !room.winner) {
        if (room.mode === "showdown" || room.mode === "duel") {
          if (alivePlayers.length === 1) {
            room.winner = alivePlayers[0].id;
          } else if (alivePlayers.length === 0) {
            room.winner = "draw";
          }
        } else if (room.mode === "knockout") {
          const team1Alive = alivePlayers.some(p => p.team === 1);
          const team2Alive = alivePlayers.some(p => p.team === 2);
          if (!team1Alive) {
            room.winner = "team2";
          } else if (!team2Alive) {
            room.winner = "team1";
          }
        }
      }

      const state = JSON.stringify({ 
        type: "STATE", 
        players: room.players, 
        bullets: room.bullets,
        ball: room.ball,
        scores: room.scores,
        started: room.started,
        winner: room.winner,
        playerCount: Object.keys(room.players).length
      });
      Object.values(room.players).forEach((p: any) => {
        if (p.ws.readyState === WebSocket.OPEN) {
          p.ws.send(state);
        }
      });
    }
  }, 1000 / 30);
 // 30 FPS updates

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
