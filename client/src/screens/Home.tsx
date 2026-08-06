import { useState, type CSSProperties } from "react";
import type { PlayMode } from "@shared/types";
import { AvatarPicker } from "../components/AvatarPicker";
import { BrandMark, Button, ErrorBanner, Field, Shell } from "../components/ui";

interface Props {
  busy: boolean;
  error: string | null;
  connected: boolean;
  onCreate: (name: string, playMode: PlayMode, avatar?: string) => void;
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

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto overscroll-contain py-1">
        <div className="shrink-0 space-y-3 animate-fade-up">
          <BrandMark />
          <p className="max-w-[20rem] text-base leading-snug text-[var(--color-muted)]">
            What happens at the cabin, stays at the cabin.
          </p>
          {!connected ? (
            <p className="text-xs text-[var(--color-accent-2)]">Connecting…</p>
          ) : null}
        </div>

        <ErrorBanner message={error} />

        {step === "choose" ? (
          <div className="flex flex-col gap-3 animate-fade-up">
            <Button
              onClick={() => setStep("join")}
              className="min-h-[4.5rem] text-2xl font-bold tracking-wide shadow-[0_14px_36px_rgba(255,92,106,0.38)]"
            >
              Join
            </Button>
            <Button
              variant="secondary"
              onClick={() => setStep("pickMode")}
              className="min-h-11 text-sm opacity-90"
            >
              Create game
            </Button>
          </div>
        ) : null}

        {step === "pickMode" ? (
          <div className="flex flex-col gap-4 animate-fade-up">
            <p className="text-sm font-medium text-[var(--color-muted)]">
              Choose a game mode
            </p>
            <ModePickButton
              src="/spicy-stakes.png?v=3"
              label="Spicy Stakes"
              accent="var(--color-accent)"
              onPick={() => {
                setPlayMode("spicy");
                setStep("create");
                onError(null);
              }}
            />
            <ModePickButton
              src="/tea-time.png?v=2"
              label="Tea Time"
              accent="var(--color-tea)"
              onPick={() => {
                setPlayMode("bakRyggen");
                setStep("create");
                onError(null);
              }}
            />
            <ModePickButton
              src="/voteoff.png?v=1"
              label="Voteoff"
              accent="var(--color-category)"
              onPick={() => {
                setPlayMode("voteoff");
                setStep("create");
                onError(null);
              }}
            />
            <Button type="button" variant="ghost" onClick={resetForm}>
              Back
            </Button>
          </div>
        ) : null}

        {step === "create" && playMode ? (
          <form
            className="flex flex-col gap-5 animate-fade-up"
            onSubmit={(e) => {
              e.preventDefault();
              onCreate(name, playMode, avatar);
            }}
          >
            <p className="text-sm text-[var(--color-muted)]">
              Mode:{" "}
              <span className="font-semibold text-[var(--color-ink)]">
                {playMode === "spicy"
                  ? "Spicy Stakes"
                  : playMode === "voteoff"
                    ? "Voteoff"
                    : "Tea Time"}
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
              label="Your nickname"
              value={name}
              maxLength={20}
              placeholder="e.g. Kasper"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={busy || !name.trim() || !connected}>
              {busy ? "Creating…" : "Create room"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep("pickMode");
                onError(null);
              }}
            >
              Back
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
            <Field
              label="PIN"
              value={pin}
              inputMode="numeric"
              maxLength={4}
              placeholder="4 digits"
              autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
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
              label="Your nickname"
              value={name}
              maxLength={20}
              placeholder="e.g. Nora"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-center text-xs text-[var(--color-muted)]">
              You can join even if the game already started.
            </p>
            <Button
              type="submit"
              disabled={busy || !name.trim() || pin.length < 4 || !connected}
            >
              {busy ? "Joining…" : "Join"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Back
            </Button>
          </form>
        ) : null}
      </div>
    </Shell>
  );
}
