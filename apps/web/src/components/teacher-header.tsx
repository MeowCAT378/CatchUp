"use client";

import { ChartBarSquareIcon, ClockIcon } from "@heroicons/react/24/outline";
import type { DefaultSession } from "next-auth";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";

export function TeacherHeader({
  isAdmin,
  user,
}: {
  isAdmin: boolean;
  user?: DefaultSession["user"];
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <AppHeader
      homeHref="/teacher"
      roleLabel={t(isAdmin ? "admin.adminRole" : "admin.teacherRole")}
      user={user}
      items={[
        ...(isAdmin
          ? [{
              href: "/admin",
              label: t("admin.overview"),
              icon: ChartBarSquareIcon,
              active: false,
            }]
          : []),
        {
          href: "/teacher/history",
          label: t("history.title"),
          icon: ClockIcon,
          active: pathname.startsWith("/teacher/history"),
        },
      ]}
    />
  );
}
