const LOCALE_CATALOGUE = [
  { code: "en", name: "English" },
  { code: "az", name: "Azərbaycanca" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "es", name: "Español" },
  { code: "ca", name: "Català" },
  { code: "fr", name: "Français" },
  { code: "ar", name: "العربية" },
  { code: "pl", name: "Polish" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "tr", name: "Türkçe" },
  { code: "zh-CN", name: "简体中文" },
  { code: "ja", name: "日本語" },
  { code: "nb-NO", name: "Norwegian (bokmål)" },
  { code: "nn-NO", name: "Norwegian (nynorsk)" },
  // id.json and sr.json shipped in i18n/locales but were never registered
  // here, so those locales were unreachable and fell back to the default.
  { code: "id", name: "Bahasa Indonesia" },
  { code: "sr", name: "Српски" },
  { code: "he", name: "עברית" },
];

/**
 * Pinned to the top of the switcher by request. DEFAULT_LOCALE reads
 * LOCALES[0].code, so English must stay first of these two.
 */
const PINNED_LOCALES = ["en", "az"];

/**
 * The switcher shows each language under its own name, so that is what the
 * order is built from — sorting by English name would look arbitrary next to
 * "Deutsch" and "日本語".
 *
 * Intl.Collator's root order alphabetises the Latin-script names and then
 * groups the remaining scripts after them (Cyrillic, Hebrew, Arabic, then
 * Han/kana), which is a readable result for a mixed-script list. Computed once
 * at module load rather than per render.
 */
const localeCollator = new Intl.Collator("en", { sensitivity: "base" });

export const LOCALES = [
  ...PINNED_LOCALES.map(
    (code) => LOCALE_CATALOGUE.find((locale) => locale.code === code)!
  ),
  ...LOCALE_CATALOGUE.filter(
    (locale) => !PINNED_LOCALES.includes(locale.code)
  ).sort((a, b) => localeCollator.compare(a.name, b.name)),
];
export const DEFAULT_LOCALE = LOCALES[0].code;

/**
 * Writing direction per locale.
 *
 * Arabic has been in LOCALES since before this branch and has been rendering
 * right-to-left text inside a left-to-right layout the whole time — <html> was
 * emitted with `lang` but no `dir` at all. Hebrew joins it here, and both now
 * get a real direction.
 */
export const RTL_LOCALES = new Set(["ar", "he"]);

export const dirForLocale = (locale: string): "rtl" | "ltr" =>
  RTL_LOCALES.has(locale) ? "rtl" : "ltr";
