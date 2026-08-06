import { BrandMark, Button, Shell } from "../components/ui";

export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 animate-fade-up">
        <div className="space-y-3">
          <BrandMark />
          <div className="space-y-1.5 text-[var(--color-muted)]">
            <p className="whitespace-nowrap text-center text-sm leading-snug">
              What happens at the cabin, stays at the cabin.
            </p>
            <p className="text-center text-sm leading-snug">
              Adult party games — Tea Time, Spicy Stakes, and Voteoff.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)]/80 p-4">
          <p className="font-display text-xl font-bold">18+</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            Cabin Chaos includes sexual themes, gossip, and challenges meant for
            adults. Everyone plays voluntarily — skip anything that feels wrong.
          </p>
        </div>

        <Button onClick={onConfirm}>I am 18 or older</Button>
      </div>
    </Shell>
  );
}
