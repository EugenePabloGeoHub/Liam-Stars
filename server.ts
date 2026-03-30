import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import { nanoid } from "nanoid";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  // Game State
  const rooms: Record<string, any> = {};
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

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let playerId: string = nanoid();

    ws.on("message", (data: string) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "JOIN_ROOM":
        case "JOIN_QUEUE":
          const mode = message.mode || "practice";
          const config = MODE_CONFIGS[mode] || MODE_CONFIGS.practice;
          
          if (mode !== "practice") {
            // Find a room for this mode that hasn't started and isn't full
            currentRoomId = Object.keys(rooms).find(id => 
              rooms[id].mode === mode && 
              !rooms[id].started && 
              Object.keys(rooms[id].players).length < config.players
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
            money: stats.money || 0,
            trophies: stats.trophies || 0,
            kills: stats.kills || 0,
            deaths: stats.deaths || 0,
            damage: stats.damage || 10,
            speed: stats.speed || 3.5,
            superCharge: 0,
            angle: 0,
            team,
            name: message.name || "Player",
            color: stats.color || `hsl(${Math.random() * 360}, 70%, 50%)`,
            skin: stats.skin || "default",
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
          if (currentRoomId && rooms[currentRoomId].players[playerId]) {
            const p = rooms[currentRoomId].players[playerId];
            const cost = 50;
            if (p.money >= cost) {
              p.money -= cost;
              if (message.stat === "speed") p.speed += 0.5;
              if (message.stat === "damage") p.damage += 2;
              if (message.stat === "health") {
                p.maxHealth += 20;
                p.health = p.maxHealth;
              }
              ws.send(JSON.stringify({ type: "UPGRADE_SUCCESS", stat: message.stat }));
            }
          }
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
                player.deaths++;
                player.health = 0; // Stay dead until RESPAWN
                
                // Reward Killer
                if (shooter) {
                  shooter.kills++;
                  shooter.money += 100;
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
            playersArr.filter(p => p.team === 1).forEach(p => p.trophies += 10);
          }
          if (room.scores.team2 >= 2 && !room.winner) {
            room.winner = "team2";
            playersArr.filter(p => p.team === 2).forEach(p => p.trophies += 10);
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
            alivePlayers[0].trophies += 10;
          } else if (alivePlayers.length === 0) {
            room.winner = "draw";
          }
        } else if (room.mode === "knockout") {
          const team1Alive = alivePlayers.some(p => p.team === 1);
          const team2Alive = alivePlayers.some(p => p.team === 2);
          if (!team1Alive) {
            room.winner = "team2";
            playersArr.filter(p => p.team === 2).forEach(p => p.trophies += 10);
          } else if (!team2Alive) {
            room.winner = "team1";
            playersArr.filter(p => p.team === 1).forEach(p => p.trophies += 10);
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
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(state);
        }
      });
    }
  }, 1000 / 30);
 // 30 FPS updates

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
