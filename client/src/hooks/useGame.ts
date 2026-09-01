import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  CreateJoinResult,
  Locale,
  PlayMode,
  RoomPublicState,
  ServerToClientEvents,
} from "@shared/types";
import { loadLocalePref, t } from "../i18n";

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

function readSession(): Session | null {
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.playerId || !parsed?.pin) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: Session) {
  const raw = JSON.stringify(session);
  localStorage.setItem(SESSION_KEY, raw);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function wipeSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function useGame() {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(loadAgeConfirmed);
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(
    () => readSession()?.playerId ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const intentionalLeave = useRef(false);
  const rejoining = useRef(false);

  useEffect(() => {
    const s: AppSocket = io({
      path: "/socket.io",
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    const tryRejoin = () => {
      if (intentionalLeave.current || rejoining.current) return;
      const session = readSession();
      if (!session) return;
      rejoining.current = true;
      s.emit(
        "room:rejoin",
        { pin: session.pin, playerId: session.playerId },
        (res: CreateJoinResult) => {
          rejoining.current = false;
          if (!res.ok || !res.playerId || !res.pin) {
            wipeSession();
            setPlayerId(null);
            setRoom(null);
            return;
          }
          setPlayerId(res.playerId);
          writeSession({
            playerId: res.playerId,
            pin: res.pin,
            name: session.name,
          });
        }
      );
    };

    s.on("connect", () => {
      setConnected(true);
      tryRejoin();
    });
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
    writeSession(session);
    setPlayerId(session.playerId);
  }, []);

  const clearSession = useCallback(() => {
    wipeSession();
    setPlayerId(null);
    setRoom(null);
  }, []);

  const createRoom = useCallback(
    (name: string, playMode: PlayMode, avatar?: string, locale?: Locale) => {
      if (!socket) return;
      intentionalLeave.current = false;
      setBusy(true);
      setError(null);
      const createLocale = locale ?? loadLocalePref();
      socket.emit(
        "room:create",
        { name, avatar, playMode, locale: createLocale },
        (res: CreateJoinResult) => {
          setBusy(false);
          if (!res.ok || !res.playerId || !res.pin) {
            setError(res.error ?? t(createLocale, "couldNotCreate"));
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
      intentionalLeave.current = false;
      setBusy(true);
      setError(null);
      socket.emit(
        "room:join",
        { pin, name, avatar },
        (res: CreateJoinResult) => {
          setBusy(false);
          if (!res.ok || !res.playerId || !res.pin) {
            setError(res.error ?? t(loadLocalePref(), "couldNotJoin"));
            return;
          }
          persistSession({ playerId: res.playerId, pin: res.pin, name });
        }
      );
    },
    [socket, persistSession]
  );

  const leaveRoom = useCallback(() => {
    intentionalLeave.current = true;
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

  const setLocale = useCallback(
    (locale: Locale) => {
      socket?.emit("room:setLocale", { locale });
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

  const submitRyktetGar = useCallback(
    (payload: { text?: string; image?: string }) => {
      socket?.emit("ryktetGar:submit", payload);
    },
    [socket]
  );

  const nextRyktetGar = useCallback(() => {
    socket?.emit("ryktetGar:next");
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
    setLocale,
    endGame,
    submitBakRyggen,
    nextBakRyggenStep,
    nextSpicy,
    voteVoteOff,
    nextVoteOff,
    forceRevealVoteOff,
    submitRyktetGar,
    nextRyktetGar,
  };
}
