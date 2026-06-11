import type { FC } from "react";
import { useTranslation } from "./I18nContext.tsx";
import type { Locale } from "./translate.ts";
import "./LanguageSwitcher.css";

export const LanguageSwitcher: FC = () => {
  const { locale, setLocale, t } = useTranslation();

  const pick = (next: Locale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t("locale.en") + " / " + t("locale.ru")}
    >
      <button
        type="button"
        className={`language-switcher__btn${locale === "en" ? " active" : ""}`}
        onClick={() => pick("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        className={`language-switcher__btn${locale === "ru" ? " active" : ""}`}
        onClick={() => pick("ru")}
        aria-pressed={locale === "ru"}
      >
        RU
      </button>
    </div>
  );
};
