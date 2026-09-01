import { useEffect, useRef, useState } from "react";
import type { RyktetGarEntry, RyktetGarState } from "@shared/types";
import { Avatar } from "../components/Avatar";
import {
  DrawCanvas,
  type DrawCanvasHandle,
} from "../components/DrawCanvas";
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

interface Props {
  ryktetGar: RyktetGarState;
  isHost: boolean;
  error: string | null;
  onSubmit: (payload: { text?: string; image?: string }) => void;
  onNext: () => void;
  onEnd: () => void;
}

export function RyktetGar({
  ryktetGar,
  isHost,
  error,
  onSubmit,
  onNext,
  onEnd,
}: Props) {
  const t = useT();

  if (ryktetGar.phase === "finished") {
    return (
      <Shell>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <Pill>{t("modeRyktet")}</Pill>
          <h1 className="font-display text-3xl font-bold">{t("roundOver")}</h1>
          <p className="text-sm text-[var(--color-muted)]">{t("ryktetEnd")}</p>
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

  if (ryktetGar.phase === "reveal") {
    return (
      <RevealView
        ryktetGar={ryktetGar}
        isHost={isHost}
        error={error}
        onNext={onNext}
        onEnd={onEnd}
      />
    );
  }

  return (
    <PlayView
      ryktetGar={ryktetGar}
      isHost={isHost}
      error={error}
      onSubmit={onSubmit}
      onEnd={onEnd}
    />
  );
}

function PlayView({
  ryktetGar,
  isHost,
  error,
  onSubmit,
  onEnd,
}: {
  ryktetGar: RyktetGarState;
  isHost: boolean;
  error: string | null;
  onSubmit: (payload: { text?: string; image?: string }) => void;
  onEnd: () => void;
}) {
  const t = useT();
  const drawRef = useRef<DrawCanvasHandle>(null);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSketch, setHasSketch] = useState(false);

  useEffect(() => {
    setBusy(false);
    setGuess("");
    setHasSketch(false);
  }, [ryktetGar.turnIndex]);

  useEffect(() => {
    setBusy(false);
  }, [error, ryktetGar.hasSubmitted]);

  const waiting =
    !ryktetGar.inRound ||
    ryktetGar.hasSubmitted ||
    (ryktetGar.turnKind === "drawing" && !ryktetGar.promptText) ||
    (ryktetGar.turnKind === "guessing" && !ryktetGar.promptImage);

  const sendDrawing = () => {
    const image = drawRef.current?.toJpeg();
    if (!image || busy) return;
    setBusy(true);
    onSubmit({ image });
  };

  const sendGuess = () => {
    const text = guess.trim();
    if (!text || busy) return;
    setBusy(true);
    onSubmit({ text });
  };

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Pill>{t("modeRyktet")}</Pill>
        <span className="text-xs font-semibold tabular-nums text-[var(--color-muted)]">
          {t("ryktetTurn", ryktetGar.turnIndex, ryktetGar.totalTurns)}
        </span>
      </div>

      <ErrorBanner message={error} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
        {!ryktetGar.inRound ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted)]">
            {t("ryktetSpectate")}
          </p>
        ) : ryktetGar.hasSubmitted ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted)] animate-fade-up">
            {t(
              "ryktetWaiting",
              ryktetGar.submittedCount,
              ryktetGar.totalPlayers
            )}
          </p>
        ) : ryktetGar.turnKind === "drawing" ? (
          <>
            <Card className="border-[var(--color-rumor)]/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-rumor)]">
                {t("ryktetDrawThis")}
              </p>
              <p className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">
                {ryktetGar.promptText}
              </p>
            </Card>
            <DrawCanvas
              key={ryktetGar.turnIndex}
              ref={drawRef}
              onDirtyChange={setHasSketch}
            />
          </>
        ) : (
          <>
            <Card className="border-[var(--color-rumor)]/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-rumor)]">
                {t("ryktetGuessThis")}
              </p>
              {ryktetGar.promptImage ? (
                <img
                  src={ryktetGar.promptImage}
                  alt=""
                  className="w-full rounded-2xl bg-white"
                />
              ) : null}
            </Card>
            <TextArea
              key={ryktetGar.turnIndex}
              label={t("ryktetGuessThis")}
              placeholder={t("ryktetGuessPh")}
              className="min-h-20 text-[16px]"
              maxLength={80}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 pt-2">
        {!waiting && ryktetGar.turnKind === "drawing" ? (
          <Button onClick={sendDrawing} disabled={busy || !hasSketch}>
            {t("submit")}
          </Button>
        ) : null}
        {!waiting && ryktetGar.turnKind === "guessing" ? (
          <Button onClick={sendGuess} disabled={busy || !guess.trim()}>
            {t("submit")}
          </Button>
        ) : null}
        {isHost ? <StopGameButton onStop={onEnd} /> : null}
      </div>
    </Shell>
  );
}

function RevealView({
  ryktetGar,
  isHost,
  error,
  onNext,
  onEnd,
}: {
  ryktetGar: RyktetGarState;
  isHost: boolean;
  error: string | null;
  onNext: () => void;
  onEnd: () => void;
}) {
  const t = useT();
  const owner = ryktetGar.revealOwner;
  const entries = ryktetGar.revealEntries ?? [];
  const last = entries[entries.length - 1];

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Pill>{t("modeRyktet")}</Pill>
        <span className="text-xs font-semibold tabular-nums text-[var(--color-muted)]">
          {t(
            "ryktetPad",
            ryktetGar.revealPadIndex + 1,
            ryktetGar.revealPadCount
          )}
        </span>
      </div>

      <ErrorBanner message={error} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
        {owner ? (
          <div className="flex items-center gap-2">
            <Avatar name={owner.name} src={owner.avatar} size="md" />
            <div>
              <p className="text-xs text-[var(--color-muted)]">
                {t("ryktetBook")}
              </p>
              <p className="font-semibold">{owner.name}</p>
            </div>
          </div>
        ) : null}

        {entries.map((entry, index) => (
          <RevealEntry
            key={`${entry.kind}-${index}`}
            entry={entry}
            highlight={entry === last}
          />
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-2 pt-2">
        {isHost ? (
          <>
            <Button onClick={onNext}>{t("next")}</Button>
            <StopGameButton onStop={onEnd} />
          </>
        ) : (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            {t("hostRunningRyktet")}
          </p>
        )}
      </div>
    </Shell>
  );
}

function RevealEntry({
  entry,
  highlight,
}: {
  entry: RyktetGarEntry;
  highlight: boolean;
}) {
  const t = useT();
  const label =
    entry.kind === "prompt"
      ? t("ryktetOriginal")
      : entry.kind === "drawing"
        ? `${entry.authorName} ${t("ryktetDrew")}`
        : `${entry.authorName} ${t("ryktetGuessed")}`;

  return (
    <Card
      className={`p-3 ${highlight ? "border-[var(--color-rumor)]/50 animate-card-in" : ""}`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-rumor)]">
        {label}
      </p>
      {entry.kind === "drawing" && entry.image ? (
        <img src={entry.image} alt="" className="w-full rounded-2xl bg-white" />
      ) : (
        <p className="font-display text-xl font-semibold leading-snug">
          {entry.text}
        </p>
      )}
    </Card>
  );
}
