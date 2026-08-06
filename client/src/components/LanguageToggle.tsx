import type { Locale } from "@shared/types";
import { useT } from "../i18n/LocaleContext";

interface Props {
  locale: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

export function LanguageToggle({ locale, onChange, className = "" }: Props) {
  const t = useT();
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/80 p-0.5 ${className}`}
      role="group"
      aria-label={t("language")}
    >
      {(["en", "no"] as const).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(code)}
            className={`min-w-[2.75rem] rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition ${
              active
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
