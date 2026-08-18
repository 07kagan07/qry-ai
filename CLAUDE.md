# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant QR menu SaaS for Turkish cafes/restaurants. Its core purpose is regulatory
compliance: Turkish food-labeling law (Türk Gıda Kodeksi) requires menus to declare the 14 major
allergens, calorie content, and alcohol/pork content per item. The app uses AI (Gemini) to suggest
these declarations from a product name/description, but the business owner must always approve
before publishing — see `ai_suggested` / `AiSuggestion` in `src/lib/types.ts`.

The UI and all commit/code content in this repo is Turkish. Match that when adding user-facing
strings or SQL comments.

## Commands

```bash
npm run dev              # start Vite dev server (localhost only)
npm run dev -- --host    # expose on LAN, for testing QR codes from a phone
npm run build            # tsc -b && vite build — type-checks then bundles
npm run lint             # oxlint (rules in .oxlintrc.json)
npm run preview          # preview a production build
```

There is no test suite configured in this repo.

Edge Functions (Deno, in `supabase/functions/`) are deployed via the Supabase CLI, not npm:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set GEMINI_API_KEY=AIza...        # never put this in the frontend
supabase functions deploy <function-name>
```

Database changes are plain SQL files under `supabase/migrations/`, run manually in the Supabase
SQL Editor or via `supabase db push` — there is no ORM/migration framework. New schema changes
should be added as a new numbered file (e.g. `005_*.sql`) rather than editing existing migrations.

## Architecture

**Two audiences, one codebase.** Routes split into an authenticated owner panel
(`src/pages/panel/*`, mounted under `/panel` via `PanelLayout`) and public, unauthenticated
customer-facing pages (`src/pages/public/*`: `/menu/:slug`, `/menu/:slug/yazdir` printable menu,
`/t/:tableId` table QR redirect). `AuthContext` (`src/context/AuthContext.tsx`) loads the signed-in
user's single `cafe` row (owner → cafe is 1:1 today) and exposes it app-wide.

**Multi-tenancy is enforced by Postgres RLS, not application code.** Every table has `cafe_id` and
policies keyed off a `public.owns_cafe(cafe_id)` SQL helper (`security definer`, checks
`auth.uid()`). Public reads (menu items, categories) are allowed when `is_active = true` regardless
of auth; owner writes always require `owns_cafe`. When adding a table or column, the RLS policy is
part of the feature, not an afterthought — follow the existing pattern in
`supabase/migrations/001_init.sql` and `004_waiter_calls.sql`.

**AI calls are proxied through Supabase Edge Functions** (`supabase/functions/ai-*`), never called
directly from the client — `GEMINI_API_KEY` lives only as a Supabase secret. The frontend entry
point is `src/lib/ai.ts`, which wraps `supabase.functions.invoke(...)`. Shared Gemini plumbing
(structured JSON generation via `responseSchema`, image generation, CORS headers) lives in
`supabase/functions/_shared/gemini.ts`. Current functions:
- `ai-analyze` / `ai-analyze-batch` — allergen/kcal/alcohol/pork suggestions from name+ingredients
  (batched in chunks of 40, see `analyzeBatch` in `src/lib/ai.ts`)
- `ai-import-menu` — vision extraction of categories/items/prices from a photographed menu
- `ai-describe`, `ai-translate` — description generation and multi-language translation
- `ai-image-prompt` / `ai-generate-image` — product photo generation (billed; no free tier, unlike
  the other functions which use `gemini-2.5-flash`)

**Allergens are a closed, regulation-defined set.** The 14 keys are defined once in
`src/lib/allergens.ts` (`ALLERGEN_KEYS`) and mirrored in `ALLERGEN_ENUM` in
`supabase/functions/_shared/gemini.ts` and the `valid_allergens` CHECK constraint in the DB. If this
set ever changes, all three must be updated together, plus `isAllergenKey`/AI-response filtering in
`src/lib/ai.ts`.

**Table QR / waiter-call flow uses a two-tier identifier** to avoid ever exposing a durable ID in a
URL that could be replayed after the customer leaves: `tables.id` is the permanent ID printed in the
QR code and never changes; `table_sessions` is a short-lived (10 min) session created on scan, and
its ID is what actually appears in the `?masa=` URL param customers use. Waiter-call INSERT RLS
policies require both an active table AND a non-expired session — the session-expiry check is the
real security boundary, not a UX nicety (see comments in `004_waiter_calls.sql`). `waiter_calls` is
added to `supabase_realtime` for live panel notifications (`TablesAndCalls.tsx`,
`CallWaiterButton.tsx`).

**Each cafe has exactly one currency** (`cafes.currency`, `TRY`/`USD`/`EUR`, see
`src/lib/currency.ts`), set in the panel (`Dashboard.tsx`) or auto-detected during photo import.
All stored prices are plain numbers in that currency — nothing is ever silently converted to TRY.
`ai-import-menu` detects the currency shown in the photo (symbol/abbreviation) and returns it
alongside the extracted items; `ImportMenu.tsx` asks for confirmation before saving if it differs
from the cafe's current currency (confirming updates `cafes.currency`, since the whole menu shares
one currency). `src/lib/exchangeRates.ts` + `FxPrice` separately show a live-rate hint in the
*other* two currencies next to each price on public pages — that's a display-only convenience
(frankfurter.app, 24h localStorage cache) and never touches the stored price.

**Public menu rendering is theme-pluggable.** `Cafe.menu_theme` selects one of four components
under `src/pages/public/themes/` (`ClassicMenuTheme`, `GridMenuTheme`, `ElegantMenuTheme`,
`CompactMenuTheme`), all implementing the shared `MenuThemeProps` contract in
`src/pages/public/themes/types.ts`. `usePublicMenu` (`src/lib/usePublicMenu.ts`) does the actual
data fetching (cafe + active categories + active items by slug) independent of theme.

## Conventions

- Path style: relative imports, no `@/` alias configured.
- `oxlint` config only turns on `react/rules-of-hooks` (error) and
  `react/only-export-components` (warn) beyond defaults — keep new lint-relevant code compatible
  with those.
- The Supabase client (`src/lib/supabase.ts`) is created even when env vars are missing (falls back
  to placeholder values) so the app still boots and can show a setup warning instead of crashing;
  check `isSupabaseConfigured` rather than assuming `supabase` is null.
