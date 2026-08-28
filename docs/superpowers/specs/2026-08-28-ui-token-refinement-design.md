# UI token refinement design

## Goal

Refine CatchUp's existing interface into a softer, cleaner, more consistent visual system without changing product behavior, information architecture, copy, routes, authentication, real-time flows, or the established logo and Thai typography.

## Scope

The work is a token-first refinement of the existing Next.js and Tailwind v4 implementation.

- Consolidate semantic colors, radii, borders, shadows, typography, focus treatment, and transition timing in `apps/web/src/app/globals.css`.
- Keep the existing shared class interface (`page-shell`, `panel`, `soft-card`, button classes, form classes, tables, badges, dialogs, and states) and deepen that seam rather than introducing a component-library rewrite.
- Update page markup only where shared styling cannot fix a demonstrated layout or accessibility defect.
- Preserve the landing composition and footer, CatchUp logo, Noto Sans Thai Looped, Heroicons, localization, and all behavior.

## Visual system

- Use a cool off-white base and one restrained sky/cyan primary accent.
- Keep success, warning, and destructive colors distinct from the primary accent.
- Use readable cool-neutral text levels: strong foreground, body, secondary, and muted metadata.
- Use 8px radii for controls, 12px for panels and cards, and 16px only for large overlays where appropriate.
- Prefer quiet borders and tinted surfaces; reserve shadows for hierarchy such as panels, popovers, dialogs, and primary actions.
- Limit typography to the existing font families and mostly 400, 500, and 600 weights.
- Use 150–200ms color, border, shadow, and opacity transitions. Avoid unnecessary translation or scale effects and preserve reduced-motion behavior.

## Structural and accessibility fixes

- Change authenticated headers from viewport-overlaid positioning to sticky, layout-participating headers so mobile navigation height cannot obscure page content.
- Remove header-height padding compensation from authenticated shells once headers participate in document flow.
- Keep every ordinary interactive target at least 44px high where practical.
- Increase quiz answer radio rows to a 44px minimum hit area while retaining native radio inputs and labels.
- Preserve visible focus indicators, semantic labels, keyboard order, status text, table overflow containment, and localized wrapping.

## Implementation limits

- No new dependency, icon migration, design-system package, generalized React primitive layer, route change, or API change.
- No page-specific CSS selector unless rendered evidence shows a defect that cannot be solved through an existing shared class.
- Existing user-authored working-tree changes remain intact and are incorporated only where they overlap the approved refinement.
- Stop before any change that would materially replace the current product identity or require a broader architectural refactor.

## Verification

Use the existing local frontend with temporary API stubs for data-dependent screens.

- Inspect public, participant, teacher, quiz-editor, admin overview, teacher-management, and history surfaces at widths 320, 375, 390, 430, 768, and desktop.
- Check horizontal overflow, authenticated header/content separation, touch targets, Thai and English wrapping, focus visibility, hover/active/disabled states, status colors, tables, dialogs, and browser console errors.
- Run the web lint and production build commands.
- Run the Impeccable detector once over the changed UI targets.
- Perform one batched Playwright visual pass, apply one bounded correction batch if required, then perform one confirmation pass and stop.
