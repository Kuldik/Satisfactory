// ============================================================
// i18n — lightweight translation helper (EN base, RU switch).
// ============================================================

import { dictionaries } from "./locales/index.ts";

export type Locale = "en" | "ru";

export const LOCALE_STORAGE_KEY = "satisfactory-locale-v1";

export type TranslationParams = Record<string, string | number>;

type Dict = Record<string, unknown>;

export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return raw === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}

export function getNested(dict: Dict, key: string): unknown {
  const parts = key.split(".");
  let node: unknown = dict;
  for (const part of parts) {
    if (!node || typeof node !== "object" || !(part in node)) return undefined;
    node = (node as Dict)[part];
  }
  return node;
}

export function interpolate(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = params[name];
    return v === undefined ? `{{${name}}}` : String(v);
  });
}

export function createTranslator(
  locale: Locale,
  dictionaries: Record<Locale, Dict>,
): (key: string, params?: TranslationParams) => string {
  return (key: string, params?: TranslationParams): string => {
    let value = getNested(dictionaries[locale], key);
    if (typeof value !== "string") {
      value = getNested(dictionaries.en, key);
    }
    if (typeof value !== "string") return key;
    return interpolate(value, params);
  };
}

export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
}

let activeLocale: Locale = readStoredLocale();
let activeTranslator: (key: string, params?: TranslationParams) => string =
  createTranslator(activeLocale, dictionaries);
applyDocumentLocale(activeLocale);

export function setActiveI18n(
  locale: Locale,
  translator: (key: string, params?: TranslationParams) => string,
): void {
  activeLocale = locale;
  activeTranslator = translator;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

/** For non-React modules (sim item names, etc.). */
export function tGlobal(key: string, params?: TranslationParams): string {
  return activeTranslator(key, params);
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}
