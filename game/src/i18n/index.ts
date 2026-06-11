export {
  applyDocumentLocale,
  createTranslator,
  getActiveLocale,
  readStoredLocale,
  setActiveI18n,
  tGlobal,
  writeStoredLocale,
  type Locale,
  type TranslationParams,
} from "./translate.ts";
export { I18nProvider, useTranslation, useTranslationOptional } from "./I18nContext.tsx";
export { LanguageSwitcher } from "./LanguageSwitcher.tsx";
export { BUILDING_META } from "./buildings.generated.ts";
