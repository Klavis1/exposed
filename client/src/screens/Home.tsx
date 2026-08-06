import { useState, type CSSProperties } from "react";
import type { Locale, PlayMode } from "@shared/types";
import { AvatarPicker } from "../components/AvatarPicker";
import { LanguageToggle } from "../components/LanguageToggle";
import {
  BrandMark,
  Button,
  ErrorBanner,
  Field,
  PinInput,
  Shell,
} from "../components/ui";
import { useI18n } from "../i18n/LocaleContext";

interface Props {
  busy: boolean;
  error: string | null;
  connected: boolean;
  onCreate: (
    name: string,
    playMode: PlayMode,
    avatar?: string,
    locale?: Locale
  ) => void;
  onJoin: (pin: string, name: string, avatar?: string) => void;
  onError: (message: string | null) => void;
}

function ModePickButton({
  src,
  label,
  accent,
  onPick,
}: {
  src: string;
  label: string;
  accent: string;
  onPick: () => void;
}) {
  const [clicked, setClicked] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={clicked}
      className={`mode-pick${clicked ? " mode-pick--clicked" : ""}`}
      style={{ "--mode-pick-accent": accent } as CSSProperties}
      onClick={() => {
        if (clicked) return;
        setClicked(true);
        window.setTimeout(onPick, 360);
      }}
    >
      <img src={src} alt={label} />
    </button>
  );
}

export function Home({
  busy,
  error,
  connected,
  onCreate,
  onJoin,
  onError,
}: Props) {
  const { locale, setPrefLocale, t } = useI18n();
  const [step, setStep] = useState<"choose" | "pickMode" | "create" | "join">(
    "choose"
  );
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>();

  const resetForm = () => {
    setStep("choose");
    setPlayMode(null);
    setAvatar(undefined);
    onError(null);
  };

  const modeLabel =
    playMode === "spicy"
      ? t("modeSpicy")
      : playMode === "voteoff"
        ? t("modeVoteoff")
        : t("modeTea");

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto overscroll-contain py-1">
        <div className="shrink-0 space-y-3 animate-fade-up">
          <div className="flex justify-end">
            <LanguageToggle locale={locale} onChange={setPrefLocale} />
          </div>
          <BrandMark />
          <p className="whitespace-nowrap text-center text-sm leading-snug text-[var(--color-muted)]">
            {t("tagline")}
          </p>
          {!connected ? (
            <p className="text-xs text-[var(--color-accent-2)]">
              {t("connecting")}
            </p>
          ) : null}
        </div>

        <ErrorBanner message={error} />

        {step === "choose" ? (
          <div className="flex flex-col gap-3 animate-fade-up">
            <Button
              onClick={() => setStep("join")}
              className="min-h-[4.5rem] text-2xl font-bold tracking-wide shadow-[0_14px_36px_rgba(255,92,106,0.38)]"
            >
              {t("join")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setStep("pickMode")}
              className="min-h-11 text-sm opacity-90"
            >
              {t("createGame")}
            </Button>
          </div>
        ) : null}

        {step === "pickMode" ? (
          <div className="flex flex-col gap-4 animate-fade-up">
            <p className="text-sm font-medium text-[var(--color-muted)]">
              {t("chooseMode")}
            </p>
            <ModePickButton
              src="/spicy-stakes.png?v=3"
              label={t("modeSpicy")}
              accent="var(--color-accent)"
              onPick={() => {
                setPlayMode("spicy");
                setStep("create");
                onError(null);
              }}
            />
            <ModePickButton
              src="/tea-time.png?v=2"
              label={t("modeTea")}
              accent="var(--color-tea)"
              onPick={() => {
                setPlayMode("bakRyggen");
                setStep("create");
                onError(null);
              }}
            />
            <ModePickButton
              src="/voteoff.png?v=1"
              label={t("modeVoteoff")}
              accent="var(--color-category)"
              onPick={() => {
                setPlayMode("voteoff");
                setStep("create");
                onError(null);
              }}
            />
            <Button type="button" variant="ghost" onClick={resetForm}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "create" && playMode ? (
          <form
            className="flex flex-col gap-5 animate-fade-up"
            onSubmit={(e) => {
              e.preventDefault();
              onCreate(name, playMode, avatar, locale);
            }}
          >
            <p className="text-sm text-[var(--color-muted)]">
              {t("mode")}:{" "}
              <span className="font-semibold text-[var(--color-ink)]">
                {modeLabel}
              </span>
              {" · "}
              <span className="font-semibold uppercase text-[var(--color-ink)]">
                {locale}
              </span>
            </p>
            <AvatarPicker
              name={name}
              value={avatar}
              onChange={(v) => {
                onError(null);
                setAvatar(v);
              }}
              onError={onError}
            />
            <Field
              label={t("yourNickname")}
              value={name}
              maxLength={20}
              placeholder=""
              autoFocus
              onChange={(e) =>
                setName(
                  e.target.value.replace(/[^\p{L}\s]/gu, "").slice(0, 20)
                )
              }
            />
            <Button type="submit" disabled={busy || !name.trim() || !connected}>
              {busy ? t("creating") : t("createRoom")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("pickMode");
                onError(null);
              }}
            >
              {t("back")}
            </Button>
          </form>
        ) : null}

        {step === "join" ? (
          <form
            className="flex flex-col gap-5 animate-fade-up"
            onSubmit={(e) => {
              e.preventDefault();
              onJoin(pin, name, avatar);
            }}
          >
            <PinInput value={pin} onChange={setPin} autoFocus />
            <AvatarPicker
              name={name}
              value={avatar}
              onChange={(v) => {
                onError(null);
                setAvatar(v);
              }}
              onError={onError}
            />
            <Field
              label={t("yourNickname")}
              value={name}
              maxLength={20}
              placeholder=""
              onChange={(e) =>
                setName(
                  e.target.value.replace(/[^\p{L}\s]/gu, "").slice(0, 20)
                )
              }
            />
            <Button
              type="submit"
              disabled={busy || !name.trim() || pin.length < 4 || !connected}
            >
              {busy ? t("joining") : t("join")}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              {t("back")}
            </Button>
          </form>
        ) : null}
      </div>
    </Shell>
  );
}
