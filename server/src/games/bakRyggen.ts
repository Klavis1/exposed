import type {
  BakRyggenRevealCard,
  BakRyggenSubmission,
  RevealStep,
} from "../../../shared/types.js";

export const WRITING_MS = 120_000;
export const COUNTDOWN_MS = 5_000;

export interface BakRyggenInternal {
  phase: "writing" | "countdown" | "reveal";
  /** Players expected to submit this writing round (includes mid-round joiners). */
  eligibleWriterIds: string[];
  submissions: Map<string, BakRyggenSubmission>;
  revealQueue: BakRyggenRevealCard[];
  revealIndex: number;
  writingEndsAt: number;
  countdownEndsAt?: number;
}

export function startBakRyggen(playerIds: string[]): BakRyggenInternal {
  return {
    phase: "writing",
    eligibleWriterIds: [...playerIds],
    submissions: new Map(),
    revealQueue: [],
    revealIndex: 0,
    writingEndsAt: Date.now() + WRITING_MS,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const list = [...arr];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Flatten every answer into its own card, then shuffle the full deck. */
export function buildRevealQueue(
  submissions: Map<string, BakRyggenSubmission>
): BakRyggenRevealCard[] {
  const cards: BakRyggenRevealCard[] = [];
  for (const s of submissions.values()) {
    const entries: [RevealStep, string][] = [
      ["question", s.question],
      ["gossip", s.gossip],
      ["challenge", s.challenge],
    ];
    for (const [kind, text] of entries) {
      const trimmed = text.trim();
      if (trimmed) cards.push({ kind, text: trimmed });
    }
  }
  return shuffle(cards);
}

export function advanceRevealIndex(state: BakRyggenInternal): boolean {
  if (state.revealIndex < state.revealQueue.length - 1) {
    state.revealIndex += 1;
    return true;
  }
  return false;
}
