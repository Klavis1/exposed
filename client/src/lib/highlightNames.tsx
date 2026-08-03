import type { ReactNode } from "react";

/** Render text with known player names tinted in the accent color. */
export function highlightNames(text: string, names: string[]): ReactNode {
  const unique = [
    ...new Set(names.map((n) => n.trim()).filter(Boolean)),
  ].sort((a, b) => b.length - a.length);

  if (unique.length === 0) return text;

  const escaped = unique.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  const nameSet = new Set(unique);

  return parts.map((part, i) =>
    nameSet.has(part) ? (
      <span key={i} className="text-[var(--color-accent)]">
        {part}
      </span>
    ) : (
      part
    )
  );
}
