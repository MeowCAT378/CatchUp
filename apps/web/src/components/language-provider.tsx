"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

const isLanguage = (value: string | null): value is "th" | "en" =>
  value === "th" || value === "en";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [, setLanguage] = useState<"th" | "en">("th");

  useEffect(() => {
    const sync = (next: string) => {
      if (isLanguage(next)) {
        document.documentElement.lang = next;
        setLanguage(next);
      }
    };
    i18n.on("languageChanged", sync);
    const saved = localStorage.getItem("catchup:language");
    if (isLanguage(saved) && saved !== i18n.language)
      void i18n.changeLanguage(saved);
    return () => i18n.off("languageChanged", sync);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
