# EU Shield

**EU Shield** is a Chrome extension that detects whether online services are EU/EEA-based. It scans legal, about, and contact pages for jurisdiction, registration, and company location signals -- all locally, with zero external network calls.

- Green = EU-based service
- Red = Non-EU service
- Grey = Cannot determine

## Features

- Automatic analysis on page load
- Green / Red / Grey icon in the toolbar
- Popup with score, confidence, and signal breakdown
- Multi-language pattern matching (EN, DE, FR, ES, IT)
- 11 EU positive signals + 4 red flag signals
- Domain TLD bonus for EU country-code domains
- Results cached for 7 days
- One-click re-scan
- Zero external calls, zero telemetry, zero accounts

## Installation

### Development

```bash
bun install
bun run dev
```

### Production

```bash
bun run build
bun run zip     # Package for Chrome Web Store
```

## Usage

1. Visit any website -- the extension analyzes it automatically
2. Check the toolbar icon:
   - Green: EU/EEA-based service
   - Red: Non-EU service
   - Grey: Not enough information to determine
3. Click the icon for a detailed breakdown of detected signals
4. Hit "Re-scan Page" to force a fresh analysis

## How It Works

EU Shield probes legal and company pages on the current domain and scores the combined text:

1. **Current page detection** -- checks if you're already on a legal/about/contact page
2. **Path probing** -- fetches ~30 known paths (/about, /impressum, /terms, /privacy, /contact, localized variants)
3. **Text extraction** -- strips HTML, scripts, and navigation; normalizes whitespace
4. **Signal matching** -- multi-language regex patterns against the combined corpus
5. **Scoring** -- weighted signals with domain TLD bonus
6. **Caching** -- 7-day local cache per domain

## Signals

### EU Positive

| Signal | Weight | What it detects |
|--------|--------|-----------------|
| EU Jurisdiction | +15 | "governed by laws of [EU country]" |
| EU Registration | +15 | "registered/incorporated in [EU country]" |
| EU VAT Number | +15 | EU VAT format (country code + digits) |
| EU Headquarters | +12 | "headquartered/based in [EU country]" |
| EU Company Registry | +12 | Handelsregister, RCS/SIRET, KvK, Registro Mercantil, etc. |
| Impressum | +10 | German/Austrian legal disclosure page |
| EU Consumer Rights | +8 | "European Union consumer", mandatory provisions |
| EU Data Authority | +8 | DPO, supervisory authority, CNIL, BfDI, AEPD |
| EU Country in Address | +8 | Postal code + EU country in address context |
| GDPR Mention | +6 | References to GDPR / DSGVO / RGPD |
| EU Country Mention | +5 | Any EU/EEA country name in legal text |
| EU Domain TLD | +5 | .de, .fr, .ee, .nl, .eu, etc. |

### Red Flags

| Signal | Weight | What it detects |
|--------|--------|-----------------|
| US Jurisdiction | -12 | "governed by laws of California/Delaware/etc." |
| US Registration | -12 | "incorporated in Delaware/Nevada/etc." |
| Non-EU Headquarters | -8 | "based in USA/UK/China/etc." |
| Binding Arbitration | -4 | Mandatory arbitration (uncommon in EU) |

### Thresholds

- Score >= 15: Green (EU-based)
- Score <= -5: Red (non-EU)
- Between: Grey (uncertain)

## Tech Stack

- **Framework**: WXT (Manifest V3 Chrome Extension)
- **Language**: TypeScript
- **Runtime**: Bun
- **State**: Zustand/vanilla
- **Validation**: Zod
- **Async**: Effect
- **UI**: @knadh/oat
- **Testing**: Vitest

## Commands

```bash
bun run dev            # Dev mode with HMR
bun run build          # Production build
bun run zip            # Chrome Web Store package
bun run typecheck      # TypeScript check
bun run test           # Vitest watch
bun run test:run       # Single run
```

## Project Structure

```
eu-shield/
  lib/
    schemas.ts        # Zod schemas (single source of truth)
    patterns.ts       # EU-based detection signals (regex + weights)
    scorer.ts         # Scoring engine
    detector.ts       # Effect-based detection pipeline
    cache.ts          # chrome.storage.local caching
    messages.ts       # Message protocol with Zod validation
    errors.ts         # Tagged error types for Effect
  entrypoints/
    background.ts     # Service worker
    content.ts        # Content script
    popup/            # Popup UI (vanilla TS + Oat)
  public/
    icon-*-*.png      # Toolbar icons (green/red/grey)
  wxt.config.ts       # WXT + manifest config
```

## Privacy

- Zero network calls to external services
- Zero telemetry, analytics, or tracking
- All data stays in the browser
- Cache is local only, never synced
- No accounts, no sign-in
- Minimal permissions (activeTab + storage)
- All analysis is deterministic regex matching on locally extracted text
- Open source

## License

[MIT License](LICENSE)

---

EU Shield provides automated analysis based on pattern matching. It is not legal advice.
