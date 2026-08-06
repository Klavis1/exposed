export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const dims =
    size === "xs"
      ? "h-7 w-7 rounded-md text-[0.65rem] ring-1"
      : size === "sm"
        ? "h-9 w-9 rounded-lg text-xs"
        : size === "xl"
          ? "h-28 w-28 rounded-3xl text-3xl"
          : size === "lg"
            ? "h-20 w-20 rounded-2xl text-2xl"
            : "h-11 w-11 rounded-xl text-sm";
  const ring =
    size === "xs" ? "ring-[var(--color-line)]" : "ring-2 ring-[var(--color-line)]";
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dims} ${ring} shrink-0 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${dims} ${ring} flex shrink-0 items-center justify-center bg-gradient-to-br from-[var(--color-accent)]/80 to-[var(--color-gossip)]/80 font-display font-bold text-white`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
