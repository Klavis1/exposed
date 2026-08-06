import { useRef, useState } from "react";
import { compressImage } from "../lib/avatar";
import { Avatar } from "./Avatar";

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
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        aria-label="Add photo"
      >
        <Avatar name={name || "?"} src={value} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 group-active:opacity-100">
          {value ? "Change" : "Add"}
        </span>
      </button>
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          className="text-[var(--color-accent-2)] underline-offset-2 hover:underline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? "Loading…" : value ? "Change photo" : "Add photo"}
        </button>
        {value ? (
          <button
            type="button"
            className="text-[var(--color-muted)] underline-offset-2 hover:underline"
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
