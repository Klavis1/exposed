import { useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const CONFETTI_COLORS = [
  "#ff5c6a",
  "#f0c14b",
  "#7dd3c0",
  "#4aa3ff",
  "#ff9b6a",
  "#4ade9a",
  "#c084fc",
  "#ffffff",
];

export function ConfettiBurst({ burstKey }: { burstKey: string }) {
  const pieces = useMemo(() => {
    return Array.from({ length: 56 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 56 + (i % 5) * 0.12;
      const dist = 160 + (i % 7) * 52 + (i % 3) * 28;
      const cx = `${Math.cos(angle) * dist}px`;
      const cy = `${Math.sin(angle) * dist + 80 + (i % 5) * 55}px`;
      return {
        id: `${burstKey}-${i}`,
        style: {
          "--cx": cx,
          "--cy": cy,
          "--rot": `${(i % 2 === 0 ? 1 : -1) * (320 + (i % 8) * 55)}deg`,
          "--c": CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--w": `${5 + (i % 4)}px`,
          "--h": `${8 + (i % 5)}px`,
          "--dur": `${3.4 + (i % 8) * 0.18}s`,
          "--delay": `${(i % 12) * 0.035}s`,
        } as CSSProperties,
      };
    });
  }, [burstKey]);

  return createPortal(
    <div className="confetti-burst" aria-hidden>
      {pieces.map((p) => (
        <span key={p.id} className="confetti-piece" style={p.style} />
      ))}
    </div>,
    document.body
  );
}
