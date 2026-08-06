import { useEffect, useMemo, useState } from "react";
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
import { useT } from "../i18n/LocaleContext";
import { highlightNames } from "../lib/highlightNames";

interface Props {
  spicy: SpicyState;
  playerNames: string[];
  isHost: boolean;
  error: string | null;
  onNext: () => void;
  onEnd: () => void;
}

function useKindMeta() {
  const t = useT();
  return useMemo(
    () =>
      ({
        challenge: {
          label: t("challenge"),
          accent: "var(--color-accent)",
          tint: "rgba(255, 92, 106, 0.1)",
        },
        category: {
          label: t("category"),
          accent: "var(--color-category)",
          tint: "rgba(240, 193, 75, 0.1)",
        },
        rule: {
          label: t("newRule"),
          accent: "var(--color-rule)",
          tint: "rgba(125, 211, 192, 0.1)",
        },
        repeal: {
          label: t("ruleCancelled"),
          accent: "var(--color-muted)",
          tint: "rgba(154, 144, 136, 0.08)",
        },
      }) as const,
    [t]
  );
}

function metaFor(
  kind: SpicyKind | undefined,
  meta: ReturnType<typeof useKindMeta>
) {
  if (kind === "category") return meta.category;
  if (kind === "rule") return meta.rule;
  if (kind === "repeal") return meta.repeal;
  return meta.challenge;
}

export function Spicy({
  spicy,
  playerNames,
  isHost,
  error,
  onNext,
  onEnd,
}: Props) {
  const t = useT();
  const KIND_META = useKindMeta();
  const finished = spicy.phase === "finished";
  const [cardPulse, setCardPulse] = useState(0);

  useEffect(() => {
    setCardPulse((n) => n + 1);
  }, [spicy.challenge?.id, spicy.phase]);

  const meta = metaFor(spicy.challenge?.kind, KIND_META);
  const kind = spicy.challenge?.kind;
  const framed = !finished && (kind === "rule" || kind === "category");
  const challengeText = (() => {
    const raw = spicy.challenge?.text ?? t("loading");
    if (kind === "category") {
      return raw.replace(/^(Category|Kategori):\s*/i, "");
    }
    return raw;
  })();

  return (
    <Shell>
      <div className="flex shrink-0 items-center justify-between">
        <Pill>{t("modeSpicy")}</Pill>
        {!finished &&
        kind !== "rule" &&
        kind !== "category" &&
        kind !== "repeal" ? (
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
            {t("activeRules")}
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
            {t("roundOver")}
          </h1>
        ) : null}
        {!finished && kind === "rule" ? (
          <p
            className="shrink-0 text-center font-display text-3xl font-extrabold uppercase tracking-[0.12em]"
            style={{ color: meta.accent }}
          >
            {t("newRule")}
          </p>
        ) : null}
        {!finished && kind === "category" ? (
          <p
            className="shrink-0 text-center font-display text-3xl font-extrabold uppercase tracking-[0.12em]"
            style={{ color: meta.accent }}
          >
            {t("category")}
          </p>
        ) : null}
        {!finished && kind === "repeal" ? (
          <p className="shrink-0 text-center font-display text-3xl font-extrabold uppercase tracking-[0.12em] text-[var(--color-accent)]">
            {t("ruleOver")}
          </p>
        ) : null}

        <Card
          key={cardPulse}
          className={`animate-bubble-swap flex w-full shrink-0 flex-col overflow-hidden !p-0 ${
            framed ? "!border-2" : "!border-[var(--color-line)]"
          }`}
          style={
            finished
              ? undefined
              : framed
                ? {
                    borderColor: meta.accent,
                    boxShadow:
                      kind === "category"
                        ? `0 0 0 1px ${meta.accent}, 0 12px 32px rgba(240, 193, 75, 0.22)`
                        : `0 0 0 1px ${meta.accent}, 0 12px 32px rgba(125, 211, 192, 0.18)`,
                    background: `linear-gradient(105deg, ${meta.tint} 0%, var(--color-surface) 42%)`,
                  }
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
                ? t("spicyEnd")
                : highlightNames(challengeText, playerNames, {
                    letter: kind === "category" ? spicy.letter : undefined,
                  })}
            </p>
          </div>
          {!finished && spicy.targetNames.length > 0 ? (
            <div
              className={`grid w-full shrink-0 gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)]/40 p-2.5 ${
                spicy.targetNames.length >= 3
                  ? "grid-cols-3"
                  : "grid-cols-2"
              }`}
            >
              {spicy.targetNames.map((name, i) => {
                const src = spicy.targetAvatars?.[i];
                const initial = (name.trim()[0] ?? "?").toUpperCase();
                const alone = spicy.targetNames.length === 1;
                return (
                  <div
                    key={`${spicy.targetIds[i]}-${name}`}
                    className={`relative aspect-square min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/80 to-[var(--color-gossip)]/80 shadow-[0_8px_20px_rgba(0,0,0,0.28)] ring-1 ring-[var(--color-line)] ${
                      alone ? "col-span-2 mx-auto w-[calc(50%-0.25rem)]" : ""
                    }`}
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
                {t("next")}
              </Button>
            ) : null}
            <StopGameButton onStop={onEnd} />
          </>
        ) : (
          <p className="py-2 text-center text-sm text-[var(--color-muted)]">
            {finished ? t("waitingHost") : t("hostRunningChallenges")}
          </p>
        )}
      </div>
    </Shell>
  );
}
