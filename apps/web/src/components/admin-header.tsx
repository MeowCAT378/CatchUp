"use client";

import {
  ChartBarSquareIcon,
  ClockIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { DefaultSession } from "next-auth";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/app-header";

export function AdminHeader({ user }: { user?: DefaultSession["user"] }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <AppHeader
      homeHref="/admin"
      roleLabel={t("admin.adminRole")}
      user={user}
      items={[
        {
          href: "/teacher",
          label: t("admin.activities"),
          icon: Squares2X2Icon,
          active: pathname.startsWith("/teacher"),
        },
        {
          href: "/admin",
          label: t("admin.overview"),
          icon: ChartBarSquareIcon,
          active: pathname === "/admin",
        },
        {
          href: "/admin/teachers",
          label: t("admin.teachers"),
          icon: UsersIcon,
          active: pathname.startsWith("/admin/teachers"),
        },
        {
          href: "/admin/history",
          label: t("history.title"),
          icon: ClockIcon,
          active: pathname.startsWith("/admin/history"),
        },
      ]}
    />
  );
}
