import { useCallback, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  CreateJoinResult,
  PlayMode,
  RoomPublicState,
  ServerToClientEvents,
} from "@shared/types";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const AGE_KEY = "exposed-18plus";
const SESSION_KEY = "exposed-session";

interface Session {
  playerId: string;
  pin: string;
  name: string;
}

function loadAgeConfirmed(): boolean {
  try {
    return localStorage.getItem(AGE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function useGame() {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(loadAgeConfirmed);
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(
    () => loadSession()?.playerId ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s: AppSocket = io({
      path: "/socket.io",
      autoConnect: true,
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("room:state", (state) => {
      setRoom(state);
      setError(null);
    });
    s.on("room:error", (message) => setError(message));

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const confirmAge = useCallback(() => {
    localStorage.setItem(AGE_KEY, "1");
    setAgeConfirmed(true);
  }, []);

  const persistSession = useCallback((session: Session) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setPlayerId(session.playerId);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setPlayerId(null);
    setRoom(null);
  }, []);

  const createRoom = useCallback(
    (name: string, playMode: PlayMode, avatar?: string) => {
      if (!socket) return;
      setBusy(true);
      setError(null);
      socket.emit(
        "room:create",
        { name, avatar, playMode },
        (res: CreateJoinResult) => {
          setBusy(false);
          if (!res.ok || !res.playerId || !res.pin) {
            setError(res.error ?? "Could not create room.");
            return;
          }
          persistSession({ playerId: res.playerId, pin: res.pin, name });
        }
      );
    },
    [socket, persistSession]
  );

  const joinRoom = useCallback(
    (pin: string, name: string, avatar?: string) => {
      if (!socket) return;
      setBusy(true);
      setError(null);
      socket.emit(
        "room:join",
        { pin, name, avatar },
        (res: CreateJoinResult) => {
          setBusy(false);
          if (!res.ok || !res.playerId || !res.pin) {
            setError(res.error ?? "Could not join.");
            return;
          }
          persistSession({ playerId: res.playerId, pin: res.pin, name });
        }
      );
    },
    [socket, persistSession]
  );

  const leaveRoom = useCallback(() => {
    socket?.emit("room:leave");
    clearSession();
  }, [socket, clearSession]);

  const startMode = useCallback(() => {
    socket?.emit("room:start");
  }, [socket]);

  const setPlayMode = useCallback(
    (playMode: PlayMode) => {
      socket?.emit("room:setPlayMode", { playMode });
    },
    [socket]
  );

  const endGame = useCallback(() => {
    socket?.emit("room:endGame");
  }, [socket]);

  const submitBakRyggen = useCallback(
    (payload: { question: string; gossip: string; challenge: string }) => {
      socket?.emit("bakRyggen:submit", payload);
    },
    [socket]
  );

  const nextBakRyggenStep = useCallback(() => {
    socket?.emit("bakRyggen:nextStep");
  }, [socket]);

  const nextSpicy = useCallback(() => {
    socket?.emit("spicy:next");
  }, [socket]);

  const voteVoteOff = useCallback(
    (choiceId: string) => {
      socket?.emit("voteoff:vote", { choiceId });
    },
    [socket]
  );

  const nextVoteOff = useCallback(() => {
    socket?.emit("voteoff:next");
  }, [socket]);

  const forceRevealVoteOff = useCallback(() => {
    socket?.emit("voteoff:forceReveal");
  }, [socket]);

  const me = useMemo(
    () => room?.players.find((p) => p.id === playerId) ?? null,
    [room, playerId]
  );

  const isHost = me?.isHost ?? false;

  return {
    connected,
    ageConfirmed,
    confirmAge,
    room,
    playerId,
    me,
    isHost,
    error,
    setError,
    busy,
    createRoom,
    joinRoom,
    leaveRoom,
    startMode,
    setPlayMode,
    endGame,
    submitBakRyggen,
    nextBakRyggenStep,
    nextSpicy,
    voteVoteOff,
    nextVoteOff,
    forceRevealVoteOff,
  };
}
