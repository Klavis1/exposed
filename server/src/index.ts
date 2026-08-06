import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types.js";
import { normalizeAvatar } from "./avatar.js";
import {
  createRoom,
  endGame,
  getRoomBySocket,
  joinRoom,
  leaveRoom,
  rejoinRoom,
  softDisconnect,
  forceRevealVoteOff,
  nextBakRyggenStep,
  nextSpicy,
  nextVoteOff,
  setPlayMode,
  setRoomNotifier,
  startMode,
  submitBakRyggen,
  toPublicState,
  voteVoteOff,
} from "./rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 2e6,
  // More tolerant of mobile browsers suspending the tab briefly
  pingInterval: 25_000,
  pingTimeout: 60_000,
});

function broadcastRoom(pin: string) {
  const roomSockets = io.sockets.adapter.rooms.get(pin);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const found = getRoomBySocket(socketId);
    if (!found || found.room.pin !== pin) continue;
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.emit("room:state", toPublicState(found.room, found.playerId));
  }
}

setRoomNotifier(broadcastRoom);

function emitError(socketId: string, message: string) {
  io.to(socketId).emit("room:error", message);
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, avatar, playMode }, cb) => {
    const trimmed = (name ?? "").trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
      cb?.({ ok: false, error: "Name must be 1–20 characters." });
      return;
    }
    if (!/^[\p{L}\s]+$/u.test(trimmed) || !/\p{L}/u.test(trimmed)) {
      cb?.({ ok: false, error: "Name can only use letters." });
      return;
    }
    if (
      playMode !== "bakRyggen" &&
      playMode !== "spicy" &&
      playMode !== "voteoff"
    ) {
      cb?.({ ok: false, error: "Choose a game mode." });
      return;
    }
    let safeAvatar: string | undefined;
    try {
      safeAvatar = normalizeAvatar(avatar);
    } catch (err) {
      cb?.({
        ok: false,
        error: err instanceof Error ? err.message : "Invalid image.",
      });
      return;
    }
    const { room, playerId } = createRoom(
      socket.id,
      trimmed,
      playMode,
      safeAvatar
    );
    socket.join(room.pin);
    cb?.({ ok: true, playerId, pin: room.pin });
    socket.emit("room:state", toPublicState(room, playerId));
  });

  socket.on("room:join", ({ pin, name, avatar }, cb) => {
    const trimmed = (name ?? "").trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
      cb?.({ ok: false, error: "Name must be 1–20 characters." });
      return;
    }
    if (!/^[\p{L}\s]+$/u.test(trimmed) || !/\p{L}/u.test(trimmed)) {
      cb?.({ ok: false, error: "Name can only use letters." });
      return;
    }
    let safeAvatar: string | undefined;
    try {
      safeAvatar = normalizeAvatar(avatar);
    } catch (err) {
      cb?.({
        ok: false,
        error: err instanceof Error ? err.message : "Invalid image.",
      });
      return;
    }
    const result = joinRoom(socket.id, (pin ?? "").trim(), trimmed, safeAvatar);
    if ("error" in result) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    const { room, playerId } = result;
    socket.join(room.pin);
    cb?.({ ok: true, playerId, pin: room.pin });
    broadcastRoom(room.pin);
  });

  socket.on("room:rejoin", ({ pin, playerId }, cb) => {
    const result = rejoinRoom(
      socket.id,
      (pin ?? "").trim(),
      (playerId ?? "").trim()
    );
    if ("error" in result) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    const { room, playerId: id } = result;
    socket.join(room.pin);
    cb?.({ ok: true, playerId: id, pin: room.pin });
    socket.emit("room:state", toPublicState(room, id));
  });

  socket.on("room:leave", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const pin = found.room.pin;
    socket.leave(pin);
    const room = leaveRoom(socket.id);
    if (room) broadcastRoom(pin);
  });

  socket.on("room:start", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = startMode(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("room:endGame", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = endGame(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("room:setPlayMode", ({ playMode }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = setPlayMode(found.room, found.playerId, playMode);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("bakRyggen:submit", (payload) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = submitBakRyggen(found.room, found.playerId, payload);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("bakRyggen:nextStep", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = nextBakRyggenStep(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("bakRyggen:nextReveal", () => {
    // Alias for next reveal card
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = nextBakRyggenStep(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("spicy:next", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = nextSpicy(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("voteoff:vote", ({ choiceId }) => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = voteVoteOff(found.room, found.playerId, choiceId ?? "");
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("voteoff:next", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = nextVoteOff(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("voteoff:forceReveal", () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;
    const err = forceRevealVoteOff(found.room, found.playerId);
    if (err) {
      emitError(socket.id, err);
      return;
    }
    broadcastRoom(found.room.pin);
  });

  socket.on("disconnect", () => {
    softDisconnect(socket.id);
  });
});

// Serve client build in production
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).send("Client not built. Run npm run build.");
  });
});

httpServer.listen(PORT, () => {
  console.log(`Cabin Chaos server at http://localhost:${PORT}`);
});
