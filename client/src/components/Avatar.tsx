export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dims =
    size === "sm"
      ? "h-9 w-9 rounded-lg text-xs"
      : size === "xl"
        ? "h-28 w-28 rounded-3xl text-3xl"
        : size === "lg"
          ? "h-20 w-20 rounded-2xl text-2xl"
          : "h-11 w-11 rounded-xl text-sm";
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dims} shrink-0 object-cover ring-2 ring-[var(--color-line)]`}
      />
    );
  }

  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center bg-gradient-to-br from-[var(--color-accent)]/80 to-[var(--color-gossip)]/80 font-display font-bold text-white ring-2 ring-[var(--color-line)]`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
