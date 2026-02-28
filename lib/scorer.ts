import { patterns } from './patterns';
import { ScoringResultSchema, MatchedSignalSchema } from './schemas';
import { z } from 'zod';

// EU/EEA country-code TLDs
const EU_TLDS = new Set([
  'eu', 'at', 'be', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fi',
  'fr', 'de', 'gr', 'hu', 'ie', 'it', 'lv', 'lt', 'lu', 'mt',
  'nl', 'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se',
  // EEA
  'no', 'is', 'li'
]);

interface ScoringOptions {
  text: string;
  domain?: string;
}

export function scoreText({ text, domain }: ScoringOptions): z.infer<typeof ScoringResultSchema> {
  const matchedSignals: z.infer<typeof MatchedSignalSchema>[] = [];

  // Match all patterns against text
  patterns.forEach(pattern => {
    let matchCount = 0;

    pattern.patterns.forEach(regex => {
      const matches = text.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    });

    if (matchCount > 0) {
      matchedSignals.push({
        id: pattern.id,
        label: pattern.label,
        category: pattern.category,
        weight: pattern.weight,
        description: pattern.description,
        matchCount
      });
    }
  });

  let score = matchedSignals.reduce((sum, signal) => sum + signal.weight, 0);

  // Domain TLD bonus: if the domain uses an EU country-code TLD
  if (domain) {
    const tld = domain.split('.').pop()?.toLowerCase();
    if (tld && EU_TLDS.has(tld)) {
      score += 5;
      matchedSignals.push({
        id: 'eu_tld',
        label: 'EU Domain TLD',
        category: 'eu_positive',
        weight: 5,
        description: `Domain uses .${tld} (EU/EEA country TLD)`,
        matchCount: 1
      });
    }
  }

  // Calculate confidence based on how many positive signals were found
  const totalPossibleSignals = patterns.filter(p => p.category === 'eu_positive').length + 1; // +1 for TLD
  const positiveSignalsFound = matchedSignals.filter(s => s.category === 'eu_positive').length;
  const confidence = Math.round((positiveSignalsFound / totalPossibleSignals) * 100);

  // Determine status
  let status: 'green' | 'red' | 'grey' = 'grey';

  if (score >= 15) {
    status = 'green';
  } else if (score <= -5) {
    status = 'red';
  }
  // Between -5 and 15: grey (uncertain)

  // No text → can't determine
  if (text.length === 0) {
    status = 'grey';
    score = 0;
  }

  return ScoringResultSchema.parse({
    score,
    status,
    confidence,
    signals: matchedSignals,
    totalPossibleSignals
  });
}
