import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { dictionaries } from "./locales/index.ts";
import {
  applyDocumentLocale,
  createTranslator,
  getActiveLocale,
  readStoredLocale,
  setActiveI18n,
  writeStoredLocale,
  type Locale,
  type TranslationParams,
} from "./translate.ts";

export type TranslateFn = (key: string, params?: TranslationParams) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const t = useMemo(
    () => createTranslator(locale, dictionaries),
    [locale],
  );

  useEffect(() => {
    setActiveI18n(locale, t);
    writeStoredLocale(locale);
    applyDocumentLocale(locale);
  }, [locale, t]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return ctx;
}

/** Safe hook for modules that may render outside provider during HMR. */
export function useTranslationOptional(): I18nContextValue {
  const ctx = useContext(I18nContext);
  const fallbackT = useMemo(
    () => createTranslator(getActiveLocale(), dictionaries),
    [],
  );
  if (ctx) return ctx;
  return {
    locale: getActiveLocale(),
    setLocale: () => {},
    t: fallbackT,
  };
}
