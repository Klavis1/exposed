import type {
  BakRyggenPublicSubmission,
  BakRyggenSubmission,
  RevealStep,
} from "../../../shared/types.js";

export const WRITING_MS = 120_000;
export const COUNTDOWN_MS = 5_000;

export interface BakRyggenInternal {
  phase: "writing" | "countdown" | "reveal";
  submissions: Map<string, BakRyggenSubmission>;
  revealQueue: BakRyggenPublicSubmission[];
  revealIndex: number;
  revealStep: RevealStep;
  writingEndsAt: number;
  countdownEndsAt?: number;
}

export function startBakRyggen(_playerIds: string[]): BakRyggenInternal {
  return {
    phase: "writing",
    submissions: new Map(),
    revealQueue: [],
    revealIndex: 0,
    revealStep: "question",
    writingEndsAt: Date.now() + WRITING_MS,
  };
}

export function buildRevealQueue(
  submissions: Map<string, BakRyggenSubmission>
): BakRyggenPublicSubmission[] {
  const list: BakRyggenPublicSubmission[] = [...submissions.values()].map(
    (s) => ({
      question: s.question,
      gossip: s.gossip,
      challenge: s.challenge,
    })
  );

  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const STEPS: RevealStep[] = ["question", "gossip", "challenge"];

export function advanceRevealStep(state: BakRyggenInternal): boolean {
  const idx = STEPS.indexOf(state.revealStep);
  if (idx < STEPS.length - 1) {
    state.revealStep = STEPS[idx + 1];
    return true;
  }
  return false;
}

export function advanceRevealIndex(state: BakRyggenInternal): boolean {
  if (state.revealIndex < state.revealQueue.length - 1) {
    state.revealIndex += 1;
    state.revealStep = "question";
    return true;
  }
  return false;
}
