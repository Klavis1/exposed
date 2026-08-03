import { useEffect, useState } from "react";
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
  vertical,
  visibleCount,
  revealDone,
}: {
  voters?: VoteOffPlayerRef[];
  vertical?: boolean;
  visibleCount: number;
  revealDone: boolean;
}) {
  if (!voters?.length) {
    if (!revealDone) return null;
    return (
      <p className="text-center text-xs text-[var(--color-muted)]">Nobody</p>
    );
  }

  const shown = voters.slice(0, visibleCount);

  return (
    <div
      className={
        vertical
          ? "flex flex-col flex-wrap content-start justify-end gap-1.5"
          : "flex flex-wrap justify-center gap-1.5"
      }
    >
      {shown.map((v) => (
        <div key={v.id} className="animate-fade-up">
          <Avatar name={v.name} src={v.avatar} size="sm" />
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
  if (voteoff.phase === "finished") {
    return (
      <Shell>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <Pill>Voteoff</Pill>
          <h1 className="font-display text-3xl font-bold">Round over</h1>
          <p className="text-sm text-[var(--color-muted)]">
            That&apos;s all the questions for this Voteoff.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {isHost ? (
            <>
              <Button onClick={onNext}>Back to lobby</Button>
              <StopGameButton onStop={onEnd} />
            </>
          ) : (
            <p className="py-2 text-center text-sm text-[var(--color-muted)]">
              Waiting for the host…
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
        <Pill>Voteoff</Pill>
        <div className="flex items-center gap-2">
          {voteoff.anonymous ? (
            <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Anonymous
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
                ? `Waiting… ${voteoff.votedCount} / ${voteoff.totalVoters}`
                : `Vote · ${voteoff.votedCount} / ${voteoff.totalVoters} in`}
            </p>
            {isHost ? (
              <>
                <Button
                  variant="secondary"
                  className="!min-h-10 py-2 text-sm"
                  onClick={onForceReveal}
                  disabled={voteoff.votedCount === 0}
                >
                  Reveal now
                </Button>
                <StopGameButton onStop={onEnd} />
              </>
            ) : null}
          </>
        ) : isHost ? (
          <>
            <Button onClick={onNext}>
              {voteoff.questionIndex + 1 >= voteoff.totalQuestions
                ? "Done — to lobby"
                : "Next"}
            </Button>
            <StopGameButton onStop={onEnd} />
          </>
        ) : (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            Host is running Voteoff…
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
  if (voteoff.hasVoted) {
    return (
      <p className="text-center text-sm text-[var(--color-muted)] animate-fade-up">
        Vote locked in.
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
          <Button onClick={() => onVote("yes")}>Yes</Button>
          <Button variant="secondary" onClick={() => onVote("no")}>
            No
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
  const animKey = `${voteoff.questionIndex}-${voteoff.kind}-${voteoff.prompt}`;

  if (voteoff.kind === "versus" && voteoff.optionA && voteoff.optionB) {
    const a = voteoff.tallyA ?? 0;
    const b = voteoff.tallyB ?? 0;
    const total = a + b;
    const pctA = toPct(a, total);
    const pctB = toPct(b, total);
    return (
      <div className="flex flex-col gap-4 animate-card-in">
        <div className="flex items-end justify-center gap-5 sm:gap-8">
          <VerticalBar
            animKey={animKey}
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
            animKey={animKey}
            targetPct={pctB}
            voteCount={b}
            accent="var(--color-category)"
            player={voteoff.optionB}
            voters={voteoff.anonymous ? undefined : voteoff.votersForB}
            showVoters={!voteoff.anonymous}
            votersSide="right"
          />
        </div>
      </div>
    );
  }

  if (voteoff.kind === "yesNo" && voteoff.subject) {
    const yes = voteoff.tallyYes ?? 0;
    const no = voteoff.tallyNo ?? 0;
    const total = yes + no;
    const pctYes = toPct(yes, total);
    const pctNo = toPct(no, total);

    return (
      <div className="flex flex-col items-center gap-4 animate-card-in">
        <Avatar
          name={voteoff.subject.name}
          src={voteoff.subject.avatar}
          size="xl"
        />
        <div className="flex w-full items-end justify-center gap-5 sm:gap-8">
          <VerticalBar
            animKey={animKey}
            targetPct={pctYes}
            voteCount={yes}
            accent="var(--color-success)"
            label="Yes"
            voters={voteoff.anonymous ? undefined : voteoff.votersForYes}
            showVoters={!voteoff.anonymous}
            votersSide="right"
          />
          <div
            className="mb-8 h-48 w-px shrink-0 self-end bg-[var(--color-line)] sm:h-56"
            aria-hidden
          />
          <VerticalBar
            animKey={animKey}
            targetPct={pctNo}
            voteCount={no}
            accent="var(--color-accent)"
            label="No"
            voters={voteoff.anonymous ? undefined : voteoff.votersForNo}
            showVoters={!voteoff.anonymous}
            votersSide="left"
          />
        </div>
      </div>
    );
  }

  return null;
}

function VerticalBar({
  animKey,
  targetPct,
  voteCount,
  accent,
  player,
  label,
  voters,
  showVoters,
  votersSide = "right",
}: {
  animKey: string;
  targetPct: number;
  voteCount: number;
  accent: string;
  player?: VoteOffPlayerRef;
  label?: string;
  voters?: VoteOffPlayerRef[];
  showVoters: boolean;
  votersSide?: "left" | "right";
}) {
  const progress = useRevealProgress(animKey);
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
    <div className="flex w-10 shrink-0 self-stretch items-end justify-center sm:w-11">
      <VoterGrid
        voters={voters}
        vertical
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
