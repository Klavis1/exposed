import { LanguageToggle } from "../components/LanguageToggle";
import { BrandMark, Button, Shell } from "../components/ui";
import { useI18n } from "../i18n/LocaleContext";

export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const { locale, setPrefLocale, t } = useI18n();

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 animate-fade-up">
        <div className="flex justify-end">
          <LanguageToggle locale={locale} onChange={setPrefLocale} />
        </div>
        <div className="space-y-3">
          <BrandMark />
          <div className="space-y-1.5 text-[var(--color-muted)]">
            <p className="whitespace-nowrap text-center text-sm leading-snug">
              {t("tagline")}
            </p>
            <p className="text-center text-sm leading-snug">
              {t("ageSubtitle")}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface)]/80 p-4">
          <p className="font-display text-xl font-bold">18+</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            {t("ageBlurb")}
          </p>
        </div>

        <Button onClick={onConfirm}>{t("ageConfirm")}</Button>
      </div>
    </Shell>
  );
}
