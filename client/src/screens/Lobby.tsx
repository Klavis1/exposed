import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import type { Locale, PlayMode, RoomPublicState } from "@shared/types";
import { Avatar } from "../components/Avatar";
import { LanguageToggle } from "../components/LanguageToggle";
import { BrandMark, Button, Card, ErrorBanner, Shell } from "../components/ui";
import { useT } from "../i18n/LocaleContext";

interface Props {
  room: RoomPublicState;
  isHost: boolean;
  error: string | null;
  onStart: () => void;
  onSetPlayMode: (playMode: PlayMode) => void;
  onSetLocale: (locale: Locale) => void;
  onLeave: () => void;
}

export function Lobby({
  room,
  isHost,
  error,
  onStart,
  onSetPlayMode,
  onSetLocale,
  onLeave,
}: Props) {
  const t = useT();
  const ready = room.players.length >= room.minPlayers;
  const isSpicy = room.playMode === "spicy";
  const isVoteoff = room.playMode === "voteoff";
  const modeLogo = isSpicy
    ? "/spicy-stakes.png?v=3"
    : isVoteoff
      ? "/voteoff.png?v=1"
      : "/tea-time.png?v=2";
  const modeLabel = isSpicy
    ? t("modeSpicy")
    : isVoteoff
      ? t("modeVoteoff")
      : t("modeTea");

  const [qrOpen, setQrOpen] = useState(false);
  const joinUrl = useMemo(
    () => `${window.location.origin}/?pin=${encodeURIComponent(room.pin)}`,
    [room.pin]
  );

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1" />
            <BrandMark small />
            <div className="flex flex-1 justify-end">
              {isHost ? (
                <LanguageToggle locale={room.locale} onChange={onSetLocale} />
              ) : (
                <span className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)]/80 px-2.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  {room.locale}
                </span>
              )}
            </div>
          </div>

          <div className="px-1 text-center">
            {isHost ? (
              <div className="grid grid-cols-3 gap-1.5">
                <ModeOption
                  src="/tea-time.png?v=2"
                  label={t("modeTea")}
                  selected={room.playMode === "bakRyggen"}
                  accent="var(--color-tea)"
                  onClick={() => onSetPlayMode("bakRyggen")}
                />
                <ModeOption
                  src="/spicy-stakes.png?v=3"
                  label={t("modeSpicy")}
                  selected={isSpicy}
                  accent="var(--color-accent)"
                  onClick={() => onSetPlayMode("spicy")}
                />
                <ModeOption
                  src="/voteoff.png?v=1"
                  label={t("modeVoteoff")}
                  selected={isVoteoff}
                  accent="var(--color-category)"
                  onClick={() => onSetPlayMode("voteoff")}
                />
              </div>
            ) : (
              <img
                src={modeLogo}
                alt={modeLabel}
                className="mx-auto h-auto max-h-16 w-full max-w-[140px] object-contain"
              />
            )}
          </div>

          <div className="relative w-full rounded-[1.5rem] border-2 border-[var(--color-accent)]/70 bg-[var(--color-surface)] px-3 pb-3 pt-5 text-center shadow-[0_12px_28px_rgba(255,92,106,0.12)]">
            <p className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-surface)] px-3 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--color-accent)]">
              PIN
            </p>
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {[...room.pin].map((digit, i) => (
                <div
                  key={`${digit}-${i}`}
                  className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/70 sm:h-16 sm:w-12"
                >
                  <span className="font-display text-[2.15rem] font-extrabold leading-none tabular-nums text-[var(--color-ink)] sm:text-[2.75rem]">
                    {digit}
                  </span>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 !min-h-11 text-sm"
              onClick={() => setQrOpen(true)}
            >
              {t("showQr")}
            </Button>
          </div>

          <ErrorBanner message={error} />

          <Card className="!p-3">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-muted)]">
                {t("inLobby")}
              </p>
              <p className="text-sm text-[var(--color-ink)]">
                {room.players.length} / {room.maxPlayers}
              </p>
            </div>
            <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-3 sm:gap-2">
              {room.players.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col items-center gap-1 rounded-xl bg-[var(--color-surface-2)] px-1 py-1.5 sm:gap-1.5 sm:px-1.5 sm:py-2"
                >
                  <div className="relative">
                    <Avatar name={p.name} src={p.avatar} size="md" />
                    {p.isHost ? (
                      <img
                        src="/host-crown.png?v=2"
                        alt={t("host")}
                        title={t("host")}
                        className="absolute -right-1.5 -top-1.5 h-6 w-6 object-contain drop-shadow-md sm:h-8 sm:w-8"
                      />
                    ) : null}
                  </div>
                  <span className="w-full truncate text-center text-[0.65rem] font-medium leading-tight sm:text-xs">
                    {p.name}
                  </span>
                </li>
              ))}
            </ul>
            {!ready ? (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {t("needPlayers", room.minPlayers)}
              </p>
            ) : null}
          </Card>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--color-line)]/60 pt-2">
          {isHost ? (
            <Button
              variant={isSpicy || isVoteoff ? "spicy" : "secondary"}
              disabled={!ready}
              onClick={onStart}
              className={
                isSpicy || isVoteoff ? "" : "border-[var(--color-tea)]/50"
              }
            >
              {t("startGame")}
            </Button>
          ) : (
            <p className="py-1 text-center text-sm text-[var(--color-muted)]">
              {t("waitingHostStart")}
            </p>
          )}
          <Button
            variant="ghost"
            className="!min-h-10 py-2 text-sm"
            onClick={onLeave}
          >
            {t("leaveRoom")}
          </Button>
        </div>
      </div>

      <QrJoinDialog
        open={qrOpen}
        joinUrl={joinUrl}
        onClose={() => setQrOpen(false)}
      />
    </Shell>
  );
}

function QrJoinDialog({
  open,
  joinUrl,
  onClose,
}: {
  open: boolean;
  joinUrl: string;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      role="presentation"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#0a090b]/75" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-sm rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-center font-display text-xl font-bold tracking-tight text-[var(--color-ink)]"
        >
          {t("scanToJoin")}
        </h2>
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-4 shadow-sm">
          <QRCodeSVG
            value={joinUrl}
            size={240}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0a090b"
            title={t("scanToJoin")}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-5"
          onClick={onClose}
        >
          {t("close")}
        </Button>
      </div>
    </div>,
    document.body
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
