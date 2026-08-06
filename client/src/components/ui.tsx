import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

export function Shell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "w-full max-w-[11rem]" : "w-full"}>
      <img
        src="/cabin-chaos-logo.png"
        alt="Cabin Chaos"
        className={
          small
            ? "mx-auto h-auto w-full object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            : "mx-auto h-auto w-full max-w-[22rem] object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.5)]"
        }
      />
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "spicy" | "danger";
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-[var(--color-accent)] text-white shadow-[0_10px_28px_rgba(255,92,106,0.28)] hover:brightness-110",
    secondary:
      "bg-[var(--color-surface-2)] text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-[#2c2428]",
    ghost: "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]",
    spicy:
      "bg-[var(--color-accent)] text-white shadow-[0_10px_28px_rgba(255,92,106,0.32)] hover:brightness-110",
    danger: "bg-[#3a1a22] text-[#ff8a9a] border border-[#5a2a35]",
  };

  return (
    <button
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-[var(--color-muted)]">
      <span>{label}</span>
      <input
        className="min-h-12 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-ink)] outline-none placeholder:text-[#6d6270] focus:border-[var(--color-accent)]"
        {...props}
      />
    </label>
  );
}

/** 4-digit PIN entry matching the lobby PIN frames. */
export function PinInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (pin: string) => void;
  autoFocus?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 4 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (!autoFocus) return;
    inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const writePin = (nextDigits: string[]) => {
    onChange(nextDigits.join("").replace(/\D/g, "").slice(0, 4));
  };

  const focusAt = (index: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(3, index))];
    el?.focus();
    el?.select();
  };

  const onDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      writePin(next);
      return;
    }
    const next = [...digits];
    next[index] = cleaned.slice(-1);
    writePin(next);
    if (index < 3) focusAt(index + 1);
  };

  const applyPaste = (index: number, text: string) => {
    const chars = text.replace(/\D/g, "").slice(0, 4).split("");
    if (!chars.length) return;
    const next = [...digits];
    chars.forEach((ch, offset) => {
      if (index + offset < 4) next[index + offset] = ch;
    });
    writePin(next);
    focusAt(Math.min(3, index + chars.length - 1));
  };

  const onKeyDown = (
    index: number,
    e: ReactKeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      writePin(next);
      focusAt(index - 1);
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  return (
    <div className="relative w-full rounded-[1.5rem] border-2 border-[var(--color-accent)]/70 bg-[var(--color-surface)] px-3 pb-4 pt-5 shadow-[0_12px_28px_rgba(255,92,106,0.12)]">
      <p className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-surface)] px-3 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--color-accent)]">
        PIN
      </p>
      <div className="flex items-center justify-center gap-2 sm:gap-2.5">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`PIN digit ${i + 1}`}
            value={digit}
            onChange={(e) => onDigitChange(i, e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              applyPaste(i, e.clipboardData.getData("text"));
            }}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className="h-14 w-11 shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/70 text-center font-display text-[2.5rem] font-extrabold leading-none tabular-nums text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] sm:h-16 sm:w-12 sm:text-[2.75rem]"
          />
        ))}
      </div>
    </div>
  );
}

export function TextArea({
  label,
  hint,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-[var(--color-muted)]">
      <span className="font-semibold text-[var(--color-ink)]">{label}</span>
      <textarea
        className={`min-h-28 resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-base text-[var(--color-ink)] outline-none placeholder:text-[#6d6270] focus:border-[var(--color-tea)] ${className}`}
        {...props}
      />
      {hint ? <span className="text-xs text-[#6d6270]">{hint}</span> : null}
    </label>
  );
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)]/90 p-5 backdrop-blur ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="animate-fade-up rounded-2xl border border-[#5a2a35] bg-[#2a141a] px-4 py-3 text-sm text-[#ffb0bb]">
      {message}
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
      {children}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="absolute inset-0 bg-[#0a090b]/75"
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-sm rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          {message}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Host control: confirm before returning everyone to the lobby. */
export function StopGameButton({ onStop }: { onStop: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        className="!min-h-10 py-2 text-sm"
        onClick={() => setOpen(true)}
      >
        Stop game
      </Button>
      <ConfirmDialog
        open={open}
        title="Stop the game?"
        message="Everyone will return to the lobby. Progress in this round will be lost."
        confirmLabel="Yes, stop"
        cancelLabel="No, keep playing"
        onConfirm={() => {
          setOpen(false);
          onStop();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
