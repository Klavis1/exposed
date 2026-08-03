import { useEffect, useState } from "react";
import type { SpicyKind, SpicyState } from "@shared/types";
import { Avatar } from "../components/Avatar";
import {
  Button,
  Card,
  ErrorBanner,
  Pill,
  Shell,
  StopGameButton,
} from "../components/ui";
import { highlightNames } from "../lib/highlightNames";

interface Props {
  spicy: SpicyState;
  playerNames: string[];
  isHost: boolean;
  error: string | null;
  onNext: () => void;
  onEnd: () => void;
}

const KIND_META: Record<
  Exclude<SpicyKind, "oneShot"> | "challenge",
  { label: string; accent: string; tint: string }
> = {
  challenge: {
    label: "Challenge",
    accent: "var(--color-accent)",
    tint: "rgba(255, 92, 106, 0.1)",
  },
  category: {
    label: "Category",
    accent: "var(--color-category)",
    tint: "rgba(240, 193, 75, 0.1)",
  },
  rule: {
    label: "New Rule",
    accent: "var(--color-rule)",
    tint: "rgba(125, 211, 192, 0.1)",
  },
  repeal: {
    label: "Rule cancelled",
    accent: "var(--color-muted)",
    tint: "rgba(154, 144, 136, 0.08)",
  },
};

function metaFor(kind: SpicyKind | undefined) {
  if (kind === "category") return KIND_META.category;
  if (kind === "rule") return KIND_META.rule;
  if (kind === "repeal") return KIND_META.repeal;
  return KIND_META.challenge;
}

export function Spicy({
  spicy,
  playerNames,
  isHost,
  error,
  onNext,
  onEnd,
}: Props) {
  const finished = spicy.phase === "finished";
  const [cardPulse, setCardPulse] = useState(0);

  useEffect(() => {
    setCardPulse((n) => n + 1);
  }, [spicy.challenge?.id, spicy.phase]);

  const meta = metaFor(spicy.challenge?.kind);

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between">
        <Pill>Spicy Stakes</Pill>
        {!finished &&
        spicy.challenge?.kind !== "rule" &&
        spicy.challenge?.kind !== "repeal" ? (
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: meta.accent }}
          >
            {meta.label}
          </p>
        ) : null}
      </div>

      {spicy.activeRules.length > 0 ? (
        <div
          className="max-h-28 shrink-0 overflow-y-auto rounded-2xl border border-[var(--color-line)] px-3 py-2"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: "var(--color-rule)",
            background: `linear-gradient(90deg, ${KIND_META.rule.tint}, var(--color-surface-2) 40%)`,
          }}
        >
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-rule)" }}
          >
            Active rules
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {spicy.activeRules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2">
                {rule.targetNames.length > 0 ? (
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    {rule.targetNames.map((name, i) => (
                      <Avatar
                        key={`${rule.targetIds[i]}-${name}`}
                        name={name}
                        src={rule.targetAvatars?.[i]}
                        size="sm"
                      />
                    ))}
                  </div>
                ) : null}
                <p className="min-w-0 text-xs leading-snug text-[var(--color-ink)]">
                  {highlightNames(rule.text, playerNames)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ErrorBanner message={error} />

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        {finished ? (
          <h1 className="text-center font-display text-2xl font-bold tracking-tight">
            Round over
          </h1>
        ) : null}
        {!finished && spicy.challenge?.kind === "rule" ? (
          <p
            className="shrink-0 text-center font-display text-3xl font-extrabold uppercase tracking-[0.12em]"
            style={{ color: meta.accent }}
          >
            New Rule
          </p>
        ) : null}
        {!finished && spicy.challenge?.kind === "repeal" ? (
          <p className="shrink-0 text-center font-display text-3xl font-extrabold uppercase tracking-[0.12em] text-[var(--color-accent)]">
            Rule Over
          </p>
        ) : null}

        <Card
          key={cardPulse}
          className="animate-bubble-swap flex w-full shrink-0 flex-col overflow-hidden !border-[var(--color-line)] !p-0"
          style={
            finished
              ? undefined
              : {
                  borderLeftWidth: 4,
                  borderLeftColor: meta.accent,
                  background: `linear-gradient(105deg, ${meta.tint} 0%, var(--color-surface) 42%)`,
                }
          }
        >
          <div className="shrink-0 px-4 py-2.5">
            <p className="line-clamp-3 font-display text-base font-semibold leading-snug text-[var(--color-ink)] sm:text-lg">
              {finished
                ? "That's the end of this Spicy round."
                : highlightNames(
                    spicy.challenge?.text ?? "Loading…",
                    playerNames
                  )}
            </p>
          </div>
          {!finished && spicy.targetNames.length > 0 ? (
            <div
              className="grid w-full shrink-0 border-t border-[var(--color-line)]"
              style={{
                aspectRatio: "1 / 1",
                gridTemplateColumns: `repeat(${spicy.targetNames.length}, minmax(0, 1fr))`,
              }}
            >
              {spicy.targetNames.map((name, i) => {
                const src = spicy.targetAvatars?.[i];
                const initial = (name.trim()[0] ?? "?").toUpperCase();
                return (
                  <div
                    key={`${spicy.targetIds[i]}-${name}`}
                    className="relative min-h-0 min-w-0 overflow-hidden bg-gradient-to-br from-[var(--color-accent)]/80 to-[var(--color-gossip)]/80"
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-bold text-white sm:text-5xl">
                        {initial}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        {isHost ? (
          <>
            {!finished ? (
              <Button variant="spicy" onClick={onNext}>
                Next
              </Button>
            ) : null}
            <StopGameButton onStop={onEnd} />
          </>
        ) : (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            {finished
              ? "Waiting for the host…"
              : "Host is running the challenges…"}
          </p>
        )}
      </div>
    </Shell>
  );
}
