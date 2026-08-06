import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Locale } from "@shared/types";
import { saveLocalePref, t, useLocale, type UiKey } from "./index";

interface LocaleContextValue {
  locale: Locale;
  setPrefLocale: (locale: Locale) => void;
  t: (key: UiKey, ...args: number[]) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  roomLocale,
  children,
}: {
  roomLocale?: Locale | null;
  children: ReactNode;
}) {
  const { locale, setPrefLocale } = useLocale(roomLocale);
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setPrefLocale,
      t: (key, ...args) => t(locale, key, ...args),
    }),
    [locale, setPrefLocale]
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback for components mounted outside provider (shouldn't happen)
    const locale = "en" as Locale;
    return {
      locale,
      setPrefLocale: saveLocalePref,
      t: (key: UiKey, ...args: number[]) => t(locale, key, ...args),
    };
  }
  return ctx;
}

/** Translate using the active locale from LocaleProvider. */
export function useT() {
  return useI18n().t;
}
