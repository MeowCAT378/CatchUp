"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { auth } from "./auth";
import { common } from "./common";
import { errors } from "./errors";
import { player } from "./player";
import { activity, quiz } from "./quiz";
import { results } from "./results";
import { room } from "./room";
import { wordCloud } from "./word-cloud";
import { teacher } from "./teacher";

const resources = {
  th: {
    translation: {
      ...common.th,
      ...auth.th,
      ...quiz.th,
      ...activity.th,
      ...room.th,
      ...player.th,
      ...wordCloud.th,
      ...results.th,
      ...errors.th,
    },
  },
  en: {
    translation: {
      ...common.en,
      ...auth.en,
      ...quiz.en,
      ...activity.en,
      ...room.en,
      ...player.en,
      ...wordCloud.en,
      ...results.en,
      ...errors.en,
    },
  },
};

if (!i18n.isInitialized)
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: "th",
      fallbackLng: "th",
      initAsync: false,
      interpolation: { escapeValue: false },
    });
else
  for (const [language, resource] of Object.entries(resources))
    i18n.addResourceBundle(
      language,
      "translation",
      resource.translation,
      true,
      true,
    );
for (const [language, resource] of Object.entries(teacher))
  i18n.addResourceBundle(language, "translation", resource, true, true);

export default i18n;
