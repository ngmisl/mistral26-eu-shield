import { describe, it, expect } from 'vitest';
import { scoreText } from '../lib/scorer';
import { patterns } from '../lib/patterns';
import { ScoringResultSchema } from '../lib/schemas';

describe('EU Shield Core Functionality', () => {
  it('should have 20 patterns (15 EU positive + 5 red flags)', () => {
    expect(patterns.length).toBe(20);
    const euPositive = patterns.filter(p => p.category === 'eu_positive');
    const redFlags = patterns.filter(p => p.category === 'red_flag');
    expect(euPositive.length).toBe(15);
    expect(redFlags.length).toBe(5);
  });

  it('should score GDPR-compliant text as green', () => {
    const gdprText = `
      We comply with the General Data Protection Regulation (GDPR) and the EU Datenschutz-Grundverordnung.
      Our Data Protection Officer (Datenschutzbeauftragte) can be contacted at dpo@example.com.
      You have the right to access, rectify, erase, restrict processing, object to processing, and data portability.
      Our legal basis for processing is your consent, and we follow GDPR requirements.
      Data retention periods are clearly defined and we operate under EU jurisdiction.
      You can contact the supervisory authority if needed.
      We use Standard Contractual Clauses for international transfers.
      Our cookie policy provides detailed information about data collection.
      We comply with ePrivacy Directive requirements.
    `;
    
    const result = scoreText({ text: gdprText });
    console.log('GDPR Test Result:', { score: result.score, status: result.status, signals: result.signals.length });
    expect(result.status).toBe('green');
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should score non-compliant text as red', () => {
    const badText = `
      We collect all your data and sell it to third parties.
      This is governed by US law only.
      No GDPR compliance here!
    `;
    
    const result = scoreText({ text: badText });
    expect(result.status).toBe('red');
    expect(result.score).toBeLessThan(10);
  });

  it('should score empty text as grey', () => {
    const result = scoreText({ text: '' });
    expect(result.status).toBe('grey');
    expect(result.score).toBe(0);
  });

  it('should validate scoring result schema', () => {
    const result = scoreText({ text: 'GDPR compliant privacy policy' });
    const validation = ScoringResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
  });

  it('should detect GDPR mention pattern', () => {
    const textWithGdpr = 'We are GDPR compliant and follow General Data Protection Regulation.';
    const result = scoreText({ text: textWithGdpr });
    const gdprSignal = result.signals.find(s => s.id === 'gdpr_mention');
    expect(gdprSignal).toBeDefined();
    expect(gdprSignal?.matchCount).toBeGreaterThan(0);
  });

  it('should detect red flag patterns', () => {
    const badText = 'We may sell your data to third parties. This agreement is governed by the laws of the United States and any disputes will be resolved in US courts.';
    const result = scoreText({ text: badText });
    console.log('Red Flag Test Result:', { signals: result.signals.map(s => ({ id: s.id, weight: s.weight })) });
    const usJurisdiction = result.signals.find(s => s.id === 'us_jurisdiction');
    const dataSelling = result.signals.find(s => s.id === 'data_selling');
    expect(usJurisdiction).toBeDefined();
    expect(dataSelling).toBeDefined();
    expect(usJurisdiction?.weight).toBeLessThan(0);
    expect(dataSelling?.weight).toBeLessThan(0);
  });
});