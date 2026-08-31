# UI Token Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CatchUp's existing UI softer and more consistent through semantic design tokens and narrow rendered-evidence fixes without changing product behavior or identity.

**Architecture:** Treat `apps/web/src/app/globals.css` as the deep visual-system module: its existing shared class interface continues to serve pages while semantic CSS/Tailwind tokens hide the implementation details. Modify React markup only for the authenticated-header layout defect, effective radio hit areas, and shared controls that still bypass the visual-system seam.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Heroicons, i18next, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-ui-token-refinement-design.md`

## Global Constraints

- Preserve the CatchUp logo, Noto Sans Thai Looped, Heroicons, localization, routes, authentication, API contracts, Socket.IO behavior, and page composition.
- Add no dependency, icon migration, React component-library rewrite, route change, or API change.
- Verify sticky authenticated headers against scrolling, dropdowns, dialogs, and z-index interactions to avoid regressions.
- Consolidate existing colors by mapping them to semantic tokens first; do not mechanically replace every hard-coded value unless it is actually inconsistent or redundant.
- Treat the 44px requirement as the effective interactive hit area. The visible radio/control itself does not need to be 44px if its label or row provides an accessible 44px target.
- Keep semantic success, warning, and destructive colors distinct from the primary sky/cyan accent.
- Preserve all existing user-authored working-tree changes and stop if the work requires a broader architectural change.
- Do not create page-specific CSS selectors unless rendered evidence proves that a shared class cannot solve the defect.

---

### Task 1: Establish semantic visual tokens

**Files:**
- Modify: `apps/web/src/app/globals.css:1-31`

**Interfaces:**
- Consumes: Existing Tailwind v4 `@theme inline` setup and `--font-ui` variables.
- Produces: Semantic color utilities (`ui-*`), radius variables, shadow variables, and transition variables consumed by the existing shared classes.

- [ ] **Step 1: Map the incumbent palette before replacing usages**

Record the intended mapping directly in `:root`, keeping current values where they already meet the brief:

```css
:root {
  --background: #f4f7f8;
  --foreground: #1d1d1f;
  --ui-surface: rgba(255, 255, 255, 0.88);
  --ui-surface-solid: #ffffff;
  --ui-surface-muted: #f8fafc;
  --ui-border: #dbe3e7;
  --ui-border-strong: #cbd5db;
  --ui-text: #334155;
  --ui-text-muted: #64748b;
  --ui-primary: #0369a1;
  --ui-primary-hover: #075985;
  --ui-primary-soft: #e0f2fe;
  --ui-focus: #0284c7;
  --ui-success: #047857;
  --ui-warning: #b45309;
  --ui-danger: #b91c1c;
  --radius-control: 0.5rem;
  --radius-panel: 0.75rem;
  --radius-overlay: 1rem;
  --shadow-control: 0 1px 2px rgba(15, 23, 42, 0.08);
  --shadow-panel: 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(14, 116, 144, 0.05);
  --shadow-overlay: 0 18px 48px rgba(15, 23, 42, 0.16);
  --motion-fast: 160ms;
}
```

- [ ] **Step 2: Expose only reusable tokens through Tailwind**

Extend `@theme inline` with the semantic color and shadow names used by shared styles:

```css
--color-ui-surface: var(--ui-surface);
--color-ui-surface-solid: var(--ui-surface-solid);
--color-ui-surface-muted: var(--ui-surface-muted);
--color-ui-border: var(--ui-border);
--color-ui-border-strong: var(--ui-border-strong);
--color-ui-text: var(--ui-text);
--color-ui-muted: var(--ui-text-muted);
--color-ui-primary: var(--ui-primary);
--color-ui-primary-hover: var(--ui-primary-hover);
--color-ui-primary-soft: var(--ui-primary-soft);
--color-ui-focus: var(--ui-focus);
--color-ui-success: var(--ui-success);
--color-ui-warning: var(--ui-warning);
--color-ui-danger: var(--ui-danger);
```

- [ ] **Step 3: Run a source-level token check**

Run:

```powershell
rg -n -- "--(ui-(surface|border|text|primary|focus|success|warning|danger)|radius-|shadow-|motion-)" apps/web/src/app/globals.css
```

Expected: every mapped semantic family appears in `:root`; reusable color entries also appear in `@theme inline`.

---

### Task 2: Apply tokens at the shared visual-system seam

**Files:**
- Modify: `apps/web/src/app/globals.css:17-214`

**Interfaces:**
- Consumes: Semantic tokens from Task 1.
- Produces: Refined existing interfaces: `page-shell`, `panel`, `soft-card`, `btn-primary`, `btn-secondary`, `back-button`, `form-input`, `alert-error`, `badge`, `btn-danger`, `btn-danger-ghost`, `page-title`, `section-title`, `filter-bar`, `table-surface`, `data-table`, `empty-state`, `select-*`, and `dialog-surface`.

- [ ] **Step 1: Normalize base text, surfaces, selection, and focus**

Use semantic colors in base styles. Keep focus visible and consistent:

```css
body { @apply min-h-screen bg-background font-sans text-foreground antialiased; }
button, a, input, select, textarea {
  @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus;
}
input, select, textarea {
  @apply bg-ui-surface-solid text-foreground caret-ui-primary placeholder:text-ui-muted;
}
```

- [ ] **Step 2: Refine shared panels and controls**

Retain existing class names and behavior. Use token-backed surfaces/borders/radii/shadows, remove translate-on-hover from buttons, use `transition-[color,background-color,border-color,box-shadow,opacity]`, and keep `motion-reduce:transition-none`.

The primary button remains white-on-primary; secondary/back controls remain solid-surface with a quiet border; destructive controls use red semantic colors rather than primary colors.

- [ ] **Step 3: Normalize tables, empty states, popovers, and dialogs**

Use the same border, muted surface, and shadow tokens for table containers, select/date popovers, empty states, and dialogs. Keep table overflow behavior and native `<dialog>` top-layer behavior unchanged.

- [ ] **Step 4: Preserve intentionally semantic page colors**

Do not replace quiz correctness, success, warning, destructive, word-cloud, or poll-result colors merely because they are page-local. Replace only redundant foreground/border/surface values that duplicate the new semantic tokens.

- [ ] **Step 5: Run the production CSS compiler**

Run from `apps/web` using the bundled runtime path:

```powershell
& 'C:\Users\yothi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
```

Expected: Tailwind recognizes all semantic utilities and Next.js completes the production build.

---

### Task 3: Fix authenticated header flow and effective radio targets

**Files:**
- Modify: `apps/web/src/components/admin-header.tsx:14-68`
- Modify: `apps/web/src/components/teacher-header.tsx:13-61`
- Modify: `apps/web/src/app/globals.css:104-121`
- Modify: `apps/web/src/app/teacher/quiz/[id]/quiz-editor.tsx:249-286`

**Interfaces:**
- Consumes: Existing admin/teacher layouts, shared page content, native radio inputs, and form-input styling.
- Produces: Sticky layout-participating authenticated headers and 44px effective correct-answer selection rows.

- [ ] **Step 1: Make both authenticated headers sticky**

Change `fixed left-0 right-0 top-0` to `sticky top-0` while preserving the current grid, navigation, identity, and `z-20`. Do not add a wrapper or duplicate header module.

- [ ] **Step 2: Remove fixed-header compensation**

Replace the current authenticated-shell padding overrides with normal content rhythm:

```css
.admin-shell .page-content,
.teacher-shell .page-content {
  @apply pt-8 sm:pt-10;
}
```

The public `page-content` spacing remains unchanged.

- [ ] **Step 3: Expand the radio hit area through its label**

Keep the visible native radio at `size-5`, give it a stable `id`, and wrap it in a minimum-height label:

```tsx
<label
  htmlFor={`correct-choice-${index}`}
  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center"
>
  <input
    id={`correct-choice-${index}`}
    aria-label={t("quiz.markCorrect")}
    checked={correctIndex === index}
    onChange={() => setCorrectIndex(index)}
    type="radio"
    name="correct-choice"
    className="size-5 accent-emerald-600"
  />
</label>
```

The adjacent choice text input and its screen-reader label remain unchanged.

- [ ] **Step 4: Perform focused Playwright interaction checks**

With the temporary API stub running, verify `/admin`, `/admin/history`, `/teacher`, and `/teacher/quiz/q1` at 320px and 768px:

- scroll at least 600px and confirm the header remains at `top: 0` without obscuring the first heading;
- open the history date picker and custom select, then confirm their visible panels are not clipped or hidden under the header;
- open a delete confirmation dialog and confirm it appears above the sticky header;
- click the padded area around a correct-answer radio and confirm the checked radio changes;
- confirm no horizontal overflow or browser console errors.

Expected: all assertions pass at both widths.

---

### Task 4: Align shared controls with the token system

**Files:**
- Modify: `apps/web/src/components/language-switcher.tsx:20-52`
- Modify: `apps/web/src/components/select.tsx:135-205`
- Modify: `apps/web/src/components/date-filter-picker.tsx:107-180`
- Modify: `apps/web/src/components/skeleton.tsx:1-64`
- Modify: `apps/web/src/components/activity-type-badge.tsx:10-35`

**Interfaces:**
- Consumes: Semantic utilities and shared control styles from Tasks 1–2.
- Produces: Consistent shared language, select, date, skeleton, and badge rendering used across public, teacher, and admin routes.

- [ ] **Step 1: Replace only redundant shared-control colors**

Map neutral foregrounds, borders, surfaces, focus colors, and primary selected states to `ui-*` utilities. Keep activity-type and status colors that communicate meaning.

- [ ] **Step 2: Normalize radii, shadows, and transitions**

Use the same 8px control radius, semantic border, soft control/overlay shadows, and 160ms transitions as the global classes. Retain all ARIA attributes, keyboard handlers, active-descendant behavior, and native disabled behavior.

- [ ] **Step 3: Check component consumers**

Run:

```powershell
rg -n "LanguageSwitcher|<Select|DateFilterPicker|Skeleton|ActivityTypeBadge" apps/web/src/app apps/web/src/components -g '*.tsx'
```

Expected: no consumer requires an interface change; only styling strings changed.

---

### Task 5: Verify the complete refined UI

**Files:**
- Modify only if one bounded correction is demonstrated by the first visual pass.
- Temporary, not committed: `C:\Users\yothi\AppData\Local\Temp\playwright-test-catchup-ui-final.js`

**Interfaces:**
- Consumes: Completed UI changes, local frontend, and temporary HTTP API stub.
- Produces: Evidence for responsive layout, interactions, accessibility basics, and build quality.

- [ ] **Step 1: Run lint**

Run from `apps/web` with the bundled runtime path:

```powershell
& 'C:\Users\yothi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run lint
```

Expected: exit code 0.

- [ ] **Step 2: Run the production build**

Run:

```powershell
& 'C:\Users\yothi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
```

Expected: exit code 0. If Turbopack is blocked by the environment, run the repository's established webpack fallback and report the original blocker separately.

- [ ] **Step 3: Run the Impeccable detector once**

Run:

```powershell
& 'C:\Users\yothi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\yothi\.codex\plugins\cache\impeccable\impeccable\4.1.1\skills\impeccable\scripts\detect.mjs' --json apps/web/src/app/globals.css apps/web/src/components/admin-header.tsx apps/web/src/components/teacher-header.tsx apps/web/src/app/teacher/quiz/[id]/quiz-editor.tsx apps/web/src/components/language-switcher.tsx apps/web/src/components/select.tsx apps/web/src/components/date-filter-picker.tsx apps/web/src/components/skeleton.tsx apps/web/src/components/activity-type-badge.tsx
```

Expected: no unresolved high-severity finding. Review findings as evidence; do not mechanically obey false positives.

- [ ] **Step 4: Run the first batched Playwright visual pass**

Use the temporary stub and test these routes at widths `[320, 375, 390, 430, 768, 1440]`:

```js
const routes = [
  "/",
  "/join",
  "/login",
  "/register",
  "/play/123456",
  "/teacher",
  "/teacher/quiz/q1",
  "/admin",
  "/admin/teachers",
  "/admin/history",
];
```

For every route assert `scrollWidth <= clientWidth + 1`, no page error, no console error, and no ordinary control with an effective hit area below 44px. Capture full-page screenshots at each width and inspect spacing, color hierarchy, icon alignment, sticky headers, tables, focus, hover, disabled states, dropdowns, and dialogs.

- [ ] **Step 5: Apply at most one bounded correction batch**

If the first pass demonstrates defects, fix them at the existing shared seam wherever possible. Do not broaden scope, add abstractions, or start a second polish loop.

- [ ] **Step 6: Run one confirmation pass and stop**

Repeat the failing assertions/viewports plus one desktop and one mobile representative screenshot. Run:

```powershell
git diff --check
git status --short
```

Expected: verification passes; the status lists only the known user changes, the focused implementation changes, and these approved docs.
