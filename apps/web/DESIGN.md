---
name: CatchUp navigation
description: Teacher and admin header and drawer only.
colors:
  ui-primary: "#0369a1"
  ui-primary-soft: "#e0f2fe"
  ui-focus: "#0284c7"
  ui-surface-solid: "#ffffff"
  ui-surface-muted: "#f8fafc"
  ui-border: "#dbe3e7"
  foreground: "#1d1d1f"
  ui-text: "#334155"
  ui-text-muted: "#64748b"
typography:
  label:
    fontFamily: "var(--font-ui)"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
rounded:
  control: "0.5rem"
  language-option: "0.375rem"
---

# Design System: CatchUp navigation

## Overview

Lightweight, modern education SaaS navigation that keeps CatchUp's existing identity. A solid white header, restrained blue selection, and grouped account controls support clear scanning without making every link a button.

**Scope:** These tokens and rules describe only the shipped teacher/admin header and mobile drawer. They are not a whole-app design specification. Existing source remains authoritative for all other surfaces and for any implementation detail not recorded here.

**Key Characteristics:**
- Solid surfaces, quiet borders, and comfortable spacing.
- Shared presentation with role-specific links.
- Existing logo, Heroicons, and Thai/English typography.

## Colors

### Primary

Use `ui-primary` for selected navigation text, the desktop underline, and the selected language. Mobile selection uses `ui-primary-soft` at 50% opacity. Keyboard outlines use `ui-focus`.

### Neutral

Use `ui-surface-solid` for the header, drawer, and selected language; `ui-surface-muted` for quiet hover and language-group surfaces. `ui-border` separates the header and drawer account area. Labels use `ui-text-muted`, emphasized text uses `foreground`, and the header inherits `ui-text`.

## Typography

Navigation labels use the frontmatter label role. The existing `--font-ui` selects Noto Sans Thai Looped with Tahoma/system fallbacks for Thai, and the incumbent Apple/SF/Helvetica/Arial system stack otherwise. Keep localized labels; do not introduce another font or force uppercase.

Profile names use medium-weight label text; emails use smaller text (12px). The drawer title uses semibold text (18px). Long names, emails, and navigation labels truncate within their available space.

## Layout

The sticky header has a bottom border, minimum height (72px), and centered maximum width (1280px). Horizontal padding is 20px, then 32px from 640px, and 40px from 1024px.

Below 1024px, show the hamburger and right-hand drawer. At 1024px and above, show desktop links and the account group; crossing this breakpoint closes an open drawer. Desktop profile copy is screen-reader-only until 1280px, while its icon remains visible; the profile group is capped at 176px from 1280px.

The drawer fills the dynamic viewport height and is `min(24rem, calc(100vw - 1rem))` wide. Its content scrolls vertically, keeps safe-area bottom padding, and places profile, language, and logout below navigation. Opening the drawer locks document scrolling; closing restores the previous overflow setting.

## Elevation & Depth

The header has no shadow or glass effect. Use the existing control shadow only for the selected language and the existing overlay shadow for the drawer. The shared native dialog supplies the dim backdrop. Exact shadow and motion values are recorded in the sidecar.

## Shapes

Actions and mobile links use the existing control radius; language options use the smaller radius. Desktop links remain unboxed with a slim active underline (2px). Do not turn these navigation links into oversized pills.

## Components

`AppHeader` owns the shared presentation; `TeacherHeader` and `AdminHeader` supply routes, labels, icons, and active state. `MobileNavigation` reuses the same link content. Preserve the existing logo and outline Heroicons; navigation icons are 20px, menu/close icons 24px, and the profile icon 36px.

- **Navigation:** `aria-current="page"` identifies the active link. Desktop selection uses blue text and the underline; drawer selection uses a quiet fill. Links have a minimum height of 48px. Hover changes text and, outside the desktop link treatment, the surface.
- **Account controls:** Group language, optional profile, and logout on desktop. In the drawer, a border separates the profile/language area from navigation, with logout below. Action and language buttons have minimum 44px height and width. Profile information is display-only; logout keeps `signOut({ callbackUrl: "/" })`.
- **Language:** Reuse the navigation variant of `LanguageSwitcher`, including its labeled group, `aria-pressed` state, and existing `catchup:language` persistence. Keep the unrelated default variant unchanged.
- **Drawer:** Reuse `Dialog` and native `showModal()` keyboard behavior. Escape, backdrop click, close button, or a navigation link request closure; focus returns to the opener on unmount. Keep dialog labeling and menu expansion state.
- **Motion and focus:** Navigation color/underline transitions and drawer movement use 200ms. The inherited opening backdrop uses 180ms. Reduced motion disables navigation transitions and drawer movement and removes the close delay. Preserve the visible focus outline (2px with 2px offset).

| Header context | Home link | Navigation links |
| --- | --- | --- |
| Teacher | `/teacher` | `/teacher/history`; an admin viewing this header also sees `/admin` |
| Admin | `/admin` | `/teacher`, `/admin`, `/admin/teachers`, `/admin/history` |

Keep active-route predicates in the role headers unchanged: overview is an exact `/admin` match in `AdminHeader`; its other items use their existing path prefixes. `TeacherHeader` marks the history prefix active and leaves its optional admin link inactive.

Source: [global tokens and navigation styles](src/app/globals.css), [shared header](src/components/app-header.tsx), [teacher header](src/components/teacher-header.tsx), [admin header](src/components/admin-header.tsx), [drawer](src/components/mobile-navigation.tsx), [language switcher](src/components/language-switcher.tsx), and [dialog](src/components/dialog.tsx).

## Do's and Don'ts

- **Do** reuse the shared header, existing tokens, translated labels, and native dialog behavior.
- **Do** preserve role-specific routes, permissions, authentication, and logout behavior.
- **Do** check Thai and English, long profile text, keyboard focus, and widths of 320, 375, 768, 1024, 1280, and 1440px when changing this navigation.
- **Don't** add glass effects, excessive gradients, heavy separators, decorative clutter, or large filled desktop active blocks to this navigation.
- **Don't** apply these navigation-specific restrictions to unrelated page content or add dependencies for this visual system.
