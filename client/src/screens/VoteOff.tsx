import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { VoteOffPlayerRef, VoteOffState } from "@shared/types";
import { Avatar } from "../components/Avatar";
import {
  Button,
  Card,
  ErrorBanner,
  Pill,
  Shell,
  StopGameButton,
} from "../components/ui";
import { useT } from "../i18n/LocaleContext";

const CONFETTI_COLORS = [
  "#ff5c6a",
  "#f0c14b",
  "#7dd3c0",
  "#4aa3ff",
  "#ff9b6a",
  "#4ade9a",
  "#ffffff",
];

function ConfettiBurst({ burstKey }: { burstKey: string }) {
  const pieces = useMemo(() => {
    return Array.from({ length: 56 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 56 + (i % 5) * 0.12;
      const dist = 160 + (i % 7) * 52 + (i % 3) * 28;
      const cx = `${Math.cos(angle) * dist}px`;
      const cy = `${Math.sin(angle) * dist + 80 + (i % 5) * 55}px`;
      return {
        id: `${burstKey}-${i}`,
        style: {
          "--cx": cx,
          "--cy": cy,
          "--rot": `${(i % 2 === 0 ? 1 : -1) * (320 + (i % 8) * 55)}deg`,
          "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--w": `${5 + (i % 4)}px`,
          "--h": `${8 + (i % 5)}px`,
          // ~3.5–4.5× longer than the original ~1s burst
          "--dur": `${3.4 + (i % 8) * 0.18}s`,
          "--delay": `${(i % 12) * 0.035}s`,
        } as CSSProperties,
      };
    });
  }, [burstKey]);

  return createPortal(
    <div className="confetti-burst" aria-hidden>
      {pieces.map((p) => (
        <span key={p.id} className="confetti-piece" style={p.style} />
      ))}
    </div>,
    document.body
  );
}

/** Same fill math as VerticalBar — used to fire confetti when 100% is reached. */
function animatedBarPct(
  progress: number,
  targetPct: number,
  voteCount: number
): number {
  const steps = Math.max(voteCount, 0);
  if (steps > 0) {
    const revealedSteps =
      progress <= 0
        ? 0
        : Math.min(steps, Math.ceil(progress * steps));
    return (revealedSteps / steps) * targetPct;
  }
  return progress * targetPct;
}

/** Match VerticalBar height transition so confetti starts when the bar looks full. */
const BAR_FILL_TRANSITION_MS = 280;

function useConfettiOnHundred(
  animKey: string,
  sweep: boolean,
  progress: number,
  winnerVotes: number
) {
  const [active, setActive] = useState(false);
  const hit100 =
    sweep && animatedBarPct(progress, 100, winnerVotes) >= 100;

  useEffect(() => {
    setActive(false);
  }, [animKey]);

  useEffect(() => {
    if (!hit100 || active) return;
    const id = window.setTimeout(
      () => setActive(true),
      BAR_FILL_TRANSITION_MS
    );
    return () => clearTimeout(id);
  }, [hit100, active]);

  return active;
}

interface Props {
  voteoff: VoteOffState;
  isHost: boolean;
  error: string | null;
  onVote: (choiceId: string) => void;
  onNext: () => void;
  onForceReveal: () => void;
  onEnd: () => void;
}

const REVEAL_MS = 3400;

function useRevealProgress(animKey: string) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / REVEAL_MS);
      const eased = 1 - (1 - t) ** 3;
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setProgress(1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animKey]);

  return progress;
}

function toPct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function VoterGrid({
  voters,
  visibleCount,
  revealDone,
}: {
  voters?: VoteOffPlayerRef[];
  visibleCount: number;
  revealDone: boolean;
}) {
  const t = useT();
  if (!voters?.length) {
    if (!revealDone) return null;
    return (
      <p className="text-center text-xs text-[var(--color-muted)]">
        {t("nobody")}
      </p>
    );
  }

  // Always include every voter once the reveal finishes; step in during anim.
  const count = revealDone
    ? voters.length
    : Math.min(voters.length, visibleCount);
  const shown = voters.slice(0, count);

  return (
    <div className="grid grid-cols-2 content-end justify-items-center gap-1">
      {shown.map((v) => (
        <div key={v.id} className="animate-fade-up">
          <Avatar name={v.name} src={v.avatar} size="xs" />
        </div>
      ))}
    </div>
  );
}

export function VoteOff({
  voteoff,
  isHost,
  error,
  onVote,
  onNext,
  onForceReveal,
  onEnd,
}: Props) {
  const t = useT();

  if (voteoff.phase === "finished") {
    return (
      <Shell>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <Pill>{t("modeVoteoff")}</Pill>
          <h1 className="font-display text-3xl font-bold">{t("roundOver")}</h1>
          <p className="text-sm text-[var(--color-muted)]">{t("voteoffEnd")}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {isHost ? (
            <>
              <Button onClick={onNext}>{t("backToLobby")}</Button>
              <StopGameButton onStop={onEnd} />
            </>
          ) : (
            <p className="py-2 text-center text-sm text-[var(--color-muted)]">
              {t("waitingHost")}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  const progress = `${voteoff.questionIndex + 1} / ${voteoff.totalQuestions}`;

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Pill>{t("modeVoteoff")}</Pill>
        <div className="flex items-center gap-2">
          {voteoff.anonymous ? (
            <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("anonymous")}
            </span>
          ) : null}
          <span className="text-xs font-semibold tabular-nums text-[var(--color-muted)]">
            {progress}
          </span>
        </div>
      </div>

      <ErrorBanner message={error} />

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
        <Card className="border-[var(--color-accent)]/30">
          <p className="font-display text-xl font-semibold leading-snug sm:text-2xl">
            {voteoff.prompt}
          </p>
        </Card>

        {voteoff.phase === "voting" ? (
          <VotingUI voteoff={voteoff} onVote={onVote} />
        ) : (
          <RevealUI voteoff={voteoff} />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        {voteoff.phase === "voting" ? (
          <>
            <p className="text-center text-sm text-[var(--color-muted)]">
              {voteoff.hasVoted
                ? t("waitingVotes", voteoff.votedCount, voteoff.totalVoters)
                : t("voteProgress", voteoff.votedCount, voteoff.totalVoters)}
            </p>
            {isHost ? (
              <>
                <Button
                  variant="secondary"
                  className="!min-h-10 py-2 text-sm"
                  onClick={onForceReveal}
                  disabled={voteoff.votedCount === 0}
                >
                  {t("revealNow")}
                </Button>
                <StopGameButton onStop={onEnd} />
              </>
            ) : null}
          </>
        ) : isHost ? (
          <>
            <Button onClick={onNext}>
              {voteoff.questionIndex + 1 >= voteoff.totalQuestions
                ? t("doneToLobby")
                : t("next")}
            </Button>
            <StopGameButton onStop={onEnd} />
          </>
        ) : (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            {t("hostRunningVoteoff")}
          </p>
        )}
      </div>
    </Shell>
  );
}

function VotingUI({
  voteoff,
  onVote,
}: {
  voteoff: VoteOffState;
  onVote: (choiceId: string) => void;
}) {
  const t = useT();

  if (voteoff.hasVoted) {
    return (
      <p className="text-center text-sm text-[var(--color-muted)] animate-fade-up">
        {t("voteLocked")}
      </p>
    );
  }

  if (voteoff.kind === "versus" && voteoff.optionA && voteoff.optionB) {
    return (
      <div className="grid grid-cols-2 gap-3 animate-card-in">
        <ChoiceButton
          player={voteoff.optionA}
          onClick={() => onVote(voteoff.optionA!.id)}
        />
        <ChoiceButton
          player={voteoff.optionB}
          onClick={() => onVote(voteoff.optionB!.id)}
        />
      </div>
    );
  }

  if (voteoff.kind === "yesNo" && voteoff.subject) {
    return (
      <div className="flex flex-col items-center gap-4 animate-card-in">
        <Avatar
          name={voteoff.subject.name}
          src={voteoff.subject.avatar}
          size="xl"
        />
        <div className="grid w-full grid-cols-2 gap-3">
          <Button onClick={() => onVote("yes")}>{t("yes")}</Button>
          <Button variant="secondary" onClick={() => onVote("no")}>
            {t("no")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function ChoiceButton({
  player,
  onClick,
}: {
  player: VoteOffPlayerRef;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-4 transition hover:border-[var(--color-accent)]/60 active:scale-[0.98]"
    >
      <Avatar name={player.name} src={player.avatar} size="xl" />
      <span className="truncate text-sm font-semibold">{player.name}</span>
    </button>
  );
}

function RevealUI({ voteoff }: { voteoff: VoteOffState }) {
  const t = useT();
  const animKey = `${voteoff.questionIndex}-${voteoff.kind}-${voteoff.prompt}`;
  const progress = useRevealProgress(animKey);

  if (voteoff.kind === "versus" && voteoff.optionA && voteoff.optionB) {
    const a = voteoff.tallyA ?? 0;
    const b = voteoff.tallyB ?? 0;
    const total = a + b;
    const pctA = toPct(a, total);
    const pctB = toPct(b, total);
    const sweep = total > 0 && (pctA === 100 || pctB === 100);
    const winnerVotes = pctA === 100 ? a : pctB === 100 ? b : 0;
    return (
      <RevealWithConfetti
        animKey={animKey}
        progress={progress}
        sweep={sweep}
        winnerVotes={winnerVotes}
      >
        <div className="flex items-end justify-center gap-5 sm:gap-8">
          <VerticalBar
            progress={progress}
            targetPct={pctA}
            voteCount={a}
            accent="var(--color-accent)"
            player={voteoff.optionA}
            voters={voteoff.anonymous ? undefined : voteoff.votersForA}
            showVoters={!voteoff.anonymous}
            votersSide="left"
          />
          <div
            className="mb-24 h-48 w-px shrink-0 self-end bg-[var(--color-line)] sm:mb-28 sm:h-56"
            aria-hidden
          />
          <VerticalBar
            progress={progress}
            targetPct={pctB}
            voteCount={b}
            accent="var(--color-category)"
            player={voteoff.optionB}
            voters={voteoff.anonymous ? undefined : voteoff.votersForB}
            showVoters={!voteoff.anonymous}
            votersSide="right"
          />
        </div>
      </RevealWithConfetti>
    );
  }

  if (voteoff.kind === "yesNo" && voteoff.subject) {
    const yes = voteoff.tallyYes ?? 0;
    const no = voteoff.tallyNo ?? 0;
    const total = yes + no;
    const pctYes = toPct(yes, total);
    const pctNo = toPct(no, total);
    const sweep = total > 0 && (pctYes === 100 || pctNo === 100);
    const winnerVotes = pctYes === 100 ? yes : pctNo === 100 ? no : 0;

    return (
      <RevealWithConfetti
        animKey={animKey}
        progress={progress}
        sweep={sweep}
        winnerVotes={winnerVotes}
        className="items-center"
      >
        <Avatar
          name={voteoff.subject.name}
          src={voteoff.subject.avatar}
          size="xl"
        />
        <div className="flex w-full items-end justify-center gap-5 sm:gap-8">
          <VerticalBar
            progress={progress}
            targetPct={pctYes}
            voteCount={yes}
            accent="var(--color-success)"
            label={t("yes")}
            voters={voteoff.anonymous ? undefined : voteoff.votersForYes}
            showVoters={!voteoff.anonymous}
            votersSide="right"
          />
          <div
            className="mb-8 h-48 w-px shrink-0 self-end bg-[var(--color-line)] sm:h-56"
            aria-hidden
          />
          <VerticalBar
            progress={progress}
            targetPct={pctNo}
            voteCount={no}
            accent="var(--color-accent)"
            label={t("no")}
            voters={voteoff.anonymous ? undefined : voteoff.votersForNo}
            showVoters={!voteoff.anonymous}
            votersSide="left"
          />
        </div>
      </RevealWithConfetti>
    );
  }

  return null;
}

function RevealWithConfetti({
  animKey,
  progress,
  sweep,
  winnerVotes,
  className = "",
  children,
}: {
  animKey: string;
  progress: number;
  sweep: boolean;
  winnerVotes: number;
  className?: string;
  children: ReactNode;
}) {
  const showConfetti = useConfettiOnHundred(
    animKey,
    sweep,
    progress,
    winnerVotes
  );

  return (
    <div className={`flex flex-col gap-4 animate-card-in ${className}`}>
      {showConfetti ? <ConfettiBurst burstKey={animKey} /> : null}
      {children}
    </div>
  );
}

function VerticalBar({
  progress,
  targetPct,
  voteCount,
  accent,
  player,
  label,
  voters,
  showVoters,
  votersSide = "right",
}: {
  progress: number;
  targetPct: number;
  voteCount: number;
  accent: string;
  player?: VoteOffPlayerRef;
  label?: string;
  voters?: VoteOffPlayerRef[];
  showVoters: boolean;
  votersSide?: "left" | "right";
}) {
  const steps = Math.max(voteCount, 0);
  const stepped = steps > 0;
  const revealedSteps = stepped
    ? progress <= 0
      ? 0
      : Math.min(steps, Math.ceil(progress * steps))
    : 0;
  const animated = stepped
    ? (revealedSteps / steps) * targetPct
    : progress * targetPct;
  const displayPct = Math.round(animated);
  const barHeight = `${animated}%`;
  const revealDone = progress >= 1;
  const visibleCount = showVoters ? revealedSteps : 0;

  const voterColumn = showVoters ? (
    <div className="flex w-[3.75rem] shrink-0 items-end justify-center self-end sm:w-16">
      <VoterGrid
        voters={voters}
        visibleCount={visibleCount}
        revealDone={revealDone}
      />
    </div>
  ) : null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-2.5">
        {votersSide === "left" ? voterColumn : null}
        <div
          className="relative flex h-48 w-14 items-end justify-center overflow-hidden rounded-2xl sm:h-56 sm:w-16"
          style={{
            background: `color-mix(in srgb, ${accent} 14%, var(--color-surface))`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent)`,
          }}
        >
          <div
            className="w-full rounded-2xl"
            style={{
              height: barHeight,
              background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 82%, white), ${accent})`,
              boxShadow: `0 0 18px color-mix(in srgb, ${accent} 35%, transparent)`,
              transition: stepped ? "height 0.28s ease-out" : undefined,
            }}
          />
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center font-display text-sm font-bold tabular-nums text-[var(--color-ink)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] sm:text-base"
            style={{
              height: `max(${barHeight}, 2.25rem)`,
              transition: stepped ? "height 0.28s ease-out" : undefined,
            }}
          >
            {displayPct}%
          </span>
        </div>
        {votersSide === "right" ? voterColumn : null}
      </div>
      {player ? (
        <div className="flex flex-col items-center gap-1.5">
          <Avatar name={player.name} src={player.avatar} size="lg" />
          <p className="max-w-28 truncate text-center text-sm font-semibold text-[var(--color-muted)]">
            {player.name}
          </p>
        </div>
      ) : label ? (
        <p
          className="font-display text-base font-bold uppercase tracking-[0.1em]"
          style={{ color: accent }}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
