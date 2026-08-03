import { randomBytes } from "node:crypto";
import type {
  BakRyggenState,
  GameMode,
  PlayMode,
  Player,
  RoomPublicState,
  SpicyState,
  VoteOffPlayerRef,
  VoteOffState,
} from "../../shared/types.js";
import {
  advanceRevealIndex,
  advanceRevealStep,
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
  filledPrompt,
  forceReveal,
  startVoteOff,
  tallyVotes,
  type VoteOffInternal,
} from "./games/voteoff.js";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 20;
const PIN_LENGTH = 5;

export interface Room {
  pin: string;
  hostId: string;
  players: Map<string, Player>;
  mode: GameMode;
  playMode: PlayMode;
  bakRyggen?: BakRyggenInternal;
  spicy?: SpicyInternal;
  voteoff?: VoteOffInternal;
  /** socketId -> playerId */
  sockets: Map<string, string>;
}

const rooms = new Map<string, Room>();
const roomTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

/** Set from index.ts so timed phase changes can broadcast */
let notifyRoom: (pin: string) => void = () => {};

export function setRoomNotifier(fn: (pin: string) => void) {
  notifyRoom = fn;
}

function clearRoomTimers(pin: string) {
  for (const t of roomTimers.get(pin) ?? []) clearTimeout(t);
  roomTimers.delete(pin);
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
  game.revealStep = "question";
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
  game.revealStep = "question";
}

/** Advance one reveal card; returns true if game ended → lobby */
function advanceBakReveal(room: Room): boolean {
  const game = room.bakRyggen;
  if (!game || game.phase !== "reveal") return false;

  if (advanceRevealStep(game) || advanceRevealIndex(game)) {
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
  // TEMP: fixed PIN for easy local testing — revert before shipping
  return "123";
}

function newPlayerId(): string {
  return randomBytes(8).toString("hex");
}

export function createRoom(
  socketId: string,
  name: string,
  playMode: PlayMode,
  avatar?: string
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
  if (!room) return { error: "Room not found. Check the PIN." };
  if (room.mode !== "lobby") {
    return { error: "The game has already started." };
  }
  if (room.players.size >= MAX_PLAYERS) {
    return { error: "The room is full." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a name." };
  const taken = [...room.players.values()].some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (taken) return { error: "That name is already taken." };

  const playerId = newPlayerId();
  room.players.set(playerId, {
    id: playerId,
    name: trimmed,
    isHost: false,
    ...(avatar ? { avatar } : {}),
  });
  room.sockets.set(socketId, playerId);
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

export function leaveRoom(socketId: string): Room | null {
  const found = getRoomBySocket(socketId);
  if (!found) return null;
  const { room, playerId } = found;
  room.sockets.delete(socketId);

  // If player still has another socket, keep them
  const stillConnected = [...room.sockets.values()].includes(playerId);
  if (!stillConnected) {
    room.players.delete(playerId);
    if (room.hostId === playerId) {
      const next = room.players.values().next().value as Player | undefined;
      if (next) {
        room.hostId = next.id;
        next.isHost = true;
      }
    }
  }

  if (room.players.size === 0) {
    clearRoomTimers(room.pin);
    rooms.delete(room.pin);
    return null;
  }

  // If game in progress and too few players, reset to lobby
  if (room.mode !== "lobby" && room.players.size < MIN_PLAYERS) {
    resetRoomToLobby(room);
  }

  return room;
}

export function startMode(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return "Only the host can start.";
  if (room.players.size < MIN_PLAYERS) {
    return `Need at least ${MIN_PLAYERS} players.`;
  }
  if (room.mode !== "lobby") return "A game is already in progress.";

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
    room.spicy = startSpicy();
    dealNext(room.spicy, [...room.players.keys()]);
  } else if (mode === "voteoff") {
    room.voteoff = startVoteOff([...room.players.keys()]);
  } else {
    return "Choose a game mode.";
  }
  return null;
}

export function endGame(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return "Only the host can end the game.";
  resetRoomToLobby(room);
  return null;
}

export function setPlayMode(
  room: Room,
  playerId: string,
  playMode: PlayMode
): string | null {
  if (room.hostId !== playerId) return "Only the host can change the mode.";
  if (room.mode !== "lobby") return "You can only change mode in the lobby.";
  if (
    playMode !== "bakRyggen" &&
    playMode !== "spicy" &&
    playMode !== "voteoff"
  ) {
    return "Choose a game mode.";
  }
  room.playMode = playMode;
  return null;
}

export function submitBakRyggen(
  room: Room,
  playerId: string,
  payload: { question: string; gossip: string; challenge: string }
): string | null {
  const game = room.bakRyggen;
  if (!game || room.mode !== "bakRyggen") return "The game is not active.";
  if (game.phase !== "writing") return "The writing phase is over.";
  if (game.submissions.has(playerId)) return "You have already submitted.";

  const question = payload.question.trim();
  const gossip = payload.gossip.trim();
  const challenge = payload.challenge.trim();
  if (!question || !gossip || !challenge) {
    return "Fill in all fields.";
  }

  game.submissions.set(playerId, {
    authorId: playerId,
    question,
    gossip,
    challenge,
  });

  if (game.submissions.size === room.players.size) {
    enterCountdown(room);
  }
  return null;
}

export function nextBakRyggenStep(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return "Only the host can control the reveal.";
  const game = room.bakRyggen;
  if (!game || game.phase !== "reveal") return "Not in the reveal phase.";
  advanceBakReveal(room);
  return null;
}

export function nextSpicy(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return "Only the host can continue.";
  if (!room.spicy || room.mode !== "spicy") return "The game is not active.";
  dealNext(room.spicy, [...room.players.keys()]);
  return null;
}

export function voteVoteOff(
  room: Room,
  playerId: string,
  choiceId: string
): string | null {
  const game = room.voteoff;
  if (!game || room.mode !== "voteoff") return "The game is not active.";
  return castVote(game, playerId, choiceId, [...room.players.keys()]);
}

export function nextVoteOff(room: Room, playerId: string): string | null {
  if (room.hostId !== playerId) return "Only the host can continue.";
  const game = room.voteoff;
  if (!game || room.mode !== "voteoff") return "The game is not active.";
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
  if (room.hostId !== playerId) return "Only the host can reveal early.";
  const game = room.voteoff;
  if (!game || room.mode !== "voteoff") return "The game is not active.";
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
        totalVoters: room.players.size,
      };
    }
    return undefined;
  }

  const nameById = new Map(
    [...room.players.values()].map((p) => [p.id, p.name])
  );
  const prompt = filledPrompt(game, nameById);
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
    totalVoters: room.players.size,
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

  return {
    phase: game.phase,
    submittedCount: game.submissions.size,
    totalPlayers: room.players.size,
    hasSubmitted: game.submissions.has(viewerId),
    writingEndsAt: game.writingEndsAt,
    countdownEndsAt: game.countdownEndsAt,
    revealQueue: game.phase === "reveal" ? game.revealQueue : [],
    revealIndex: game.revealIndex,
    revealStep: game.revealStep,
  };
}

function spicyPublic(room: Room): SpicyState | undefined {
  const game = room.spicy;
  if (!game) return undefined;
  const names = game.targetIds.map(
    (id) => room.players.get(id)?.name ?? "Unknown"
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
            (id) => room.players.get(id)?.name ?? "Unknown"
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
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    bakRyggen: bakRyggenPublic(room, viewerId),
    spicy: spicyPublic(room),
    voteoff: voteoffPublic(room, viewerId),
  };
}

export { MIN_PLAYERS, MAX_PLAYERS };
