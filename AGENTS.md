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

## Purpose

EU Shield detects whether an online service is **EU/EEA-based**. It does NOT check for GDPR language or legal compliance. It answers one question: "Is this company in the EU?"

- Green = EU-based service
- Red = Non-EU service
- Grey = Cannot determine

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
- Probe 30+ URL paths sequentially
- Each probe: fetch with 3s timeout -> check content-type -> extract text -> validate length
- Any step can fail (404, CORS, timeout, empty page)

Compose with `Effect.orElse()` for fallback strategies. Tagged errors via `Data.TaggedError`. `Effect.runPromise()` at edges to bridge into Chrome callback world.

Import: `import { Effect } from 'effect'`

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
    patterns.ts                    # EU-based detection signal definitions (regex + weights)
    detector.ts                    # Effect-based detection pipeline (URL match -> content match -> probing)
    scorer.ts                      # Weighted signal scoring engine (pure function)
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
  -> checks cache (cache.ts -> Zod-validated chrome.storage.local read)
  -> if cached + valid: update icon, done
  -> if not: sends CHECK_PAGE message (Zod-validated) to content.ts
  -> content.ts runs Effect detection pipeline:
      Phase 1: detect current page (matchCurrentUrl or matchPageContent)
      Phase 2: probeAllPaths -- probe ALL known paths, collect all text
      Phase 3: combine all text, score combined corpus
  -> sends SCAN_RESULT (Zod-validated) back to background.ts
  -> background.ts caches result (Zod schema as serialization contract)
  -> background.ts updates icon
  -> popup opens: queries active tab -> sends GET_RESULT -> polls if scan in progress -> Zustand store updates -> DOM re-renders
```

### Message Protocol (Zod-validated at every boundary)

| Message | From -> To | Payload | sendResponse used? |
|---|---|---|---|
| CHECK_PAGE | background -> content, popup -> content | { domain } | No (return false) |
| SCAN_RESULT | content -> background | { domain, result: ScoringResult, url } | No (return false) |
| GET_RESULT | popup -> background | { domain } -> responds with CachedResult | Yes (return true) |
| FORCE_RESCAN | popup -> background | { domain } | No (return false) |

**Critical**: only return `true` from `onMessage` when `sendResponse` will actually be called (GET_RESULT only). All other handlers return `false`. Content script sends results via `chrome.runtime.sendMessage`, not `sendResponse`.

### Message Flow Details

**Popup -> content script**: popup uses `chrome.tabs.sendMessage(tabId, ...)` to send CHECK_PAGE directly to the active tab's content script. It gets the tabId from `chrome.tabs.query({active: true, currentWindow: true})`. The popup does NOT use `chrome.runtime.sendMessage` for CHECK_PAGE (that would go to background, which has no handler for it).

**Popup polling**: after triggering a scan, popup polls background with GET_RESULT every 1s (max 15 attempts) until a cached result appears.

**Duplicate scan prevention**: content script tracks `scanInProgress` flag. If a scan is already running (e.g. triggered by background's onUpdated), a second CHECK_PAGE from popup is ignored.

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

Detects whether a service is EU/EEA-based. NOT GDPR language detection.

11 EU positive signals with weights:
- EU jurisdiction (+15) -- "governed by laws of [EU country]"
- EU registration (+15) -- "registered/incorporated in [EU country]"
- EU VAT number (+15) -- EU VAT format (AT/BE/DE/FR/etc + digits)
- EU headquarters (+12) -- "headquartered/based/located in [EU country]"
- EU company registry (+12) -- Handelsregister/HRB, RCS/SIRET, KvK, Registro Mercantil, etc.
- Impressum (+10) -- German/Austrian legal disclosure requirement
- EU consumer rights (+8) -- "European Union consumer", mandatory provisions
- EU data authority (+8) -- DPO, supervisory authority, CNIL, BfDI, AEPD
- GDPR mention (+6) -- indicates EU regulatory awareness
- EU country in address (+8) -- postal code + EU country pattern
- EU country mention (+5) -- any EU/EEA country name in legal text

4 red flag signals:
- US jurisdiction (-12) -- "governed by laws of California/Delaware/etc."
- US registration (-12) -- "incorporated in Delaware/Nevada/etc."
- Non-EU headquarters (-8) -- "based in USA/UK/China/etc."
- Binding arbitration (-4) -- uncommon in EU

EU/EEA country list: all 27 EU member states + Norway, Iceland, Liechtenstein. Includes native language country names (Deutschland, Eesti, Sverige, etc.).

All patterns include multi-language regex variants. Validate all patterns against PatternSchema at startup.

### Scorer (`lib/scorer.ts`)

Pure synchronous function. No Effect needed.
- Match all patterns against combined text from all probed pages
- Domain TLD bonus: +5 if domain uses EU country-code TLD (.de, .fr, .ee, .nl, etc.)
- Thresholds: score >= 15 = green (EU-based), score <= -5 = red (non-EU), between = grey (uncertain)
- Confidence = positive signals found / total possible * 100
- Empty text = grey with score 0

### Detector (`lib/detector.ts`)

Effect-based pipeline with two phases:

**Phase 1 -- Current page detection** (optional, may return null):
1. `matchCurrentUrl` -- match against known legal/about/contact URL patterns. If matched, extract page body text via `stripHtml()`.
2. `orElse` -> `matchPageContent` -- check title, h1, body preview for legal page indicators

**Phase 2 -- Comprehensive probing** (always runs):
- `probeAllPaths` -- probe ALL known paths, collect text from every successful probe
- Paths include: /about, /about-us, /company, /contact, /impressum, /terms, /privacy, /legal, plus locale-prefixed variants (/en/about, /de/impressum, /fr/mentions-legales, etc.)

**Scoring**: combine text from current page + all probed pages into single corpus, score once.

Includes `stripHtml()` for text extraction (removes script/style/nav, decodes entities, collapses whitespace). Cap combined text at 100,000 chars.

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

Three visual states: grey (unknown), green (EU-based), red (non-EU).
Shows: status badge, confidence meter, score, expandable signal details, rescan button, link to analyzed page.
Fixed width: 360px.

Popup gets active tab info via `chrome.tabs.query({active: true, currentWindow: true})` -- never uses `window.location.hostname` (that returns the extension's host, not the tab's).

### Background (`entrypoints/background.ts`)

WXT `defineBackground()`. Listens to `chrome.tabs.onUpdated`. Manages icon state via `chrome.action.setIcon`. Routes messages. Only returns `true` from onMessage for GET_RESULT (async sendResponse). All other message types return `false`.

### Content Script (`entrypoints/content.ts`)

WXT `defineContentScript()`. Matches `<all_urls>`, runs at `document_idle`. Receives CHECK_PAGE, runs Effect detection pipeline, sends SCAN_RESULT back via `chrome.runtime.sendMessage`. Returns `false` from onMessage (does not use sendResponse). Guards against duplicate scans with `scanInProgress` flag.

## Module Dependency Graph

```
schemas.ts      <- single source of truth
errors.ts       <- Effect error types
patterns.ts     <- regex + weights (validated against schemas at startup)
scorer.ts       <- pure function (patterns + schemas)
detector.ts     <- Effect pipeline (schemas + errors + scorer)
cache.ts        <- Effect + chrome.storage.local + Zod
messages.ts     <- Zod validation wrapper
background.ts   <- orchestrator (cache + messages + icons)
content.ts      <- pipeline runner (detector + messages)
popup/store.ts  <- Zustand vanilla
popup/main.ts   <- store subscriber + DOM + chrome.tabs API
```

## Code Conventions

- Types inferred from Zod schemas, never duplicated
- Effect for I/O, plain TS for pure logic (scorer)
- `zustand/vanilla` only, no React bindings
- `Effect.runPromise()` at edges to bridge into Chrome callback world
- WXT globals `defineBackground()` / `defineContentScript()` -- don't import
- Icons in `public/` for WXT build
- `return true` in onMessage ONLY when sendResponse will be called (GET_RESULT only)
- `return false` for all other message handlers
- Content script communicates results via `chrome.runtime.sendMessage`, not `sendResponse`
- Popup uses `chrome.tabs.query` for active tab info, never `window.location`
- Popup uses `chrome.tabs.sendMessage(tabId, ...)` to reach content scripts
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
2. scorer.ts -- known page text samples with EU/non-EU company info, score verification
3. detector.ts -- Effect pipeline outputs via Effect.runPromise
4. patterns.ts -- regex compilation and matching against real-world legal page text
5. cache.ts -- mock chrome.storage.local, TTL, Zod validation on corrupted data
6. messages.ts -- accept good, reject bad

## Environment Variables

None. Zero config. Zero secrets.
