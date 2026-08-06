import { randomBytes } from "node:crypto";
import type {
  BakRyggenState,
  GameMode,
  Locale,
  PlayMode,
  Player,
  RoomPublicState,
  SpicyState,
  VoteOffPlayerRef,
  VoteOffState,
} from "../../shared/types.js";
import { isLocale } from "../../shared/types.js";
import {
  advanceRevealIndex,
  buildRevealQueue,
  COUNTDOWN_MS,
  startBakRyggen,
  type BakRyggenInternal,
} from "./games/bakRyggen.js";
import {
  dealNext,
  fillChallengeText,
  remainingCount,
  startSpicy,
  syncActiveRuleFilled,
  type SpicyInternal,
} from "./games/spicy.js";
import {
  advanceVoteOff,
  castVote,
  expectedVoterCount,
  filledPrompt,
  forceReveal,
  startVoteOff,
  tallyVotes,
  type VoteOffInternal,
} from "./games/voteoff.js";
import { t } from "./i18n.js";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 20;
const PIN_LENGTH = 4;

export interface Room {
  pin: string;
  hostId: string;
  players: Map<string, Player>;
  mode: GameMode;
  playMode: PlayMode;
  locale: Locale;
  bakRyggen?: BakRyggenInternal;
  spicy?: SpicyInternal;
  voteoff?: VoteOffInternal;
  /** socketId -> playerId */
  sockets: Map<string, string>;
}

const rooms = new Map<string, Room>();
const roomTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
/** Soft-disconnect grace before removing a player (mobile tab switches). */
const RECONNECT_GRACE_MS = 60_000;
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Set from index.ts so timed phase changes can broadcast */
let notifyRoom: (pin: string) => void = () => {};

export function setRoomNotifier(fn: (pin: string) => void) {
  notifyRoom = fn;
}

function reconnectKey(pin: string, playerId: string) {
  return `${pin}:${playerId}`;
}

function clearReconnectTimer(pin: string, playerId: string) {
  const key = reconnectKey(pin, playerId);
  const handle = reconnectTimers.get(key);
  if (handle) {
    clearTimeout(handle);
    reconnectTimers.delete(key);
  }
}

function clearReconnectTimersForRoom(pin: string) {
  for (const key of [...reconnectTimers.keys()]) {
    if (key.startsWith(`${pin}:`)) {
      const handle = reconnectTimers.get(key);
      if (handle) clearTimeout(handle);
      reconnectTimers.delete(key);
    }
  }
}

function clearRoomTimers(pin: string) {
  for (const t of roomTimers.get(pin) ?? []) clearTimeout(t);
  roomTimers.delete(pin);
  clearReconnectTimersForRoom(pin);
}

function scheduleRoom(pin: string, delayMs: number, fn: () => void) {
  const handle = setTimeout(() => {
    const list = roomTimers.get(pin);
    if (list) {
      const idx = list.indexOf(handle);
      if (idx >= 0) list.splice(idx, 1);
    }
    fn();
  }, Math.max(0, delayMs));
  const list = roomTimers.get(pin) ?? [];
  list.push(handle);
  roomTimers.set(pin, list);
}

function resetRoomToLobby(room: Room) {
  clearRoomTimers(room.pin);
  room.mode = "lobby";
  room.bakRyggen = undefined;
  room.spicy = undefined;
  room.voteoff = undefined;
}

function enterCountdown(room: Room) {
  const game = room.bakRyggen;
  if (!game || game.phase !== "writing") return;

  clearRoomTimers(room.pin);

  game.revealQueue = buildRevealQueue(game.submissions);
  game.revealIndex = 0;
  game.countdownEndsAt = Date.now() + COUNTDOWN_MS;
  game.phase = "countdown";

  if (game.revealQueue.length === 0) {
    resetRoomToLobby(room);
    notifyRoom(room.pin);
    return;
  }

  scheduleRoom(room.pin, COUNTDOWN_MS, () => {
    const current = rooms.get(room.pin);
    if (!current?.bakRyggen || current.bakRyggen.phase !== "countdown") return;
    beginReveal(current);
    notifyRoom(current.pin);
  });
}

function beginReveal(room: Room) {
  const game = room.bakRyggen;
  if (!game) return;

  clearRoomTimers(room.pin);
  game.phase = "reveal";
  game.countdownEndsAt = undefined;
  game.revealIndex = 0;
}

/** Advance one reveal card; returns true if game ended → lobby */
function advanceBakReveal(room: Room): boolean {
  const game = room.bakRyggen;
  if (!game || game.phase !== "reveal") return false;

  if (advanceRevealIndex(game)) {
    return false;
  }

  resetRoomToLobby(room);
  return true;
}

function scheduleWritingDeadline(room: Room) {
  const game = room.bakRyggen;
  if (!game || game.phase !== "writing") return;

  const delay = game.writingEndsAt - Date.now();
  scheduleRoom(room.pin, delay, () => {
    const current = rooms.get(room.pin);
    if (!current?.bakRyggen || current.bakRyggen.phase !== "writing") return;
    enterCountdown(current);
    notifyRoom(current.pin);
  });
}

function generatePin(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let pin = "";
    for (let i = 0; i < PIN_LENGTH; i++) {
      pin += String(randomBytes(1)[0] % 10);
    }
    if (!rooms.has(pin)) return pin;
  }
  throw new Error("Could not allocate a free PIN.");
}

function newPlayerId(): string {
  return randomBytes(8).toString("hex");
}

export function createRoom(
  socketId: string,
  name: string,
  playMode: PlayMode,
  avatar?: string,
  locale: Locale = "en"
): {
  room: Room;
  playerId: string;
} {
  const pin = generatePin();
  const playerId = newPlayerId();
  const player: Player = {
    id: playerId,
    name: name.trim(),
    isHost: true,
    ...(avatar ? { avatar } : {}),
  };
  const room: Room = {
    pin,
    hostId: playerId,
    players: new Map([[playerId, player]]),
    mode: "lobby",
    playMode,
    locale: isLocale(locale) ? locale : "en",
    sockets: new Map([[socketId, playerId]]),
  };
  rooms.set(pin, room);
  return { room, playerId };
}

export function joinRoom(
  socketId: string,
  pin: string,
  name: string,
  avatar?: string
): { room: Room; playerId: string } | { error: string } {
  const room = rooms.get(pin.trim());
  if (!room) return { error: t(undefined, "roomNotFound") };
  if (room.players.size >= MAX_PLAYERS) {
    return { error: t(room.locale, "roomFull") };
  }
  const trimmed = name.trim();
  if (!trimmed) return { error: t(room.locale, "enterName") };
  const taken = [...room.players.values()].some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (taken) return { error: t(room.locale, "nameTaken") };

  const playerId = newPlayerId();
  room.players.set(playerId, {
    id: playerId,
    name: trimmed,
    isHost: false,
    ...(avatar ? { avatar } : {}),
  });
  room.sockets.set(socketId, playerId);

  // Fold mid-game joiners into the current interactive round when possible.
  if (
    room.mode === "bakRyggen" &&
    room.bakRyggen?.phase === "writing" &&
    !room.bakRyggen.eligibleWriterIds.includes(playerId)
  ) {
    room.bakRyggen.eligibleWriterIds.push(playerId);
  }
  if (
    room.mode === "voteoff" &&
    room.voteoff?.phase === "voting" &&
    !room.voteoff.expectedVoterIds.includes(playerId)
  ) {
    room.voteoff.expectedVoterIds.push(playerId);
  }

  return { room, playerId };
}

export function getRoomBySocket(socketId: string): {
  room: Room;
  playerId: string;
} | null {
  for (const room of rooms.values()) {
    const playerId = room.sockets.get(socketId);
    if (playerId) return { room, playerId };
  }
  return null;
}

function afterPlayerRemoved(room: Room): Room | null {
  if (room.players.size === 0) {
    clearRoomTimers(room.pin);
    rooms.delete(room.pin);
    return null;
  }

  if (room.mode !== "lobby" && room.players.size < MIN_PLAYERS) {
    resetRoomToLobby(room);
    return room;
  }

  if (room.mode === "bakRyggen" && room.bakRyggen?.phase === "writing") {
    const required = room.bakRyggen.eligibleWriterIds.filter((id) =>
      room.players.has(id)
    );
    if (
      required.length > 0 &&
      required.every((id) => room.bakRyggen!.submissions.has(id))
    ) {
      enterCountdown(room);
    }
  }
  if (room.mode === "voteoff" && room.voteoff?.phase === "voting") {
    const needed = room.voteoff.expectedVoterIds.filter((id) =>
      room.players.has(id)
    );
    if (
      needed.length > 0 &&
      needed.every((id) => room.voteoff!.votes.has(id))
    ) {
      room.voteoff.phase = "reveal";
    }
  }

  return room;
}

function removePlayer(room: Room, playerId: string): Room | null {
  clearReconnectTimer(room.pin, playerId);
  room.players.delete(playerId);

  // Drop any leftover sockets for this player
  for (const [socketId, id] of room.sockets) {
    if (id === playerId) room.sockets.delete(socketId);
  }

  if (room.hostId === playerId) {
    const next = room.players.values().next().value as Player | undefined;
    if (next) {
      room.hostId = next.id;
      next.isHost = true;
    }
  }

  return afterPlayerRemoved(room);
}

/** Explicit leave — remove immediately. */
export function leaveRoom(socketId: string): Room | null {
  const found = getRoomBySocket(socketId);
  if (!found) return null;
  const { room, playerId } = found;
  room.sockets.delete(socketId);

  const stillConnected = [...room.sockets.values()].includes(playerId);
  if (stillConnected) return room;

  return removePlayer(room, playerId);
}

/**
 * Unexpected disconnect — keep the player in the room briefly so mobile
 * tab switches can reconnect without dropping from the game.
 */
export function softDisconnect(socketId: string): void {
  const found = getRoomBySocket(socketId);
  if (!found) return;
  const { room, playerId } = found;
  room.sockets.delete(socketId);

  if ([...room.sockets.values()].includes(playerId)) return;

  const key = reconnectKey(room.pin, playerId);
  const existing = reconnectTimers.get(key);
  if (existing) clearTimeout(existing);

  const pin = room.pin;
  const handle = setTimeout(() => {
    reconnectTimers.delete(key);
    const current = rooms.get(pin);
    if (!current || !current.players.has(playerId)) return;
    // Someone reconnected under a new socket
    if ([...current.sockets.values()].includes(playerId)) return;
    const updated = removePlayer(current, playerId);
    if (updated) notifyRoom(pin);
  }, RECONNECT_GRACE_MS);

  reconnectTimers.set(key, handle);
}

export function rejoinRoom(
  socketId: string,
  pin: string,
  playerId: string
): { room: Room; playerId: string } | { error: string } {
  const room = rooms.get(pin.trim());
  if (!room) return { error: t(undefined, "roomNotFound") };
  if (!room.players.has(playerId)) {
    return { error: t(room.locale, "sessionExpired") };
  }

  // Drop any previous socket mapping for this connection
  room.sockets.delete(socketId);
  // Ensure this socket isn't double-mapped; replace old sockets for player
  for (const [sid, id] of [...room.sockets]) {
    if (id === playerId) room.sockets.delete(sid);
  }

  clearReconnectTimer(room.pin, playerId);
  room.sockets.set(socketId, playerId);
  return { room, playerId };
}

export function startMode(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostStart");
  if (room.players.size < MIN_PLAYERS) {
    return t(room.locale, "needPlayers", MIN_PLAYERS);
  }
  if (room.mode !== "lobby") return t(room.locale, "gameInProgress");

  clearRoomTimers(room.pin);
  const mode = room.playMode;
  room.mode = mode;
  room.bakRyggen = undefined;
  room.spicy = undefined;
  room.voteoff = undefined;

  if (mode === "bakRyggen") {
    room.bakRyggen = startBakRyggen([...room.players.keys()]);
    scheduleWritingDeadline(room);
  } else if (mode === "spicy") {
    room.spicy = startSpicy(room.locale);
    dealNext(room.spicy, [...room.players.keys()]);
  } else if (mode === "voteoff") {
    room.voteoff = startVoteOff([...room.players.keys()], room.locale);
  } else {
    return t(room.locale, "chooseMode");
  }
  return null;
}

export function endGame(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostEnd");
  resetRoomToLobby(room);
  return null;
}

export function setPlayMode(
  room: Room,
  playerId: string,
  playMode: PlayMode
): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostMode");
  if (room.mode !== "lobby") return t(room.locale, "changeModeLobby");
  if (
    playMode !== "bakRyggen" &&
    playMode !== "spicy" &&
    playMode !== "voteoff"
  ) {
    return t(room.locale, "chooseMode");
  }
  room.playMode = playMode;
  return null;
}

export function setLocale(
  room: Room,
  playerId: string,
  locale: Locale
): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostLocale");
  if (room.mode !== "lobby") return t(room.locale, "changeLocaleLobby");
  if (!isLocale(locale)) return t(room.locale, "chooseMode");
  room.locale = locale;
  return null;
}

export function submitBakRyggen(
  room: Room,
  playerId: string,
  payload: { question: string; gossip: string; challenge: string }
): string | null {
  const game = room.bakRyggen;
  if (!game || room.mode !== "bakRyggen") return t(room.locale, "gameNotActive");
  if (game.phase !== "writing") return t(room.locale, "writingOver");
  if (game.submissions.has(playerId)) return t(room.locale, "alreadySubmitted");

  const question = payload.question.trim();
  const gossip = payload.gossip.trim();
  const challenge = payload.challenge.trim();
  if (!question || !gossip || !challenge) {
    return t(room.locale, "fillFields");
  }

  game.submissions.set(playerId, {
    authorId: playerId,
    question,
    gossip,
    challenge,
  });

  if (!game.eligibleWriterIds.includes(playerId)) {
    game.eligibleWriterIds.push(playerId);
  }

  const required = game.eligibleWriterIds.filter((id) =>
    room.players.has(id)
  );
  if (
    required.length > 0 &&
    required.every((id) => game.submissions.has(id))
  ) {
    enterCountdown(room);
  }
  return null;
}

export function nextBakRyggenStep(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostReveal");
  const game = room.bakRyggen;
  if (!game || game.phase !== "reveal") return t(room.locale, "notReveal");
  advanceBakReveal(room);
  return null;
}

export function nextSpicy(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostContinue");
  if (!room.spicy || room.mode !== "spicy") return t(room.locale, "gameNotActive");
  dealNext(room.spicy, [...room.players.keys()]);
  return null;
}

export function voteVoteOff(
  room: Room,
  playerId: string,
  choiceId: string
): string | null {
  const game = room.voteoff;
  if (!game || room.mode !== "voteoff") return t(room.locale, "gameNotActive");
  return castVote(game, playerId, choiceId, [...room.players.keys()]);
}

export function nextVoteOff(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostContinue");
  const game = room.voteoff;
  if (!game || room.mode !== "voteoff") return t(room.locale, "gameNotActive");
  if (game.phase === "finished") {
    resetRoomToLobby(room);
    return null;
  }
  return advanceVoteOff(game, [...room.players.keys()]);
}

export function forceRevealVoteOff(
  room: Room,
  playerId: string
): string | null {
  if (room.hostId !== playerId) return t(room.locale, "onlyHostForceReveal");
  const game = room.voteoff;
  if (!game || room.mode !== "voteoff") return t(room.locale, "gameNotActive");
  return forceReveal(game);
}

function playerRef(
  room: Room,
  id: string | undefined
): VoteOffPlayerRef | undefined {
  if (!id) return undefined;
  const p = room.players.get(id);
  if (!p) return undefined;
  return { id: p.id, name: p.name, avatar: p.avatar };
}

function refsFor(room: Room, ids: string[]): VoteOffPlayerRef[] {
  return ids
    .map((id) => playerRef(room, id))
    .filter((r): r is VoteOffPlayerRef => !!r);
}

function voteoffPublic(
  room: Room,
  viewerId: string
): VoteOffState | undefined {
  const game = room.voteoff;
  if (!game || !game.current) {
    if (game?.phase === "finished") {
      return {
        phase: "finished",
        kind: "versus",
        questionIndex: game.questionIndex,
        totalQuestions: game.totalQuestions,
        prompt: "",
        anonymous: false,
        hasVoted: false,
        votedCount: game.votes.size,
        totalVoters: expectedVoterCount(game, [...room.players.keys()]),
      };
    }
    return undefined;
  }

  const nameById = new Map(
    [...room.players.values()].map((p) => [p.id, p.name])
  );
  const prompt = filledPrompt(game, nameById);
  const playerIds = [...room.players.keys()];
  const base: VoteOffState = {
    phase: game.phase,
    kind: game.current.kind,
    questionIndex: game.questionIndex,
    totalQuestions: game.totalQuestions,
    prompt,
    anonymous: game.anonymous,
    optionA: playerRef(room, game.optionAId),
    optionB: playerRef(room, game.optionBId),
    subject: playerRef(room, game.subjectId),
    hasVoted: game.votes.has(viewerId),
    votedCount: game.votes.size,
    totalVoters: expectedVoterCount(game, playerIds),
  };

  if (game.phase === "reveal" || game.phase === "finished") {
    const t = tallyVotes(game);
    if (game.current.kind === "versus") {
      base.tallyA = t.tallyA;
      base.tallyB = t.tallyB;
      if (!game.anonymous) {
        base.votersForA = refsFor(room, t.votersA);
        base.votersForB = refsFor(room, t.votersB);
      }
    } else {
      base.tallyYes = t.tallyYes;
      base.tallyNo = t.tallyNo;
      if (!game.anonymous) {
        base.votersForYes = refsFor(room, t.votersYes);
        base.votersForNo = refsFor(room, t.votersNo);
      }
    }
  }

  return base;
}

function bakRyggenPublic(
  room: Room,
  viewerId: string
): BakRyggenState | undefined {
  const game = room.bakRyggen;
  if (!game) return undefined;

  const expectedWriters = game.eligibleWriterIds.filter((id) =>
    room.players.has(id)
  );

  return {
    phase: game.phase,
    submittedCount: game.submissions.size,
    totalPlayers:
      game.phase === "writing"
        ? Math.max(expectedWriters.length, game.submissions.size)
        : room.players.size,
    hasSubmitted: game.submissions.has(viewerId),
    writingEndsAt: game.writingEndsAt,
    countdownEndsAt: game.countdownEndsAt,
    revealQueue: game.phase === "reveal" ? game.revealQueue : [],
    revealIndex: game.revealIndex,
  };
}

function spicyPublic(room: Room): SpicyState | undefined {
  const game = room.spicy;
  if (!game) return undefined;
  const unknown = room.locale === "no" ? "Ukjent" : "Unknown";
  const names = game.targetIds.map(
    (id) => room.players.get(id)?.name ?? unknown
  );
  const avatars = game.targetIds.map((id) => room.players.get(id)?.avatar);

  let challenge: SpicyState["challenge"] = null;
  if (game.current) {
    const template = game.currentTemplate ?? game.current.text;
    const filled =
      game.current.kind === "repeal"
        ? template
        : fillChallengeText(template, names, {
            letter: game.currentLetter,
            targets: game.current.targets,
          });
    if (game.current.kind === "rule") {
      syncActiveRuleFilled(game, filled, names, avatars);
    }
    challenge = { ...game.current, text: filled };
  }

  const activeRules = game.activeRule
    ? [
        {
          ...game.activeRule,
          targetNames: game.activeRule.targetIds.map(
            (id) => room.players.get(id)?.name ?? unknown
          ),
          targetAvatars: game.activeRule.targetIds.map(
            (id) => room.players.get(id)?.avatar
          ),
        },
      ]
    : [];

  return {
    challenge,
    targetIds: game.targetIds,
    targetNames: names,
    targetAvatars: avatars,
    letter: game.currentLetter,
    remaining: remainingCount(game),
    activeRules,
    phase: game.phase,
  };
}

export function toPublicState(room: Room, viewerId: string): RoomPublicState {
  return {
    pin: room.pin,
    players: [...room.players.values()].map((p) => ({
      ...p,
      isHost: p.id === room.hostId,
    })),
    mode: room.mode,
    playMode: room.playMode,
    locale: room.locale,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    bakRyggen: bakRyggenPublic(room, viewerId),
    spicy: spicyPublic(room),
    voteoff: voteoffPublic(room, viewerId),
  };
}

export { MIN_PLAYERS, MAX_PLAYERS };
