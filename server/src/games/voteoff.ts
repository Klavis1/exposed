import voteoffDeck from "../../../shared/prompts/voteoff.json" with { type: "json" };
import type { VoteOffKind, VoteOffPhase } from "../../../shared/types.js";

export interface VoteOffPrompt {
  id: string;
  kind: VoteOffKind;
  text: string;
}

export interface VoteOffInternal {
  phase: VoteOffPhase;
  deck: VoteOffPrompt[];
  questionIndex: number;
  totalQuestions: number;
  current: VoteOffPrompt | null;
  anonymous: boolean;
  /** versus: two player ids; yesNo: one subject id */
  optionAId?: string;
  optionBId?: string;
  subjectId?: string;
  /** voterId -> choiceId (player id, or "yes" | "no") */
  votes: Map<string, string>;
  /** Players who must vote this round (includes mid-round joiners). */
  expectedVoterIds: string[];
  /** playerId -> times featured as option/subject */
  appearanceCounts: Map<string, number>;
}

const QUESTIONS_PER_GAME = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleBalanced(deck: VoteOffPrompt[], n: number): VoteOffPrompt[] {
  const versus = shuffle(deck.filter((p) => p.kind === "versus"));
  const yesNo = shuffle(deck.filter((p) => p.kind === "yesNo"));
  const nVersus = Math.min(Math.ceil(n / 2), versus.length);
  let nYesNo = Math.min(n - nVersus, yesNo.length);
  let picked = [
    ...versus.slice(0, nVersus),
    ...yesNo.slice(0, nYesNo),
  ];
  if (picked.length < n) {
    picked = [
      ...picked,
      ...versus.slice(nVersus, nVersus + (n - picked.length)),
    ];
  }
  if (picked.length < n) {
    picked = [
      ...picked,
      ...yesNo.slice(nYesNo, nYesNo + (n - picked.length)),
    ];
  }
  return shuffle(picked).slice(0, n);
}

function pickFair(
  playerIds: string[],
  count: number,
  appearanceCounts: Map<string, number>
): string[] {
  if (count <= 0 || playerIds.length === 0) return [];
  const n = Math.min(count, playerIds.length);
  const ranked = shuffle(playerIds).sort(
    (a, b) =>
      (appearanceCounts.get(a) ?? 0) - (appearanceCounts.get(b) ?? 0)
  );
  return ranked.slice(0, n);
}

function recordAppearance(
  appearanceCounts: Map<string, number>,
  ids: string[]
): void {
  for (const id of ids) {
    appearanceCounts.set(id, (appearanceCounts.get(id) ?? 0) + 1);
  }
}

function fillPrompt(
  template: string,
  kind: VoteOffKind,
  names: { a?: string; b?: string; subject?: string }
): string {
  if (kind === "yesNo") {
    return template.replaceAll("{name}", names.subject ?? "Someone");
  }
  return template
    .replaceAll("{name1}", names.a ?? "Someone")
    .replaceAll("{name2}", names.b ?? "Someone")
    .replaceAll("{name}", names.a ?? "Someone");
}

export function startVoteOff(playerIds: string[]): VoteOffInternal {
  const all = voteoffDeck as VoteOffPrompt[];
  const deck = sampleBalanced(all, QUESTIONS_PER_GAME);
  const state: VoteOffInternal = {
    phase: "voting",
    deck,
    questionIndex: 0,
    totalQuestions: deck.length,
    current: null,
    anonymous: false,
    votes: new Map(),
    expectedVoterIds: [],
    appearanceCounts: new Map(),
  };
  dealQuestion(state, playerIds);
  return state;
}

export function dealQuestion(
  state: VoteOffInternal,
  playerIds: string[]
): void {
  if (state.questionIndex >= state.deck.length) {
    state.phase = "finished";
    state.current = null;
    state.votes.clear();
    state.expectedVoterIds = [];
    return;
  }

  for (const id of playerIds) {
    if (!state.appearanceCounts.has(id)) state.appearanceCounts.set(id, 0);
  }

  const prompt = state.deck[state.questionIndex];
  state.current = prompt;
  state.anonymous = Math.random() < 0.5;
  state.votes = new Map();
  state.expectedVoterIds = [...playerIds];
  state.phase = "voting";
  state.optionAId = undefined;
  state.optionBId = undefined;
  state.subjectId = undefined;

  if (prompt.kind === "versus") {
    const [a, b] = pickFair(playerIds, 2, state.appearanceCounts);
    state.optionAId = a;
    state.optionBId = b;
    recordAppearance(state.appearanceCounts, [a, b].filter(Boolean) as string[]);
  } else {
    const [subject] = pickFair(playerIds, 1, state.appearanceCounts);
    state.subjectId = subject;
    if (subject) recordAppearance(state.appearanceCounts, [subject]);
  }
}

export function filledPrompt(
  state: VoteOffInternal,
  nameById: Map<string, string>
): string {
  if (!state.current) return "";
  return fillPrompt(state.current.text, state.current.kind, {
    a: state.optionAId
      ? nameById.get(state.optionAId)
      : undefined,
    b: state.optionBId
      ? nameById.get(state.optionBId)
      : undefined,
    subject: state.subjectId
      ? nameById.get(state.subjectId)
      : undefined,
  });
}

function requiredVoters(
  state: VoteOffInternal,
  playerIds: string[]
): string[] {
  const present = new Set(playerIds);
  return state.expectedVoterIds.filter((id) => present.has(id));
}

export function castVote(
  state: VoteOffInternal,
  voterId: string,
  choiceId: string,
  playerIds: string[]
): string | null {
  if (state.phase !== "voting" || !state.current) {
    return "Voting is closed.";
  }
  if (!playerIds.includes(voterId)) return "You are not in this game.";

  if (state.current.kind === "versus") {
    if (choiceId !== state.optionAId && choiceId !== state.optionBId) {
      return "Invalid choice.";
    }
  } else if (choiceId !== "yes" && choiceId !== "no") {
    return "Invalid choice.";
  }

  state.votes.set(voterId, choiceId);

  const required = requiredVoters(state, playerIds);
  if (
    required.length > 0 &&
    required.every((id) => state.votes.has(id))
  ) {
    state.phase = "reveal";
  }
  return null;
}

export function expectedVoterCount(
  state: VoteOffInternal,
  playerIds: string[]
): number {
  return requiredVoters(state, playerIds).length;
}

export function forceReveal(state: VoteOffInternal): string | null {
  if (state.phase !== "voting") return "Not in the voting phase.";
  if (state.votes.size === 0) return "Need at least one vote.";
  state.phase = "reveal";
  return null;
}

export function advanceVoteOff(
  state: VoteOffInternal,
  playerIds: string[]
): string | null {
  if (state.phase === "finished") return "The game is over.";
  if (state.phase !== "reveal") return "Wait for the reveal.";

  state.questionIndex += 1;
  if (state.questionIndex >= state.deck.length) {
    state.phase = "finished";
    state.current = null;
    state.votes.clear();
    return null;
  }
  dealQuestion(state, playerIds);
  return null;
}

export function tallyVotes(state: VoteOffInternal): {
  tallyA: number;
  tallyB: number;
  tallyYes: number;
  tallyNo: number;
  votersA: string[];
  votersB: string[];
  votersYes: string[];
  votersNo: string[];
} {
  let tallyA = 0;
  let tallyB = 0;
  let tallyYes = 0;
  let tallyNo = 0;
  const votersA: string[] = [];
  const votersB: string[] = [];
  const votersYes: string[] = [];
  const votersNo: string[] = [];

  for (const [voterId, choice] of state.votes) {
    if (state.current?.kind === "versus") {
      if (choice === state.optionAId) {
        tallyA++;
        votersA.push(voterId);
      } else if (choice === state.optionBId) {
        tallyB++;
        votersB.push(voterId);
      }
    } else if (choice === "yes") {
      tallyYes++;
      votersYes.push(voterId);
    } else if (choice === "no") {
      tallyNo++;
      votersNo.push(voterId);
    }
  }

  return {
    tallyA,
    tallyB,
    tallyYes,
    tallyNo,
    votersA,
    votersB,
    votersYes,
    votersNo,
  };
}
