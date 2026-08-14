"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function BackButton({
  href,
  disabled = false,
}: {
  href: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const content = (
    <>
      <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
      {t("common.back")}
    </>
  );
  return disabled ? (
    <button type="button" disabled className="back-button">
      {content}
    </button>
  ) : (
    <Link href={href} className="back-button">
      {content}
    </Link>
  );
}
