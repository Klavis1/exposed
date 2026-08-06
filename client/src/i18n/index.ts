import { useMemo, useSyncExternalStore } from "react";
import type { Locale } from "@shared/types";
import { isLocale } from "@shared/types";
import { en, type UiKey } from "./en";
import { no } from "./no";

const LOCALE_KEY = "cabin-chaos-locale";

const dicts = { en, no } as const;

export function detectDefaultLocale(): Locale {
  try {
    const lang = (navigator.language || "").toLowerCase();
    if (
      lang === "no" ||
      lang.startsWith("nb") ||
      lang.startsWith("nn") ||
      lang.startsWith("no-")
    ) {
      return "no";
    }
  } catch {
    /* ignore */
  }
  return "en";
}

export function loadLocalePref(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return detectDefaultLocale();
}

let prefLocale = loadLocalePref();
const listeners = new Set<() => void>();

function emitPref() {
  for (const l of listeners) l();
}

export function saveLocalePref(locale: Locale) {
  prefLocale = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
  emitPref();
}

function subscribePref(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getPrefSnapshot() {
  return prefLocale;
}

export function t(
  locale: Locale,
  key: UiKey,
  ...args: number[]
): string {
  const pack = dicts[locale] ?? en;
  const value = pack[key];
  if (typeof value === "function") {
    if (value.length >= 2) {
      return (value as (a: number, b: number) => string)(
        args[0] ?? 0,
        args[1] ?? 0
      );
    }
    return (value as (n: number) => string)(args[0] ?? 0);
  }
  return value;
}

/** Active UI locale: room locale when in a room, otherwise local preference. */
export function useLocale(roomLocale?: Locale | null): {
  locale: Locale;
  setPrefLocale: (locale: Locale) => void;
} {
  const pref = useSyncExternalStore(
    subscribePref,
    getPrefSnapshot,
    detectDefaultLocale
  );
  const locale = roomLocale ?? pref;
  return useMemo(
    () => ({
      locale,
      setPrefLocale: saveLocalePref,
    }),
    [locale]
  );
}

export type { UiKey };
