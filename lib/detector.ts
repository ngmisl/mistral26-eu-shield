import { Effect } from 'effect';
import { DetectionResultSchema, PageType } from './schemas';
import { DetectionError, ProbeError } from './errors';
import { scoreText } from './scorer';
import { z } from 'zod';

// URL patterns that indicate a relevant page (legal, about, contact)
const RELEVANT_URL_PATTERNS = [
  /\/about/,
  /\/company/,
  /\/contact/,
  /\/impressum/,
  /\/ueber-uns/,
  /\/terms/,
  /\/tos/,
  /\/privacy/,
  /\/privacy-policy/,
  /\/legal/,
  /\/legal-notice/,
  /\/cookie-policy/,
  /\/agb/,
  /\/datenschutz/,
  /\/cgv/,
  /\/aviso-legal/,
  /\/informativa-privacy/,
  /\/mentions-legales/,
  /\/politica-de-privacidad/,
  /\/politique-de-confidentialite/
];

// Known paths to probe — legal pages + company info pages
const KNOWN_PATHS = [
  // Company info (often contains registration, address, jurisdiction)
  '/about',
  '/about-us',
  '/company',
  '/contact',
  '/impressum',
  '/ueber-uns',
  // Legal pages
  '/terms',
  '/tos',
  '/privacy',
  '/privacy-policy',
  '/legal',
  '/legal-notice',
  '/cookie-policy',
  '/agb',
  '/datenschutz',
  '/cgv',
  '/aviso-legal',
  '/informativa-privacy',
  // Localized paths
  '/en/about',
  '/en/terms',
  '/en/privacy',
  '/en/legal',
  '/de/impressum',
  '/de/datenschutz',
  '/de/ueber-uns',
  '/fr/mentions-legales',
  '/fr/politique-de-confidentialite',
  '/es/aviso-legal',
  '/es/politica-de-privacidad',
  '/it/informativa-privacy'
];

// Strip HTML tags and clean text
function stripHtml(html: string): string {
  // Remove script, style, and navigation elements
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Cap at 50,000 characters
  return text.substring(0, 50000);
}

// Match current URL against known patterns
function matchCurrentUrl(url: string): Effect.Effect<z.infer<typeof DetectionResultSchema>, DetectionError> {
  return Effect.succeed(url).pipe(
    Effect.flatMap(url => {
      const match = RELEVANT_URL_PATTERNS.find(pattern => pattern.test(url));
      
      if (match) {
        // Determine page type based on URL pattern
        let pageType: z.infer<typeof PageType> | null = null;

        if (/terms|tos|agb|cgv/.test(url)) {
          pageType = 'tos';
        } else if (/privacy|datenschutz|informativa-privacy|politique/.test(url)) {
          pageType = 'privacy';
        } else if (/cookie/.test(url)) {
          pageType = 'cookie';
        } else {
          pageType = 'legal';
        }

        // Extract page text (we're in content script context)
        const pageText = typeof document !== 'undefined'
          ? stripHtml(document.body?.innerHTML || '')
          : '';

        return Effect.succeed(DetectionResultSchema.parse({
          detected: true,
          type: pageType,
          url,
          text: pageText
        }));
      }
      
      return Effect.fail(new DetectionError({ reason: 'no_url_match' }));
    })
  );
}

// Match page content for privacy indicators
function matchPageContent(): Effect.Effect<z.infer<typeof DetectionResultSchema>, DetectionError> {
  return Effect.tryPromise({
    try: (signal) => {
      return new Promise((resolve, reject) => {
        // Get page title and content
        const title = document.title;
        const h1 = document.querySelector('h1')?.textContent || '';
        const bodyPreview = document.body.textContent?.substring(0, 1000) || '';
        
        const content = `${title} ${h1} ${bodyPreview}`;
        
        // Check for privacy-related keywords
        const privacyKeywords = [
          'privacy', 'policy', 'terms', 'conditions', 'cookie',
          'datenschutz', 'politique de confidentialité', 'política de privacidad',
          'informativa sulla privacy', 'AVB', 'CGV', 'impressum'
        ];
        
        const hasPrivacyContent = privacyKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasPrivacyContent) {
          // Try to determine page type from content
          let pageType: z.infer<typeof PageType> | null = null;
          
          if (content.toLowerCase().includes('terms') || content.toLowerCase().includes('conditions')) {
            pageType = 'tos';
          } else if (content.toLowerCase().includes('privacy') || content.toLowerCase().includes('datenschutz')) {
            pageType = 'privacy';
          } else if (content.toLowerCase().includes('cookie')) {
            pageType = 'cookie';
          } else {
            pageType = 'legal';
          }
          
          resolve(DetectionResultSchema.parse({
            detected: true,
            type: pageType,
            url: window.location.href,
            text: content
          }));
        } else {
          reject(new DetectionError({ reason: 'no_content_match' }));
        }
      });
    },
    catch: error => {
      if (error instanceof DetectionError) {
        return error;
      }
      return new DetectionError({ reason: 'no_content_match' });
    }
  });
}

// Probe a single path
function probePath(baseUrl: string, path: string): Effect.Effect<string, ProbeError> {
  return Effect.tryPromise({
    try: async () => {
      const url = new URL(path, baseUrl).toString();
      
      // Set timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'text/html'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new ProbeError({ path, reason: 'fetch_failed' });
        }
        
        const contentType = response.headers.get('content-type') || '';
        
        if (!contentType.includes('text/html')) {
          throw new ProbeError({ path, reason: 'not_html' });
        }
        
        const html = await response.text();
        
        if (html.length < 100) { // Too short to be meaningful
          throw new ProbeError({ path, reason: 'too_short' });
        }
        
        return stripHtml(html);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof ProbeError) {
          throw error;
        }
        throw new ProbeError({ path, reason: 'fetch_failed' });
      }
    },
    catch: error => {
      if (error instanceof ProbeError) {
        return error;
      }
      return new ProbeError({ path, reason: 'fetch_failed' });
    }
  });
}

// Probe all known paths and collect all successful texts
function probeAllPaths(baseUrl: string): Effect.Effect<string[], never> {
  return Effect.gen(function*(_) {
    const texts: string[] = [];

    for (const path of KNOWN_PATHS) {
      const result = yield* _(
        probePath(baseUrl, path),
        Effect.orElse(() => Effect.succeed(null))
      );

      if (result) {
        texts.push(result);
      }
    }

    return texts;
  });
}

// Run detection and scoring pipeline
// Gathers text from the current page AND probed legal pages for comprehensive scoring.
export function runDetectionPipeline(url: string): Effect.Effect<{
  detection: z.infer<typeof DetectionResultSchema>;
  scoring: ReturnType<typeof scoreText>;
}, DetectionError> {
  return Effect.gen(function*(_) {
    const origin = new URL(url).origin;
    const domain = new URL(url).hostname;

    // Phase 1: Detect current page type + get its text
    const currentPage = yield* _(
      matchCurrentUrl(url),
      Effect.orElse(() => matchPageContent()),
      Effect.orElse(() => Effect.succeed(null))
    );

    // Phase 2: Probe all known paths for additional legal page text
    const probedTexts = yield* _(probeAllPaths(origin));

    // If nothing found anywhere, fail
    if (!currentPage && probedTexts.length === 0) {
      return yield* _(Effect.fail(new DetectionError({ reason: 'no_pages_found' })));
    }

    // Combine all text for scoring
    const allTexts: string[] = [];
    if (currentPage?.text) {
      allTexts.push(currentPage.text);
    }
    for (const t of probedTexts) {
      allTexts.push(t);
    }
    const combinedText = allTexts.join(' ').substring(0, 100000);

    const detection: z.infer<typeof DetectionResultSchema> = currentPage ?? {
      detected: true,
      type: null,
      url,
      text: combinedText
    };

    const scoring = scoreText({ text: combinedText, domain });

    return { detection: { ...detection, text: combinedText }, scoring };
  });
}

export { matchCurrentUrl, matchPageContent, probeAllPaths, stripHtml };