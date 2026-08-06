import type { ReactNode } from "react";

/** Render text with known player names tinted in the accent color. */
export function highlightNames(
  text: string,
  names: string[],
  options?: { letter?: string; letterClassName?: string }
): ReactNode {
  const unique = [
    ...new Set(names.map((n) => n.trim()).filter(Boolean)),
  ].sort((a, b) => b.length - a.length);

  const letter = options?.letter?.trim();
  const letterClass =
    options?.letterClassName ??
    "font-extrabold text-[var(--color-category)]";

  if (unique.length === 0 && !letter) return text;

  const parts: string[] = [];
  const kinds: ("text" | "name" | "letter")[] = [];

  const patterns: { re: RegExp; kind: "name" | "letter"; value: string }[] =
    [];
  for (const n of unique) {
    patterns.push({
      re: new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      kind: "name",
      value: n,
    });
  }
  if (letter) {
    const esc = letter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push({
      re: new RegExp(`\\b${esc}\\b`, "g"),
      kind: "letter",
      value: letter,
    });
  }

  // Find all matches, prefer longer name matches over letter when overlapping
  type Hit = { start: number; end: number; kind: "name" | "letter"; value: string };
  const hits: Hit[] = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        kind: p.kind,
        value: m[0],
      });
      if (m[0].length === 0) p.re.lastIndex++;
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));

  const chosen: Hit[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    chosen.push(hit);
    cursor = hit.end;
  }

  cursor = 0;
  for (const hit of chosen) {
    if (hit.start > cursor) {
      parts.push(text.slice(cursor, hit.start));
      kinds.push("text");
    }
    parts.push(hit.value);
    kinds.push(hit.kind);
    cursor = hit.end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
    kinds.push("text");
  }

  if (parts.length === 0) return text;

  return parts.map((part, i) => {
    if (kinds[i] === "name") {
      return (
        <span key={i} className="text-[var(--color-accent)]">
          {part}
        </span>
      );
    }
    if (kinds[i] === "letter") {
      return (
        <span key={i} className={letterClass}>
          {part}
        </span>
      );
    }
    return part;
  });
}
