"use client";

import { useTranslation } from "react-i18next";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { usePathname } from "next/navigation";

export function LanguageSwitcher({
  hideOnTeacher = false,
}: {
  hideOnTeacher?: boolean;
}) {
  const { i18n, t } = useTranslation();
  const pathname = usePathname();
  const setLanguage = (language: "th" | "en") => {
    localStorage.setItem("catchup:language", language);
    void i18n.changeLanguage(language);
  };
  if (hideOnTeacher && pathname.startsWith("/teacher")) return null;
  return (
    <div
      role="group"
      className="inline-flex items-center gap-1 rounded border border-white/70 bg-white/60 p-1 text-slate-900 shadow-sm backdrop-blur-xl"
      aria-label={t("common.language")}
    >
      <LanguageIcon className="h-4 w-4 text-sky-700" aria-hidden="true" />
      <button
        type="button"
        aria-pressed={i18n.language === "th"}
        onClick={() => setLanguage("th")}
        className={`min-h-11 min-w-11 rounded px-2 py-1 focus-visible:outline-2 ${i18n.language === "th" ? "bg-sky-700 text-white" : ""}`}
      >
        ไทย
      </button>
      <button
        type="button"
        aria-pressed={i18n.language === "en"}
        onClick={() => setLanguage("en")}
        className={`min-h-11 min-w-11 rounded px-2 py-1 focus-visible:outline-2 ${i18n.language === "en" ? "bg-sky-700 text-white" : ""}`}
      >
        EN
      </button>
    </div>
  );
}
