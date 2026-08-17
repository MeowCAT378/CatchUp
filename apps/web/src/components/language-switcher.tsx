"use client";

import { useTranslation } from "react-i18next";
import { LanguageIcon } from "@heroicons/react/24/outline";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const setLanguage = (language: "th" | "en") => {
    localStorage.setItem("catchup:language", language);
    void i18n.changeLanguage(language);
  };
  return (
    <div
      className="inline-flex items-center gap-1 rounded border border-white/70 bg-white/60 p-1 text-slate-900 shadow-sm backdrop-blur-xl"
      aria-label={t("common.language")}
    >
      <LanguageIcon className="h-4 w-4 text-sky-700" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setLanguage("th")}
        className={`rounded px-2 py-1 focus-visible:outline-2 ${i18n.language === "th" ? "bg-sky-600 text-white" : ""}`}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`rounded px-2 py-1 focus-visible:outline-2 ${i18n.language === "en" ? "bg-sky-600 text-white" : ""}`}
      >
        EN
      </button>
    </div>
  );
}
