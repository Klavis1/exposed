import ryktetDeckEn from "../../../shared/prompts/en/ryktetGar.json" with { type: "json" };
import ryktetDeckNo from "../../../shared/prompts/no/ryktetGar.json" with { type: "json" };
import type {
  Locale,
  RyktetGarEntryKind,
  RyktetGarPhase,
  RyktetGarTurnKind,
} from "../../../shared/types.js";
import { t } from "../i18n.js";

export interface RyktetGarEntryInternal {
  kind: RyktetGarEntryKind;
  authorId: string;
  text?: string;
  image?: string;
}

export interface RyktetGarPad {
  ownerId: string;
  entries: RyktetGarEntryInternal[];
}

export interface RyktetGarInternal {
  locale: Locale;
  phase: RyktetGarPhase;
  playerOrder: string[];
  playerNames: Map<string, string>;
  pads: Map<string, RyktetGarPad>;
  /** 1 .. n-1 while playing (0 is the dealt prompt). */
  currentTurn: number;
  submittedThisTurn: Set<string>;
  revealPadIndex: number;
  revealEntryIndex: number;
}

/** 1×1 white PNG for skipped turns (player left). */
const SKIPPED_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function turnKind(turn: number): RyktetGarTurnKind {
  return turn % 2 === 1 ? "drawing" : "guessing";
}

export function padOwnerFor(
  state: RyktetGarInternal,
  playerId: string
): string | undefined {
  const i = state.playerOrder.indexOf(playerId);
  if (i < 0) return undefined;
  const n = state.playerOrder.length;
  const ownerIndex = (i - state.currentTurn + n) % n;
  return state.playerOrder[ownerIndex];
}

export function startRyktetGar(
  players: { id: string; name: string }[],
  locale: Locale = "en"
): RyktetGarInternal {
  const source = (
    locale === "no" ? ryktetDeckNo : ryktetDeckEn
  ) as { id: string; text: string }[];
  const prompts = shuffle([...source]);
  const order = shuffle(players.map((p) => p.id));
  const playerNames = new Map(players.map((p) => [p.id, p.name]));
  const pads = new Map<string, RyktetGarPad>();
  order.forEach((id, i) => {
    const text = prompts[i % prompts.length]?.text ?? "A surprise";
    pads.set(id, {
      ownerId: id,
      entries: [{ kind: "prompt", authorId: id, text }],
    });
  });
  return {
    locale,
    phase: "playing",
    playerOrder: order,
    playerNames,
    pads,
    currentTurn: 1,
    submittedThisTurn: new Set(),
    revealPadIndex: 0,
    revealEntryIndex: 0,
  };
}

export function maybeAdvanceRyktet(
  state: RyktetGarInternal,
  presentIds: string[]
): void {
  if (state.phase !== "playing") return;
  const needed = state.playerOrder.filter((id) => presentIds.includes(id));
  if (needed.length === 0) {
    enterReveal(state);
    return;
  }
  if (needed.every((id) => state.submittedThisTurn.has(id))) {
    fillSkippedEntries(state);
    state.currentTurn += 1;
    state.submittedThisTurn = new Set();
    if (state.currentTurn >= state.playerOrder.length) {
      enterReveal(state);
    }
  }
}

function workerForPad(state: RyktetGarInternal, ownerId: string): string {
  const ownerIndex = state.playerOrder.indexOf(ownerId);
  const n = state.playerOrder.length;
  return state.playerOrder[(ownerIndex + state.currentTurn) % n] ?? ownerId;
}

function fillSkippedEntries(state: RyktetGarInternal): void {
  const kind = turnKind(state.currentTurn);
  for (const ownerId of state.playerOrder) {
    const pad = state.pads.get(ownerId);
    if (!pad || pad.entries.length !== state.currentTurn) continue;
    const authorId = workerForPad(state, ownerId);
    if (kind === "drawing") {
      pad.entries.push({
        kind: "drawing",
        authorId,
        image: SKIPPED_IMAGE,
      });
    } else {
      pad.entries.push({ kind: "guess", authorId, text: "…" });
    }
  }
}

function enterReveal(state: RyktetGarInternal): void {
  state.phase = "reveal";
  state.revealPadIndex = 0;
  state.revealEntryIndex = 0;
}

export function submitRyktetTurn(
  state: RyktetGarInternal,
  playerId: string,
  payload: { text?: string; image?: string }
): string | null {
  if (state.phase !== "playing") return t(state.locale, "gameNotActive");
  if (!state.playerOrder.includes(playerId)) {
    return t(state.locale, "notInGame");
  }
  if (state.submittedThisTurn.has(playerId)) {
    return t(state.locale, "alreadySubmitted");
  }
  const ownerId = padOwnerFor(state, playerId);
  if (!ownerId) return t(state.locale, "notInGame");
  const pad = state.pads.get(ownerId);
  if (!pad) return t(state.locale, "gameNotActive");
  if (pad.entries.length !== state.currentTurn) {
    return t(state.locale, "alreadySubmitted");
  }

  const kind = turnKind(state.currentTurn);
  if (kind === "drawing") {
    const image = payload.image?.trim() ?? "";
    if (!image) return t(state.locale, "fillFields");
    pad.entries.push({ kind: "drawing", authorId: playerId, image });
  } else {
    const text = (payload.text ?? "").trim().slice(0, 80);
    if (!text) return t(state.locale, "fillFields");
    pad.entries.push({ kind: "guess", authorId: playerId, text });
  }
  state.submittedThisTurn.add(playerId);
  return null;
}

export function nextRyktetReveal(state: RyktetGarInternal): string | null {
  if (state.phase === "finished") return t(state.locale, "gameOver");
  if (state.phase !== "reveal") return t(state.locale, "notReveal");

  const owners = state.playerOrder;
  const ownerId = owners[state.revealPadIndex];
  const pad = ownerId ? state.pads.get(ownerId) : undefined;
  const entryCount = pad?.entries.length ?? 0;

  if (state.revealEntryIndex < entryCount - 1) {
    state.revealEntryIndex += 1;
    return null;
  }
  if (state.revealPadIndex < owners.length - 1) {
    state.revealPadIndex += 1;
    state.revealEntryIndex = 0;
    return null;
  }
  state.phase = "finished";
  return null;
}

export function previousEntry(
  state: RyktetGarInternal,
  playerId: string
): RyktetGarEntryInternal | undefined {
  const ownerId = padOwnerFor(state, playerId);
  if (!ownerId) return undefined;
  const pad = state.pads.get(ownerId);
  return pad?.entries[state.currentTurn - 1];
}

export function currentRevealPad(
  state: RyktetGarInternal
): RyktetGarPad | undefined {
  const ownerId = state.playerOrder[state.revealPadIndex];
  return ownerId ? state.pads.get(ownerId) : undefined;
}
