import { useRef, useState } from "react";
import { compressImage } from "../lib/avatar";
import { Avatar } from "./Avatar";
import { Button } from "./ui";

interface Props {
  name: string;
  value?: string;
  onChange: (avatar: string | undefined) => void;
  onError?: (message: string) => void;
}

export function AvatarPicker({ name, value, onChange, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        aria-label="Add photo"
      >
        <Avatar name={name || "?"} src={value} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 group-active:opacity-100">
          {value ? "Change" : "Add"}
        </span>
      </button>
      <div className="flex min-w-0 flex-col items-stretch gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="!min-h-11 w-auto px-4 text-sm shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
        >
          {loading ? "Loading…" : value ? "Change photo" : "Add photo"}
        </Button>
        {value ? (
          <button
            type="button"
            className="px-1 text-left text-xs text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-ink)] hover:underline"
            onClick={() => onChange(undefined)}
          >
            Remove
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setLoading(true);
          try {
            const dataUrl = await compressImage(file);
            onChange(dataUrl);
          } catch (err) {
            onError?.(err instanceof Error ? err.message : "Could not add photo.");
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
