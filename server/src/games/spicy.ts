import spicyDeckEn from "../../../shared/prompts/en/spicy.json" with { type: "json" };
import spicyDeckNo from "../../../shared/prompts/no/spicy.json" with { type: "json" };
import type {
  Locale,
  SpicyActiveRule,
  SpicyChallenge,
} from "../../../shared/types.js";

export interface SpicyInternal {
  locale: Locale;
  /** Shuffled mix of oneShots, categories, and rules for this game. */
  drawDeck: SpicyChallenge[];
  /** Rounds left while a rule is active before its repeal card. */
  roundsUntilRepeal: number;
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

function deckFor(locale: Locale): SeedCard[] {
  return (locale === "no" ? spicyDeckNo : spicyDeckEn) as SeedCard[];
}

export function startSpicy(locale: Locale = "en"): SpicyInternal {
  const all = deckFor(locale);
  const oneShots = all.filter((c) => c.kind === "oneShot");
  const categories = all.filter((c) => c.kind === "category");
  const rules = all.filter((c) => c.kind === "rule");

  // Fresh random mix every game — oneshots, categories, and rules interleaved
  // Target 30–40 cards total per game
  const drawDeck = shuffle([
    ...sample(oneShots, randInt(26, 33)),
    ...sample(categories, randInt(2, 3)),
    ...sample(rules, randInt(2, 4)),
  ]) as SpicyChallenge[];

  return {
    locale,
    drawDeck,
    roundsUntilRepeal: 0,
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
  playerCount: number,
  opts?: { excludeRules?: boolean }
): SpicyChallenge | null {
  const playable: number[] = [];
  for (let i = 0; i < deck.length; i++) {
    const c = deck[i];
    if (opts?.excludeRules && c.kind === "rule") continue;
    if (neededPlayers(c.targets) <= playerCount || c.targets === 0) {
      playable.push(i);
    }
  }
  if (playable.length === 0) return null;
  const idx = playable[Math.floor(Math.random() * playable.length)];
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

function showRepeal(state: SpicyInternal): void {
  if (!state.activeRule) return;
  const repeal: SpicyChallenge = {
    id: `repeal-${state.activeRule.id}`,
    kind: "repeal",
    targets: 0,
    text:
      state.locale === "no"
        ? `${state.activeRule.text} — opphevet.`
        : `${state.activeRule.text} — cancelled.`,
  };
  state.current = repeal;
  state.currentTemplate = repeal.text;
  state.currentLetter = undefined;
  state.targetIds = [];
  state.activeRule = null;
  state.roundsUntilRepeal = 0;
}

/** Draw the next card from the shuffled deck (rules mixed in at random). */
export function dealNext(state: SpicyInternal, playerIds: string[]): void {
  if (state.phase === "finished") return;

  // Active rule timed out — show repeal before anything else
  if (state.activeRule && state.roundsUntilRepeal <= 0) {
    showRepeal(state);
    return;
  }

  const excludeRules = !!state.activeRule;
  const card = takePlayable(state.drawDeck, playerIds.length, { excludeRules });

  if (!card) {
    if (state.activeRule) {
      showRepeal(state);
      return;
    }
    finishRound(state);
    return;
  }

  if (card.kind === "rule") {
    setCurrent(state, card, playerIds);
    state.activeRule = {
      id: card.id,
      text: card.text,
      targetIds: [...state.targetIds],
      targetNames: [],
      targetAvatars: [],
    };
    state.roundsUntilRepeal = ruleDurationRounds();
    return;
  }

  setCurrent(state, card, playerIds);
  if (state.activeRule) {
    state.roundsUntilRepeal -= 1;
  }
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
  const pendingRepeal = state.activeRule ? 1 : 0;
  return state.drawDeck.length + pendingRepeal;
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
