import type { PlayMode, RoomPublicState } from "@shared/types";
import { Avatar } from "../components/Avatar";
import { BrandMark, Button, Card, ErrorBanner, Shell } from "../components/ui";

interface Props {
  room: RoomPublicState;
  isHost: boolean;
  error: string | null;
  onStart: () => void;
  onSetPlayMode: (playMode: PlayMode) => void;
  onLeave: () => void;
}

export function Lobby({
  room,
  isHost,
  error,
  onStart,
  onSetPlayMode,
  onLeave,
}: Props) {
  const ready = room.players.length >= room.minPlayers;
  const isSpicy = room.playMode === "spicy";
  const isVoteoff = room.playMode === "voteoff";
  const modeLogo = isSpicy
    ? "/spicy-stakes.png?v=3"
    : isVoteoff
      ? "/voteoff.png?v=1"
      : "/tea-time.png?v=2";
  const modeLabel = isSpicy
    ? "Spicy Stakes"
    : isVoteoff
      ? "Voteoff"
      : "Tea Time";

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 justify-center">
          <BrandMark small />
        </div>

        <div className="shrink-0 px-1 text-center">
          {isHost ? (
            <div className="grid grid-cols-3 gap-1.5">
              <ModeOption
                src="/tea-time.png?v=2"
                label="Tea Time"
                selected={room.playMode === "bakRyggen"}
                accent="var(--color-tea)"
                onClick={() => onSetPlayMode("bakRyggen")}
              />
              <ModeOption
                src="/spicy-stakes.png?v=3"
                label="Spicy Stakes"
                selected={isSpicy}
                accent="var(--color-accent)"
                onClick={() => onSetPlayMode("spicy")}
              />
              <ModeOption
                src="/voteoff.png?v=1"
                label="Voteoff"
                selected={isVoteoff}
                accent="var(--color-category)"
                onClick={() => onSetPlayMode("voteoff")}
              />
            </div>
          ) : (
            <img
              src={modeLogo}
              alt={modeLabel}
              className="mx-auto h-auto max-h-24 w-full max-w-[180px] object-contain"
            />
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center rounded-[1.5rem] border-2 border-[var(--color-accent)]/70 bg-[var(--color-surface)] px-3 py-4 text-center shadow-[0_12px_28px_rgba(255,92,106,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--color-accent)]">
            PIN
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {[...room.pin].map((digit, i) => (
              <div
                key={`${digit}-${i}`}
                className="flex h-14 w-11 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/70 sm:h-16 sm:w-12"
              >
                <span className="font-display text-[2.5rem] font-extrabold leading-none tabular-nums text-[var(--color-ink)] sm:text-[2.75rem]">
                  {digit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ErrorBanner message={error} />

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden !p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <p className="text-sm font-medium text-[var(--color-muted)]">
              In the lobby
            </p>
            <p className="text-sm text-[var(--color-ink)]">
              {room.players.length} / {room.maxPlayers}
            </p>
          </div>
          <ul className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto overscroll-contain">
            {room.players.map((p) => (
              <li
                key={p.id}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-[var(--color-surface-2)] px-1.5 py-2"
              >
                <div className="relative">
                  <Avatar name={p.name} src={p.avatar} size="lg" />
                  {p.isHost ? (
                    <img
                      src="/host-crown.png?v=2"
                      alt="Host"
                      title="Host"
                      className="absolute -right-2 -top-2 h-9 w-9 object-contain drop-shadow-md"
                    />
                  ) : null}
                </div>
                <span className="w-full truncate text-center text-xs font-medium leading-tight">
                  {p.name}
                </span>
              </li>
            ))}
          </ul>
          {!ready ? (
            <p className="mt-2 shrink-0 text-xs text-[var(--color-muted)]">
              Need at least {room.minPlayers} players to start.
            </p>
          ) : null}
        </Card>

        <div className="flex shrink-0 flex-col gap-2">
          {isHost ? (
            <Button
              variant={isSpicy || isVoteoff ? "spicy" : "secondary"}
              disabled={!ready}
              onClick={onStart}
              className={
                isSpicy || isVoteoff ? "" : "border-[var(--color-tea)]/50"
              }
            >
              Start game
            </Button>
          ) : (
            <p className="py-1 text-center text-sm text-[var(--color-muted)]">
              Waiting for the host to start…
            </p>
          )}
          <Button
            variant="ghost"
            className="!min-h-10 py-2 text-sm"
            onClick={onLeave}
          >
            Leave room
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function ModeOption({
  src,
  label,
  selected,
  accent,
  onClick,
}: {
  src: string;
  label: string;
  selected: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border-2 px-1.5 py-2 transition ${
        selected
          ? "bg-[var(--color-surface)] opacity-100"
          : "border-transparent bg-[var(--color-surface-2)] opacity-70 hover:opacity-100"
      }`}
      style={selected ? { borderColor: accent } : undefined}
    >
      <img
        src={src}
        alt={label}
        className="mx-auto h-auto max-h-12 w-full max-w-[90px] object-contain"
      />
      <span
        className={`mt-1 block text-[0.7rem] font-semibold ${
          selected ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
