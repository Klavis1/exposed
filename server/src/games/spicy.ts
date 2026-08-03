import spicyDeck from "../../../shared/prompts/spicy.json" with { type: "json" };
import type { SpicyActiveRule, SpicyChallenge } from "../../../shared/types.js";

export interface SpicyInternal {
  gapDeck: SpicyChallenge[];
  ruleDeck: SpicyChallenge[];
  gapsLeft: number;
  nextSpecial: "rule" | "repeal";
  /** Filled text for sticky UI */
  activeRule: SpicyActiveRule | null;
  current: SpicyChallenge | null;
  /** Template before fill (for letter / name fill in public view) */
  currentTemplate: string | null;
  currentLetter?: string;
  targetIds: string[];
  /** playerId -> times mentioned as a card target this game */
  mentionCounts: Map<string, number>;
  phase: "playing" | "finished";
}

type SeedCard = Omit<SpicyChallenge, "kind"> & {
  kind: "oneShot" | "category" | "rule";
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** How many challenge rounds an active rule stays in play before repeal. */
function ruleDurationRounds(): number {
  return randInt(8, 16);
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

export function startSpicy(): SpicyInternal {
  const all = spicyDeck as SeedCard[];
  const oneShots = all.filter((c) => c.kind === "oneShot");
  const categories = all.filter((c) => c.kind === "category");
  const rules = all.filter((c) => c.kind === "rule");

  // Larger gap pool so each active rule can last 8–16 rounds
  const gapDeck = shuffle([
    ...sample(oneShots, randInt(50, 80)),
    ...sample(categories, randInt(2, 4)),
  ]) as SpicyChallenge[];

  return {
    gapDeck,
    ruleDeck: sample(rules, randInt(3, 5)) as SpicyChallenge[],
    gapsLeft: randInt(2, 4),
    nextSpecial: "rule",
    activeRule: null,
    current: null,
    currentTemplate: null,
    targetIds: [],
    mentionCounts: new Map(),
    phase: "playing",
  };
}

/**
 * Prefer players with the fewest mentions so far.
 * Ties broken randomly so order stays unpredictable.
 */
function pickTargets(
  playerIds: string[],
  count: 0 | 1 | 2 | 3,
  mentionCounts: Map<string, number>
): string[] {
  if (count <= 0 || playerIds.length === 0) return [];
  const n = Math.min(count, playerIds.length);
  const ranked = shuffle(playerIds).sort(
    (a, b) => (mentionCounts.get(a) ?? 0) - (mentionCounts.get(b) ?? 0)
  );
  return ranked.slice(0, n);
}

function recordMentions(
  mentionCounts: Map<string, number>,
  targetIds: string[]
): void {
  for (const id of targetIds) {
    mentionCounts.set(id, (mentionCounts.get(id) ?? 0) + 1);
  }
}

function neededPlayers(targets: 0 | 1 | 2 | 3): number {
  return targets;
}

function takePlayable(
  deck: SpicyChallenge[],
  playerCount: number
): SpicyChallenge | null {
  const idx = deck.findIndex(
    (c) => neededPlayers(c.targets) <= playerCount || c.targets === 0
  );
  if (idx === -1) return null;
  const [card] = deck.splice(idx, 1);
  return card;
}

function setCurrent(
  state: SpicyInternal,
  card: SpicyChallenge,
  playerIds: string[]
): void {
  // New joiners start at 0 mentions so they get priority until caught up
  for (const id of playerIds) {
    if (!state.mentionCounts.has(id)) state.mentionCounts.set(id, 0);
  }
  const targetIds = pickTargets(playerIds, card.targets, state.mentionCounts);
  recordMentions(state.mentionCounts, targetIds);
  const letter = card.text.includes("{letter}") ? randomLetter() : undefined;
  state.current = card;
  state.currentTemplate = card.text;
  state.currentLetter = letter;
  state.targetIds = targetIds;
}

/** Advance the gap → rule → gap → repeal cycle. */
export function dealNext(state: SpicyInternal, playerIds: string[]): void {
  if (state.phase === "finished") return;

  // Gap cards (oneShots + categories)
  if (state.gapsLeft > 0 && state.gapDeck.length > 0) {
    const card = takePlayable(state.gapDeck, playerIds.length);
    if (card) {
      state.gapsLeft--;
      setCurrent(state, card, playerIds);
      return;
    }
    // No playable gap cards left for this player count
    state.gapsLeft = 0;
  }

  if (state.nextSpecial === "rule") {
    // Never stack rules — wait until the current one is repealed
    if (state.activeRule) {
      state.nextSpecial = "repeal";
      state.gapsLeft = 0;
      // fall through to repeal below
    } else if (state.ruleDeck.length === 0) {
      finishRound(state);
      return;
    }
  }

  if (state.nextSpecial === "rule" && !state.activeRule) {
    if (state.ruleDeck.length === 0) {
      finishRound(state);
      return;
    }
    const card = takePlayable(state.ruleDeck, playerIds.length);
    if (!card) {
      finishRound(state);
      return;
    }
    // Only one rule at a time — next special is repeal, never another rule
    setCurrent(state, card, playerIds);
    // filled text + names synced in spicyPublic via syncActiveRuleFilled
    state.activeRule = {
      id: card.id,
      text: card.text,
      targetIds: [...state.targetIds],
      targetNames: [],
      targetAvatars: [],
    };
    state.nextSpecial = "repeal";
    state.gapsLeft = ruleDurationRounds();
    return;
  }

  // Repeal (cannot start a new rule while one is active)
  if (state.activeRule) {
    const repeal: SpicyChallenge = {
      id: `repeal-${state.activeRule.id}`,
      kind: "repeal",
      targets: 0,
      text: `${state.activeRule.text} — cancelled.`,
    };
    state.current = repeal;
    state.currentTemplate = repeal.text;
    state.currentLetter = undefined;
    state.targetIds = [];
    state.activeRule = null;
    state.nextSpecial = "rule";
    state.gapsLeft = randInt(2, 4);

    if (state.ruleDeck.length === 0) {
      // Last rule just repealed — round ends on next next, or mark finished after showing repeal
      // Keep phase playing so repeal card is shown; mark finished when advancing again
      state.gapsLeft = 0;
    }
    return;
  }

  finishRound(state);
}

function finishRound(state: SpicyInternal): void {
  state.phase = "finished";
  state.current = null;
  state.currentTemplate = null;
  state.currentLetter = undefined;
  state.targetIds = [];
  state.activeRule = null;
}

/** After filling a rule card, store filled text for sticky + repeal. */
export function syncActiveRuleFilled(
  state: SpicyInternal,
  filledText: string,
  names: string[],
  avatars: (string | undefined)[]
): void {
  if (
    state.current?.kind === "rule" &&
    state.activeRule &&
    state.activeRule.id === state.current.id
  ) {
    state.activeRule = {
      ...state.activeRule,
      text: filledText,
      targetNames: names,
      targetAvatars: avatars,
    };
  }
}

export function remainingCount(state: SpicyInternal): number {
  if (state.phase === "finished") return 0;
  const pendingRepeal =
    state.activeRule && state.nextSpecial === "repeal" ? 1 : 0;
  return state.gapDeck.length + state.ruleDeck.length + pendingRepeal;
}

/** Fill {name} / {name1} / {name2} / {letter} in challenge templates. */
export function fillChallengeText(
  template: string,
  names: string[],
  options?: { letter?: string; targets?: 0 | 1 | 2 | 3 }
): string {
  const t = options?.targets ?? (names.length as 0 | 1 | 2 | 3);
  let name: string;
  let name1: string;
  let name2: string;

  if (t >= 3) {
    name = names[0] ?? "Someone";
    name1 = names[1] ?? "Someone";
    name2 = names[2] ?? "Someone";
  } else if (t === 2) {
    name1 = names[0] ?? "Someone";
    name2 = names[1] ?? "Someone";
    name = name1;
  } else {
    name = names[0] ?? "Someone";
    name1 = name;
    name2 = names[1] ?? "Someone";
  }

  let out = template
    .replaceAll("{name1}", name1)
    .replaceAll("{name2}", name2)
    .replaceAll("{name}", name);

  if (out.includes("{letter}")) {
    out = out.replaceAll("{letter}", options?.letter ?? randomLetter());
  }

  return out;
}

/** @deprecated use dealNext */
export const dealChallenge = dealNext;
