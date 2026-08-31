"use client";

import {
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import type { DefaultSession } from "next-auth";
import { signOut } from "next-auth/react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { MobileNavigation } from "@/components/mobile-navigation";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
};

export function AppHeader({
  homeHref,
  roleLabel,
  items,
  user,
}: {
  homeHref: string;
  roleLabel: string;
  items: NavigationItem[];
  user?: DefaultSession["user"];
}) {
  const { t } = useTranslation();
  const links = items.map(({ href, label, icon: Icon, active }) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className="app-nav-link"
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  ));
  const profile = user && (
    <section
      aria-label={t("common.profile")}
      className="flex min-w-0 items-center gap-2.5"
    >
      <UserCircleIcon
        className="h-9 w-9 shrink-0 text-ui-muted"
        aria-hidden="true"
      />
      <div className="app-profile-copy min-w-0 text-sm">
        {user.name && (
          <p className="truncate font-medium text-foreground" title={user.name}>
            {user.name}
          </p>
        )}
        {user.email && (
          <p className="truncate text-xs text-ui-muted" title={user.email}>
            {user.email}
          </p>
        )}
      </div>
    </section>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-ui-border bg-ui-surface-solid text-ui-text">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center gap-4 px-5 sm:px-8 lg:gap-6 lg:px-10">
        <a
          href={homeHref}
          aria-label="CatchUp"
          className="flex shrink-0 items-center gap-2.5 rounded-ui-control"
        >
          <Logo className="h-12 w-auto" />
          <span className="text-sm font-medium text-ui-muted">{roleLabel}</span>
        </a>
        <nav
          className="app-desktop-nav hidden min-w-0 items-center gap-1 self-stretch lg:flex"
          aria-label={t("common.navigation")}
        >
          {links}
        </nav>
        <div className="app-header-account ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          <LanguageSwitcher variant="navigation" />
          {profile && (
            <div
              className="max-w-9 xl:max-w-44"
              title={user?.name || user?.email || undefined}
            >
              {profile}
            </div>
          )}
          <button
            type="button"
            aria-label={t("teacher.logout")}
            title={t("teacher.logout")}
            onClick={() => signOut({ callbackUrl: "/" })}
            className="app-nav-action"
          >
            <ArrowRightStartOnRectangleIcon
              className="h-5 w-5"
              aria-hidden="true"
            />
          </button>
        </div>
        <MobileNavigation profile={profile}>{links}</MobileNavigation>
      </div>
    </header>
  );
}
