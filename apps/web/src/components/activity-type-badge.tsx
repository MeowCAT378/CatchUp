"use client";

import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

type ActivityType = "QUIZ" | "POLL" | "WORD_CLOUD";

const styles = {
  QUIZ: [
    QuestionMarkCircleIcon,
    "border border-ui-border bg-ui-surface-muted text-ui-text",
  ],
  POLL: [
    ChartBarIcon,
    "border border-ui-border bg-ui-surface-muted text-ui-text",
  ],
  WORD_CLOUD: [
    ChatBubbleLeftRightIcon,
    "border border-teal-200 bg-teal-50 text-teal-800",
  ],
} as const;

export function ActivityTypeBadge({ type }: { type: ActivityType }) {
  const { t } = useTranslation();
  const [Icon, className] = styles[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {t(`activity.${type}.name`)}
    </span>
  );
}
