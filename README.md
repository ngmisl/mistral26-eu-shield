# EU Shield - GDPR Compliance Checker

![EU Shield Logo](icons/shield-green.svg)

**EU Shield** is a Chrome extension that automatically analyzes websites for GDPR compliance by detecting privacy policy signals and data protection indicators.

## Features

- ✅ **Automatic Analysis**: Scans websites on page load for GDPR compliance
- ✅ **Visual Indicators**: Green (compliant), Red (non-compliant), Grey (unknown) icons
- ✅ **Detailed Reports**: Popup shows compliance score, confidence level, and detected signals
- ✅ **Multi-language Support**: Detects patterns in English, German, French, Spanish, and Italian
- ✅ **Comprehensive Patterns**: 15 EU positive signals + 5 red flags
- ✅ **Smart Caching**: Results cached for 7 days to minimize re-analysis
- ✅ **Manual Re-scan**: One-click re-analysis of current page
- ✅ **Privacy Focused**: Zero external network calls, all analysis done locally

## Installation

### Development

```bash
# Clone the repository
git clone https://github.com/your-repo/eu-shield.git
cd eu-shield

# Install dependencies
bun install

# Start development server with hot-reloading
bun run dev
```

### Production Build

```bash
# Build for production
bun run build

# Create zip for Chrome Web Store
bun run zip
```

## Usage

1. **Automatic Analysis**: The extension automatically analyzes websites when you visit them
2. **Icon Indicators**:
   - 🟢 **Green**: Website appears GDPR compliant
   - 🔴 **Red**: Website has GDPR compliance issues
   - ⚪ **Grey**: No privacy policy detected or analysis incomplete
3. **View Details**: Click the extension icon to see detailed compliance report
4. **Re-scan**: Click "Re-scan Page" to manually re-analyze the current page

## Architecture

EU Shield uses a sophisticated multi-layered detection pipeline:

1. **URL Pattern Matching**: Instant detection of known privacy policy URLs
2. **Content Analysis**: DOM inspection for privacy-related content
3. **Path Probing**: Sequential fetching of common privacy policy paths
4. **Text Extraction**: HTML stripping and content normalization
5. **Pattern Matching**: Multi-language regex matching against 20 GDPR signals
6. **Scoring Engine**: Weighted scoring with conditional logic
7. **Result Caching**: 7-day persistent storage of analysis results

## GDPR Signals Detected

### ✅ EU Positive Signals (15)

- **GDPR Mention** (+10): General Data Protection Regulation references
- **Data Protection Officer** (+8): DPO contact information
- **Data Subject Rights** (+6-8): Access, rectification, erasure, portability, etc.
- **Legal Basis** (+7): Explicit mention of processing legal basis
- **EU Jurisdiction** (+6): European Union legal compliance
- **Retention Periods** (+5): Data storage time limits
- **Supervisory Authority** (+7): Regulatory contact information
- **Standard Contractual Clauses** (+5): International data transfer protections
- **Cookie Policy Detail** (+4): Comprehensive cookie information
- **ePrivacy Directive** (+4): ePrivacy regulation compliance

### ❌ Red Flag Signals (5)

- **US-only Jurisdiction** (-8): Exclusive US law governance
- **CCPA without GDPR** (-6): California-only compliance
- **Binding Arbitration** (-5): Mandatory arbitration clauses
- **Unprotected Transfers** (-6): Insecure international data transfers
- **Data Selling** (-4): User data monetization

## Technical Stack

- **Framework**: WXT (Chrome Extension Framework)
- **Language**: TypeScript
- **Runtime**: Bun
- **State Management**: Zustand/vanilla
- **Validation**: Zod (runtime schema validation)
- **Effects**: Effect (async pipeline composition)
- **UI**: @knadh/oat (semantic CSS framework)
- **Testing**: Vitest
- **Icons**: SVG with programmatic PNG generation

## Development Commands

```bash
bun run dev            # Development mode with HMR
bun run build          # Production build
bun run zip            # Create Chrome Web Store package
bun run typecheck      # TypeScript type checking
bun run test           # Run tests in watch mode
bun run test:run       # Run tests once
bun run icons          # Generate PNG icons from SVG
```

## Project Structure

```
eu-shield/
├── lib/                  # Core modules
│   ├── schemas.ts        # Zod schemas (single source of truth)
│   ├── patterns.ts        # GDPR patterns and regex
│   ├── scorer.ts          # Scoring engine
│   ├── detector.ts        # Detection pipeline
│   ├── cache.ts           # Caching layer
│   ├── messages.ts        # Message protocol
│   └── errors.ts          # Error types
├── entrypoints/          # Extension components
│   ├── background.ts      # Service worker
│   ├── content.ts         # Content script
│   └── popup/             # Popup UI
├── public/               # Generated assets
│   └── icon-*-*.png       # Icon files
├── icons/                # SVG source icons
├── scripts/              # Utility scripts
├── test/                 # Test suite
├── wxt.config.ts         # WXT configuration
└── package.json          # Project configuration
```

## Privacy & Security

EU Shield is designed with privacy as the top priority:

- 🔒 **Zero External Calls**: No network requests to external services
- 🚫 **No Telemetry**: Absolutely no tracking or analytics
- 📦 **Local Only**: All data stays in your browser
- 🗃️ **Limited Storage**: Only caches compliance results (no personal data)
- 🔄 **No Sync**: Cache is never synchronized across devices
- 🆓 **No Accounts**: No user accounts or sign-in required

## Testing

Run the comprehensive test suite:

```bash
bun run test:run
```

Tests cover:
- Pattern validation and matching
- Scoring logic and thresholds
- GDPR compliance detection
- Red flag identification
- Schema validation
- Type safety

## Contributing

Contributions are welcome! Please follow the existing code patterns and architecture.

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

[MIT License](LICENSE)

## Contact

For questions or support, please open an issue on GitHub.

---

**Disclaimer**: EU Shield provides automated analysis based on pattern matching. It is not a substitute for professional legal advice. Always consult with a GDPR expert for definitive compliance assessments.