"use client";

import { ChartBarIcon, ChatBubbleLeftRightIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

type ActivityType = "QUIZ" | "POLL" | "WORD_CLOUD";

const styles = {
  QUIZ: [QuestionMarkCircleIcon, "bg-sky-100 text-sky-800"],
  POLL: [ChartBarIcon, "bg-emerald-100 text-emerald-800"],
  WORD_CLOUD: [ChatBubbleLeftRightIcon, "bg-violet-100 text-violet-800"],
} as const;

export function ActivityTypeBadge({ type }: { type: ActivityType }) {
  const { t } = useTranslation();
  const [Icon, className] = styles[type];
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${className}`}><Icon className="h-4 w-4" aria-hidden="true" />{t(`activity.${type}.name`)}</span>;
}
