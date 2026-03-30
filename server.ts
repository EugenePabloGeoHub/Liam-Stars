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

  // Game Constants
  const MAP_WIDTH = 1200;
  const MAP_HEIGHT = 800;

  const generateObstacles = () => {
    const obstacles = [];
    // Reduced obstacle count for smaller map
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
          currentRoomId = message.roomId || "default";
          if (!rooms[currentRoomId]) {
            rooms[currentRoomId] = { 
              players: {}, 
              bullets: [], 
              obstacles: generateObstacles(),
              lastUpdate: Date.now()
            };
          }
          
          // Use stats from client if provided (persistence)
          const stats = message.stats || {};
          
          rooms[currentRoomId].players[playerId] = {
            id: playerId,
            x: Math.random() * MAP_WIDTH,
            y: Math.random() * MAP_HEIGHT,
            health: stats.maxHealth || 100,
            maxHealth: stats.maxHealth || 100,
            money: stats.money || 0,
            kills: stats.kills || 0,
            deaths: stats.deaths || 0,
            damage: stats.damage || 10,
            speed: stats.speed || 3.5,
            superCharge: 0,
            angle: 0,
            name: message.name || "Player",
            color: stats.color || `hsl(${Math.random() * 360}, 70%, 50%)`,
            skin: stats.skin || "default",
          };
          ws.send(JSON.stringify({ 
            type: "INIT", 
            playerId, 
            roomId: currentRoomId,
            x: rooms[currentRoomId].players[playerId].x,
            y: rooms[currentRoomId].players[playerId].y,
            obstacles: rooms[currentRoomId].obstacles,
            mapWidth: MAP_WIDTH,
            mapHeight: MAP_HEIGHT
          }));
          break;

        case "MOVE":
          if (currentRoomId && rooms[currentRoomId].players[playerId]) {
            const p = rooms[currentRoomId].players[playerId];
            if (p.health <= 0) break;
            const room = rooms[currentRoomId];
            
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
            const isSuper = message.isSuper && p.superCharge >= 100;
            
            if (isSuper) {
              p.superCharge = 0;
              // Unleash 5 shots in a spread
              for (let i = -2; i <= 2; i++) {
                const angle = message.angle + (i * 0.2);
                rooms[currentRoomId].bullets.push({
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
              rooms[currentRoomId].bullets.push({
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
            if (p.health <= 0) {
              p.health = p.maxHealth;
              p.x = Math.random() * MAP_WIDTH;
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

      // Broadcast State
      const state = JSON.stringify({ type: "STATE", players: room.players, bullets: room.bullets });
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
