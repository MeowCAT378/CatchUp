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
  if (
    hideOnTeacher &&
    (pathname.startsWith("/teacher") || pathname.startsWith("/admin"))
  )
    return null;
  return (
    <div
      role="group"
      className="inline-flex items-center gap-1 rounded-lg border border-white/80 bg-white/90 p-1 text-slate-900 shadow-sm"
      aria-label={t("common.language")}
    >
      <LanguageIcon
        className="hidden h-4 w-4 text-sky-700 sm:block"
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={i18n.language === "th"}
        onClick={() => setLanguage("th")}
        className={`min-h-11 min-w-11 rounded-md px-2 py-1 transition-colors focus-visible:outline-2 motion-reduce:transition-none ${i18n.language === "th" ? "bg-sky-700 text-white" : "hover:bg-sky-50"}`}
      >
        ไทย
      </button>
      <button
        type="button"
        aria-pressed={i18n.language === "en"}
        onClick={() => setLanguage("en")}
        className={`min-h-11 min-w-11 rounded-md px-2 py-1 transition-colors focus-visible:outline-2 motion-reduce:transition-none ${i18n.language === "en" ? "bg-sky-700 text-white" : "hover:bg-sky-50"}`}
      >
        EN
      </button>
    </div>
  );
}
