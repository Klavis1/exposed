export type PlayMode = "bakRyggen" | "spicy" | "voteoff";
export type GameMode = "lobby" | PlayMode;

export type VoteOffKind = "versus" | "yesNo";
export type VoteOffPhase = "voting" | "reveal" | "finished";

export interface VoteOffPlayerRef {
  id: string;
  name: string;
  avatar?: string;
}

export interface VoteOffState {
  phase: VoteOffPhase;
  kind: VoteOffKind;
  questionIndex: number;
  totalQuestions: number;
  prompt: string;
  anonymous: boolean;
  /** versus options */
  optionA?: VoteOffPlayerRef;
  optionB?: VoteOffPlayerRef;
  /** yesNo subject */
  subject?: VoteOffPlayerRef;
  hasVoted: boolean;
  votedCount: number;
  totalVoters: number;
  /** Reveal tallies — versus uses A/B; yesNo uses Yes/No */
  tallyA?: number;
  tallyB?: number;
  tallyYes?: number;
  tallyNo?: number;
  /** Non-anonymous reveal only — voter avatars per side */
  votersForA?: VoteOffPlayerRef[];
  votersForB?: VoteOffPlayerRef[];
  votersForYes?: VoteOffPlayerRef[];
  votersForNo?: VoteOffPlayerRef[];
}

export type BakRyggenPhase = "writing" | "countdown" | "reveal";
export type RevealStep = "question" | "gossip" | "challenge";

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  /** Optional compressed data-URL avatar */
  avatar?: string;
}

export interface BakRyggenSubmission {
  authorId: string;
  question: string;
  gossip: string;
  challenge: string;
}

/** One revealed answer card (question, gossip, or challenge). */
export interface BakRyggenRevealCard {
  kind: RevealStep;
  text: string;
}

export interface BakRyggenState {
  phase: BakRyggenPhase;
  submittedCount: number;
  totalPlayers: number;
  hasSubmitted: boolean;
  /** Epoch ms when writing phase ends (120s shared timer) */
  writingEndsAt?: number;
  /** Epoch ms when pre-reveal countdown ends */
  countdownEndsAt?: number;
  revealQueue: BakRyggenRevealCard[];
  revealIndex: number;
}

export type SpicyKind = "oneShot" | "category" | "rule" | "repeal";

export interface SpicyChallenge {
  id: string;
  kind: SpicyKind;
  text: string;
  /** 0 = group prompt (no names), 1–3 = distinct player slots */
  targets: 0 | 1 | 2 | 3;
}

export interface SpicyActiveRule {
  id: string;
  text: string;
  targetIds: string[];
  targetNames: string[];
  targetAvatars: (string | undefined)[];
}

export interface SpicyState {
  challenge: SpicyChallenge | null;
  targetIds: string[];
  targetNames: string[];
  targetAvatars: (string | undefined)[];
  remaining: number;
  activeRules: SpicyActiveRule[];
  phase: "playing" | "finished";
}

export interface RoomPublicState {
  pin: string;
  players: Player[];
  /** Current phase: lobby waiting, or an active game */
  mode: GameMode;
  /** Mode chosen when the room was created */
  playMode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  bakRyggen?: BakRyggenState;
  spicy?: SpicyState;
  voteoff?: VoteOffState;
  error?: string;
}

/** Client-bound events */
export interface ServerToClientEvents {
  "room:state": (state: RoomPublicState) => void;
  "room:error": (message: string) => void;
}

/** Client-emitted events */
export interface ClientToServerEvents {
  "room:create": (
    payload: { name: string; avatar?: string; playMode: PlayMode },
    cb?: (res: CreateJoinResult) => void
  ) => void;
  "room:join": (
    payload: { pin: string; name: string; avatar?: string },
    cb?: (res: CreateJoinResult) => void
  ) => void;
  "room:rejoin": (
    payload: { pin: string; playerId: string },
    cb?: (res: CreateJoinResult) => void
  ) => void;
  "room:leave": () => void;
  "room:start": () => void;
  "room:endGame": () => void;
  "room:setPlayMode": (payload: { playMode: PlayMode }) => void;
  "bakRyggen:submit": (payload: {
    question: string;
    gossip: string;
    challenge: string;
  }) => void;
  "bakRyggen:nextReveal": () => void;
  "bakRyggen:nextStep": () => void;
  "spicy:next": () => void;
  "voteoff:vote": (payload: { choiceId: string }) => void;
  "voteoff:next": () => void;
  "voteoff:forceReveal": () => void;
}

export interface CreateJoinResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  pin?: string;
}
