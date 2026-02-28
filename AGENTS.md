# EU Shield - Agent Guidelines

## Memory & Intelligence

This project uses claude-flow MCP for persistent vector memory and self-learning.

**Before every task:**
1. Search memory: `memory_search(query="<what you need>")`
2. If score > 0.7, use the returned pattern directly
3. If score 0.5-0.7, adapt to fit
4. If no results, proceed normally

**After completing a task:**
- Store successful patterns: `memory_store(key="<key>", value="<what worked>", namespace="patterns")`

## Tech Stack

TypeScript, Bun, WXT (Manifest V3 Chrome Extension framework), @knadh/oat (semantic UI), Zod (runtime validation at every boundary), Zustand/vanilla (popup state), Effect (async pipeline composition), Vitest.

No React. No Vue. No framework. Vanilla TypeScript + semantic HTML styled by Oat. This is a Chrome extension, not a web app.

## Why Zod, Zustand, Effect

### Zod
Chrome extensions have **runtime boundaries** where TypeScript types don't exist:
- `chrome.runtime.sendMessage` payload is `any` on the receiving end
- `chrome.storage.local.get` returns `any`
- Fetched HTML is unknown structure
- Pattern definitions validated at startup to catch config errors

Every message, every cache read, every config load goes through a Zod schema. Types are **inferred** from schemas via `z.infer<>`, never duplicated.

### Zustand (vanilla)
`zustand/vanilla` works without React. The popup has real state transitions:
- `idle` -> `loading` -> `result` -> `error`
- Rescan triggers state reset
- Vanilla store with `subscribe()` drives DOM updates

Import: `import { createStore } from 'zustand/vanilla'`

### Effect
The detection pipeline is a chain of fallible async operations:
- Probe 20+ URL paths sequentially
- Each probe: fetch with 3s timeout -> check content-type -> extract text -> validate length
- Any step can fail (404, CORS, timeout, empty page)
- Need delays between probes (150ms)
- Need to short-circuit on first success

Compose with `Effect.orElse()` for fallback strategies. Tagged errors via `Data.TaggedError`. `Effect.runPromise()` at edges to bridge into Chrome callback world.

Import: `import { Effect, pipe, Duration } from 'effect'`

## Commands

```bash
bun run dev            # Dev mode (opens Chrome with extension loaded, HMR)
bun run build          # Production build
bun run zip            # Package for Chrome Web Store
bun run typecheck      # TypeScript check
bun run test           # Vitest watch
bun run test:run       # Single run
```

## Project Structure

```
eu-shield/
  wxt.config.ts                    # WXT config + manifest definition
  entrypoints/
    background.ts                  # Service worker: navigation listener, icon manager, message router
    content.ts                     # Content script: detection pipeline (Effect), scoring trigger
    popup/
      index.html                   # Popup markup (Oat semantic HTML)
      main.ts                      # Popup logic: Zustand store -> DOM rendering
      store.ts                     # Zustand vanilla store for popup state
      style.css                    # Extension-specific overrides (Oat handles the rest)
  lib/
    schemas.ts                     # ALL Zod schemas. Types inferred from here. Single source of truth.
    patterns.ts                    # EU positive + red flag signal definitions (regex + weights)
    detector.ts                    # Effect-based detection pipeline (URL match -> content match -> probing)
    scorer.ts                      # Weighted keyword scoring engine (pure function)
    cache.ts                       # Per-domain caching via chrome.storage.local + Zod validation on read
    messages.ts                    # Message sending/receiving helpers with Zod validation
    errors.ts                      # Effect error types (ProbeError, DetectionError, CacheError)
  public/
    icon-green-{16,32,48,128}.png
    icon-red-{16,32,48,128}.png
    icon-grey-{16,32,48,128}.png
```

## Architecture

### Extension Flow

```
Page loads
  -> background.ts receives chrome.tabs.onUpdated
  -> validates tab URL with Zod
  -> checks cache (cache.ts -> Zod-validated chrome.storage.local read)
  -> if cached + valid: update icon, done
  -> if not: sends CHECK_PAGE message (Zod-validated) to content.ts
  -> content.ts runs Effect detection pipeline:
      1. matchCurrentUrl (pure, instant)
      2. orElse -> matchPageContent (reads DOM)
      3. orElse -> probeKnownPaths (Effect chain: fetch -> validate -> extract -> score)
      4. orElse -> grey result (fallback)
  -> sends SCAN_RESULT (Zod-validated) back to background.ts
  -> background.ts caches result (Zod schema as serialization contract)
  -> background.ts updates icon
  -> popup opens: reads store -> sends GET_RESULT -> Zustand store updates -> DOM re-renders
```

### Message Protocol (Zod-validated at every boundary)

| Message | From -> To | Payload |
|---|---|---|
| CHECK_PAGE | background -> content | { domain } |
| SCAN_RESULT | content -> background | { domain, result: ScoringResult, url } |
| GET_RESULT | popup -> background | { domain } -> responds with CachedResult |
| FORCE_RESCAN | popup -> background | { domain } |

### Schemas (`lib/schemas.ts`)

Single source of truth. **Never define a type manually -- infer from Zod.**

Define these schemas:
- `ComplianceStatus` -- enum: green, red, grey
- `PageType` -- enum: tos, privacy, cookie, legal
- `SignalCategory` -- enum: eu_positive, red_flag
- `PatternSchema` -- id, category, label, weight, patterns (RegExp[]), description
- `MatchedSignalSchema` -- id, label, category, weight, description, matchCount
- `DetectionResultSchema` -- detected, type (nullable), url, text
- `ScoringResultSchema` -- score, status, confidence (0-100), signals[], totalPossibleSignals
- `CachedResultSchema` -- domain, score, status, confidence, signals[], analyzedUrl, timestamp
- `ExtensionMessage` -- discriminated union on `type` field (CHECK_PAGE, SCAN_RESULT, GET_RESULT, FORCE_RESCAN)

### Error Types (`lib/errors.ts`)

Tagged error classes for Effect pipelines using `Data.TaggedError`:
- `ProbeError` -- { path, reason: fetch_failed | not_html | read_failed | too_short | timeout }
- `DetectionError` -- { reason: no_url_match | no_content_match | no_pages_found }
- `CacheError` -- { reason: read_failed | write_failed | validation_failed, domain }
- `MessageError` -- { reason: validation_failed | send_failed, raw }

### Patterns (`lib/patterns.ts`)

15 EU positive signals with weights:
- GDPR mention (+10), DPO (+8), right to erasure (+8), right to portability (+6), right to access (+6), right to rectification (+6), right to object (+6), right to restrict (+5), supervisory authority (+7), legal basis (+7), retention period (+5), EU jurisdiction (+6), cookie detail (+4), SCC (+5), ePrivacy (+4)

5 red flag signals:
- US-only jurisdiction (-8), CCPA without GDPR (-6), binding arbitration (-5), unprotected transfer (-6), data selling (-4)

All patterns include multi-language regex variants: EN, DE, FR, ES, IT. Validate all patterns against PatternSchema at startup.

### Scorer (`lib/scorer.ts`)

Pure synchronous function. No Effect needed.
- Two-pass: first match all patterns, then apply conditional logic
- CCPA penalty neutralized if GDPR signals also present
- Missing data subject rights = -10 penalty
- Thresholds: score >= 30 = green, < 10 = red, no page = grey
- Confidence = positive signals found / total possible * 100

### Detector (`lib/detector.ts`)

Effect-based pipeline with three fallback strategies composed via `Effect.orElse()`:
1. URL pattern match (pure, instant) -- match against known ToS/Privacy URL patterns
2. Content match (reads DOM) -- check title, h1, body preview for ToS indicators
3. Path probing (async) -- sequential fetch of ~20 known paths with 3s timeout, 150ms delay, short-circuit on first success

Includes `stripHtml()` for text extraction (removes script/style/nav, decodes entities, collapses whitespace). Cap extracted text at 50,000 chars.

URL patterns to match: /terms, /tos, /privacy, /privacy-policy, /legal, /cookie-policy, /agb, /datenschutz, /cgv, /impressum, /aviso-legal, /informativa-privacy, plus locale-prefixed variants (/en/terms, /de/datenschutz).

### Cache (`lib/cache.ts`)

Effect-based wrapper around `chrome.storage.local` with Zod validation on every read.
- Key format: `eushield_{domain}`
- TTL: 7 days
- Corrupted entries silently removed
- Functions: getCached, setCache, clearCache

### Messages (`lib/messages.ts`)

`sendMessage()` validates with Zod before sending. `parseMessage()` uses safeParse on received messages, returns null + console.warn on invalid.

### Popup Store (`entrypoints/popup/store.ts`)

Zustand vanilla store with states: idle, loading, result, error, rescanning.
Actions: setLoading, setResult, setError, setRescanning, reset.
`popupStore.subscribe()` drives DOM updates in main.ts.

### Popup UI (`entrypoints/popup/`)

Semantic HTML styled with Oat. No framework. Import Oat as:
```ts
import '@knadh/oat/oat.min.css';
import '@knadh/oat/oat.min.js';
```

Three visual states: grey (no data), green (compliant), red (not compliant).
Shows: status badge, confidence meter, score, expandable signal details, rescan button, link to analyzed page.
Fixed width: 360px.

### Background (`entrypoints/background.ts`)

WXT `defineBackground()`. Listens to `chrome.tabs.onUpdated`. Manages icon state via `chrome.action.setIcon`. Routes messages. All cache reads/writes via Effect with `Effect.runPromise()`. Must `return true` in onMessage for async sendResponse.

### Content Script (`entrypoints/content.ts`)

WXT `defineContentScript()`. Matches `<all_urls>`, runs at `document_idle`. Receives CHECK_PAGE, runs Effect detection pipeline, scores result, sends SCAN_RESULT back. Uses `Effect.runPromise()` to bridge.

## Module Dependency Graph

```
schemas.ts      <- single source of truth
errors.ts       <- Effect error types
patterns.ts     <- regex + weights (validated against schemas at startup)
scorer.ts       <- pure function (patterns + schemas)
detector.ts     <- Effect pipeline (schemas + errors)
cache.ts        <- Effect + chrome.storage.local + Zod
messages.ts     <- Zod validation wrapper
background.ts   <- orchestrator (cache + messages + icons)
content.ts      <- pipeline runner (detector + scorer + messages)
popup/store.ts  <- Zustand vanilla
popup/main.ts   <- store subscriber + DOM + messages
```

## Code Conventions

- Types inferred from Zod schemas, never duplicated
- Effect for I/O, plain TS for pure logic (scorer)
- `zustand/vanilla` only, no React bindings
- `Effect.runPromise()` at edges to bridge into Chrome callback world
- WXT globals `defineBackground()` / `defineContentScript()` -- don't import
- Icons in `public/` for WXT build
- `return true` in onMessage for async sendResponse
- Import order: effect -> zod -> zustand -> @knadh/oat -> local
- All regex case-insensitive, multi-language variants grouped per pattern
- Popup width fixed at 360px
- No external network calls -- only same-origin path probes
- Never use em dashes in any written content

## Privacy Constraints (Non-Negotiable)

1. Zero network calls to any external service
2. Zero telemetry, analytics, or tracking
3. Zero data leaves the browser
4. Cache is local only, never synced
5. No user accounts, no sign-in
6. Minimal permissions only (activeTab + storage)
7. All analysis is deterministic regex matching on locally extracted text
8. Open source

## Testing

Vitest. Priority targets:
1. schemas.ts -- validate/reject shapes
2. scorer.ts -- known ToS text samples, score verification
3. detector.ts -- Effect pipeline outputs via Effect.runPromise
4. patterns.ts -- regex compilation and matching
5. cache.ts -- mock chrome.storage.local, TTL, Zod validation on corrupted data
6. messages.ts -- accept good, reject bad

## Environment Variables

None. Zero config. Zero secrets.
