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

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let playerId: string = nanoid();

    ws.on("message", (data: string) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "JOIN_ROOM":
          currentRoomId = message.roomId || "default";
          if (!rooms[currentRoomId]) {
            rooms[currentRoomId] = { players: {}, bullets: [] };
          }
          rooms[currentRoomId].players[playerId] = {
            id: playerId,
            x: Math.random() * 800,
            y: Math.random() * 600,
            health: 100,
            angle: 0,
            name: message.name || "Player",
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          };
          ws.send(JSON.stringify({ type: "INIT", playerId, roomId: currentRoomId }));
          break;

        case "MOVE":
          if (currentRoomId && rooms[currentRoomId].players[playerId]) {
            rooms[currentRoomId].players[playerId].x = message.x;
            rooms[currentRoomId].players[playerId].y = message.y;
            rooms[currentRoomId].players[playerId].angle = message.angle;
          }
          break;

        case "SHOOT":
          if (currentRoomId) {
            rooms[currentRoomId].bullets.push({
              id: nanoid(),
              ownerId: playerId,
              x: message.x,
              y: message.y,
              vx: Math.cos(message.angle) * 10,
              vy: Math.sin(message.angle) * 10,
              life: 100,
            });
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

        // Collision Detection
        for (const pId in room.players) {
          const player = room.players[pId];
          if (pId !== bullet.ownerId) {
            const dx = player.x - bullet.x;
            const dy = player.y - bullet.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
              player.health -= 10;
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
          // In a real app, we'd only send to players in the same room
          client.send(state);
        }
      });
    }
  }, 1000 / 30); // 30 FPS updates

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
