import { useEffect, useMemo, useState } from "react";
import type { BakRyggenState, RevealStep } from "@shared/types";
import {
  Button,
  Card,
  ErrorBanner,
  Pill,
  Shell,
  StopGameButton,
  TextArea,
} from "../components/ui";
import { useT } from "../i18n/LocaleContext";
import { highlightNames } from "../lib/highlightNames";

interface Props {
  bak: BakRyggenState;
  playerNames: string[];
  isHost: boolean;
  error: string | null;
  onSubmit: (payload: {
    question: string;
    gossip: string;
    challenge: string;
  }) => void;
  onNextStep: () => void;
  onEnd: () => void;
}

function useWriteSteps() {
  const t = useT();
  return useMemo(
    () =>
      [
        {
          key: "question" as RevealStep,
          label: t("teaQuestion"),
          placeholder: t("teaQuestionPh"),
        },
        {
          key: "gossip" as RevealStep,
          label: t("teaGossip"),
          hint: t("teaGossipHint"),
          placeholder: t("teaGossipPh"),
        },
        {
          key: "challenge" as RevealStep,
          label: t("teaChallenge"),
          hint: t("teaChallengeHint"),
          placeholder: t("teaChallengePh"),
        },
      ] as const,
    [t]
  );
}

function useSecondsLeft(endsAt?: number) {
  const [left, setLeft] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return left;
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BakRyggen({
  bak,
  playerNames,
  isHost,
  error,
  onSubmit,
  onNextStep,
  onEnd,
}: Props) {
  if (bak.phase === "writing") {
    return (
      <WritingPhase
        bak={bak}
        isHost={isHost}
        error={error}
        onSubmit={onSubmit}
        onEnd={onEnd}
      />
    );
  }

  if (bak.phase === "countdown") {
    return <CountdownPhase bak={bak} isHost={isHost} onEnd={onEnd} />;
  }

  return (
    <RevealPhase
      bak={bak}
      playerNames={playerNames}
      isHost={isHost}
      error={error}
      onNextStep={onNextStep}
      onEnd={onEnd}
    />
  );
}

function WritingTimer({ endsAt }: { endsAt?: number }) {
  const left = useSecondsLeft(endsAt);
  const urgent = left <= 15;

  return (
    <div
      className={`rounded-xl px-2.5 py-1 font-display text-base font-bold tabular-nums tracking-wide ${
        urgent
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "bg-[var(--color-surface-2)] text-[var(--color-ink)]"
      }`}
      aria-live="polite"
    >
      {formatClock(left)}
    </div>
  );
}

function WritingPhase({
  bak,
  isHost,
  error,
  onSubmit,
  onEnd,
}: {
  bak: BakRyggenState;
  isHost: boolean;
  error: string | null;
  onSubmit: Props["onSubmit"];
  onEnd: () => void;
}) {
  const t = useT();
  const writeSteps = useWriteSteps();
  const [stepIndex, setStepIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [gossip, setGossip] = useState("");
  const [challenge, setChallenge] = useState("");

  const step = writeSteps[stepIndex];

  const value =
    step.key === "question"
      ? question
      : step.key === "gossip"
        ? gossip
        : challenge;

  const setValue =
    step.key === "question"
      ? setQuestion
      : step.key === "gossip"
        ? setGossip
        : setChallenge;

  const isLast = stepIndex >= writeSteps.length - 1;

  if (bak.hasSubmitted) {
    return (
      <Shell>
        <div className="flex shrink-0 items-center justify-between">
          <Pill>{t("modeTea")}</Pill>
          <WritingTimer endsAt={bak.writingEndsAt} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center animate-fade-up">
          <Pill>{t("readyCount", bak.submittedCount, bak.totalPlayers)}</Pill>
          <h1 className="font-display text-2xl font-bold">{t("youreIn")}</h1>
          <p className="max-w-xs text-sm text-[var(--color-muted)]">
            {t("waitingEveryone")}
          </p>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--color-tea)] transition-all duration-500"
              style={{
                width: `${(bak.submittedCount / Math.max(bak.totalPlayers, 1)) * 100}%`,
              }}
            />
          </div>
        </div>
        {isHost ? (
          <div className="shrink-0">
            <StopGameButton onStop={onEnd} />
          </div>
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill>{t("modeTea")}</Pill>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-tea)]">
            {stepIndex + 1}/{writeSteps.length}
          </span>
        </div>
        <WritingTimer endsAt={bak.writingEndsAt} />
      </div>

      <ErrorBanner message={error} />

      <form
        key={step.key}
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          if (!isLast) {
            setStepIndex((i) => i + 1);
            return;
          }
          onSubmit({ question, gossip, challenge });
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col justify-center animate-card-in">
          <TextArea
            label={step.label}
            hint={"hint" in step ? step.hint : undefined}
            placeholder={step.placeholder}
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="min-h-36 text-lg"
          />
        </div>

        <div className="flex shrink-0 flex-col gap-2 pt-3">
          <Button type="submit" disabled={!value.trim()}>
            {isLast ? t("submit") : t("next")}
          </Button>
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="!min-h-10 py-2 text-sm"
              onClick={() => setStepIndex((i) => i - 1)}
            >
              {t("back")}
            </Button>
          ) : null}
          {isHost ? <StopGameButton onStop={onEnd} /> : null}
        </div>
      </form>
    </Shell>
  );
}

function CountdownPhase({
  bak,
  isHost,
  onEnd,
}: {
  bak: BakRyggenState;
  isHost: boolean;
  onEnd: () => void;
}) {
  const t = useT();
  const left = useSecondsLeft(bak.countdownEndsAt);

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center animate-fade-up">
        <Pill>{t("everyonesIn")}</Pill>
        <h1 className="font-display text-2xl font-bold">{t("revealStartsIn")}</h1>
        <p className="font-display text-[5.5rem] font-extrabold leading-none tabular-nums text-[var(--color-tea)]">
          {left}
        </p>
        <p className="text-sm text-[var(--color-muted)]">
          {t("submissionsReady", bak.submittedCount)}
        </p>
      </div>
      {isHost ? (
        <div className="shrink-0">
          <StopGameButton onStop={onEnd} />
        </div>
      ) : null}
    </Shell>
  );
}

function RevealPhase({
  bak,
  playerNames,
  isHost,
  error,
  onNextStep,
  onEnd,
}: {
  bak: BakRyggenState;
  playerNames: string[];
  isHost: boolean;
  error: string | null;
  onNextStep: () => void;
  onEnd: () => void;
}) {
  const t = useT();
  const current = bak.revealQueue[bak.revealIndex];
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    setPulse((n) => n + 1);
  }, [bak.revealIndex]);

  if (!current) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p>{t("noSubmissions")}</p>
          {isHost ? <StopGameButton onStop={onEnd} /> : null}
        </div>
      </Shell>
    );
  }

  const stepLabel =
    current.kind === "question"
      ? t("teaQuestion")
      : current.kind === "gossip"
        ? t("teaGossip")
        : t("teaChallenge");

  const isLast = bak.revealIndex >= bak.revealQueue.length - 1;

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between">
        <Pill>
          {bak.revealIndex + 1} / {bak.revealQueue.length}
        </Pill>
        <Pill>{t("modeTea")}</Pill>
      </div>

      <ErrorBanner message={error} />

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <Card
          key={pulse}
          className="animate-card-in border-[var(--color-tea)]/40 bg-gradient-to-b from-[#101c2c] to-[var(--color-surface)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-tea)]">
            {stepLabel}
          </p>
          <p className="mt-3 font-display text-xl font-semibold leading-snug sm:text-2xl">
            {highlightNames(current.text, playerNames)}
          </p>
        </Card>
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        {isHost ? (
          <>
            <Button onClick={onNextStep}>
              {isLast ? t("doneToLobby") : t("next")}
            </Button>
            <StopGameButton onStop={onEnd} />
          </>
        ) : (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            {t("hostRunningReveal")}
          </p>
        )}
      </div>
    </Shell>
  );
}
