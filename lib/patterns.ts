import { z } from 'zod';
import { PatternSchema } from './schemas';

// All 27 EU member states + EEA
const EU_COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus',
  'Czech Republic', 'Czechia', 'Denmark', 'Estonia', 'Finland',
  'France', 'Germany', 'Greece', 'Hungary', 'Ireland',
  'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta',
  'Netherlands', 'Holland', 'Poland', 'Portugal', 'Romania',
  'Slovakia', 'Slovenia', 'Spain', 'Sweden',
  // EEA
  'Norway', 'Iceland', 'Liechtenstein',
  // Native language names commonly found in legal text
  'Deutschland', 'Österreich', 'Schweiz', 'España', 'Italia',
  'France', 'Nederland', 'Polska', 'România', 'Eesti',
  'Suomi', 'Sverige', 'Danmark', 'Ελλάδα', 'Magyarország',
  'Česká republika', 'Slovensko', 'Slovenija', 'Hrvatska',
  'Latvija', 'Lietuva', 'Κύπρος', 'Malta'
];

const EU_COUNTRY_GROUP = EU_COUNTRIES.join('|');

// EU Positive Signals — indicators that the service is EU-based
const euPositivePatterns: z.infer<typeof PatternSchema>[] = [
  {
    id: 'eu_jurisdiction',
    category: 'eu_positive',
    label: 'EU Jurisdiction',
    weight: 15,
    patterns: [
      new RegExp(`\\b(?:governed by|subject to|under)\\s+(?:the\\s+)?laws?\\s+(?:of\\s+)?(?:the\\s+)?(?:country\\s+of\\s+)?(?:${EU_COUNTRY_GROUP})\\b`, 'gi'),
      new RegExp(`\\bjurisdiction\\s+(?:of\\s+)?(?:the\\s+)?(?:courts?\\s+(?:of|in)\\s+)?(?:${EU_COUNTRY_GROUP})\\b`, 'gi'),
      new RegExp(`\\b(?:applicable|governing)\\s+law[:\\s]+(?:${EU_COUNTRY_GROUP})\\b`, 'gi')
    ],
    description: 'Legal jurisdiction in an EU/EEA country'
  },
  {
    id: 'eu_registered',
    category: 'eu_positive',
    label: 'EU Registration',
    weight: 15,
    patterns: [
      new RegExp(`\\b(?:registered|incorporated|established|organized)\\s+(?:in|under the laws of)\\s+(?:${EU_COUNTRY_GROUP})\\b`, 'gi'),
      new RegExp(`\\b(?:company|entity|organization|organisation)\\s+(?:registered|based|located)\\s+in\\s+(?:${EU_COUNTRY_GROUP})\\b`, 'gi')
    ],
    description: 'Company registered in an EU/EEA country'
  },
  {
    id: 'eu_headquarters',
    category: 'eu_positive',
    label: 'EU Headquarters',
    weight: 12,
    patterns: [
      new RegExp(`\\b(?:headquartered|based|located|situated|offices?)\\s+in\\s+(?:${EU_COUNTRY_GROUP})\\b`, 'gi'),
      new RegExp(`\\b(?:head\\s*office|principal\\s+(?:place|office)|registered\\s+(?:office|address))[:\\s]+.*?(?:${EU_COUNTRY_GROUP})\\b`, 'gi')
    ],
    description: 'Headquarters or office in an EU/EEA country'
  },
  {
    id: 'eu_vat',
    category: 'eu_positive',
    label: 'EU VAT Number',
    weight: 15,
    patterns: [
      // EU VAT number formats: 2-letter country code + 7-12 alphanumeric chars
      /\b(?:VAT|USt-?Id(?:Nr)?|TVA|IVA|BTW|NIP|UID|MOMS|ALV|ΑΦΜ|ÁFA)[:\s]?\s*(?:(?:Nr|No|number|numéro|numero|nummer)?[.:\s]?\s*)?[A-Z]{2}\s?\d{7,12}\b/gi,
      /\b(?:AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|EL|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE)\s?[A-Z0-9]{7,12}\b/g
    ],
    description: 'EU VAT identification number'
  },
  {
    id: 'eu_company_reg',
    category: 'eu_positive',
    label: 'EU Company Registry',
    weight: 12,
    patterns: [
      // German
      /\bHandelsregister\b/gi,
      /\b(?:HRB|HRA)\s?\d{3,}/gi,
      /\bAmtsgericht\b/gi,
      // French
      /\bRCS\s+\w+\s+\d{3}/gi,
      /\bSIRET\s*[:\s]?\s*\d{14}\b/gi,
      /\bSIREN\s*[:\s]?\s*\d{9}\b/gi,
      // Spanish
      /\bRegistro\s+Mercantil\b/gi,
      /\b[CcNn][Ii][Ff]\s*[:\s]?\s*[A-Z]\d{7,8}/gi,
      // Italian
      /\bRegistro\s+delle\s+Imprese\b/gi,
      /\bP\.?\s*IVA\s*[:\s]?\s*\d{11}\b/gi,
      /\bPartita\s+IVA\b/gi,
      // Dutch
      /\bKvK\s*[:\s]?\s*\d{8}\b/gi,
      /\bKamer\s+van\s+Koophandel\b/gi,
      // Estonian
      /\b(?:Äriregistri?\s+kood|registry\s+code)\s*[:\s]?\s*\d{7,8}\b/gi,
      // Generic EU
      /\bcompany\s+(?:registration|reg\.?)\s*(?:number|no\.?|nr\.?|#)?\s*[:\s]?\s*\d{5,}/gi
    ],
    description: 'EU company registry or registration number'
  },
  {
    id: 'eu_country_address',
    category: 'eu_positive',
    label: 'EU Country in Address',
    weight: 8,
    patterns: [
      // EU country appearing near postal/zip code patterns or in address-like context
      new RegExp(`\\b\\d{4,5}\\s+\\w+[,\\s]+(?:${EU_COUNTRY_GROUP})\\b`, 'gi'),
      new RegExp(`\\b(?:${EU_COUNTRY_GROUP})\\s*$`, 'gim'), // Country at end of line (address format)
    ],
    description: 'EU country mentioned in address context'
  },
  {
    id: 'eu_country_mention',
    category: 'eu_positive',
    label: 'EU Country Mention',
    weight: 5,
    patterns: [
      // Broad match — EU country name anywhere in legal text (lower weight)
      new RegExp(`\\b(?:${EU_COUNTRY_GROUP})\\b`, 'gi')
    ],
    description: 'EU/EEA country mentioned in page content'
  },
  {
    id: 'impressum',
    category: 'eu_positive',
    label: 'Impressum',
    weight: 10,
    patterns: [
      /\bImpressum\b/gi,
      /\bAngaben\s+gemäß\s+§\s*5\s+TMG\b/gi,
      /\bTelemediengesetz\b/gi,
      /\bMediengesetz\b/gi
    ],
    description: 'German/Austrian legal disclosure page (Impressum)'
  },
  {
    id: 'eu_consumer',
    category: 'eu_positive',
    label: 'EU Consumer Rights',
    weight: 8,
    patterns: [
      /\bEuropean Union consumer/gi,
      /\bEU consumer/gi,
      /\bconsumer\s+rights?\s+(?:under|in)\s+(?:the\s+)?EU\b/gi,
      /\bmandatory\s+provisions\s+of\s+the\s+law\b/gi,
      /\bcountry\s+(?:of|in\s+which)\s+(?:you\s+are|your?)\s+residen/gi
    ],
    description: 'EU consumer protection language'
  },
  {
    id: 'gdpr_mention',
    category: 'eu_positive',
    label: 'GDPR Mention',
    weight: 6,
    patterns: [
      /\bGDPR\b/g,
      /\bGeneral\s+Data\s+Protection\s+Regulation\b/gi,
      /\bDatenschutz-Grundverordnung\b/gi,
      /\bRGPD\b/g,
      /\bDSGVO\b/g
    ],
    description: 'Mentions GDPR (indicates EU regulatory awareness)'
  },
  {
    id: 'eu_data_authority',
    category: 'eu_positive',
    label: 'EU Data Authority',
    weight: 8,
    patterns: [
      /\bData\s+Protection\s+Officer\b/gi,
      /\bDatenschutzbeauftragte[r]?\b/gi,
      /\bsupervisory\s+authority\b/gi,
      /\bAufsichtsbehörde\b/gi,
      /\bData\s+Protection\s+Authority\b/gi,
      /\bData\s+Protection\s+Commission\b/gi,
      /\bCNIL\b/g,
      /\bBfDI\b/g,
      /\bAEPD\b/g,
      /\bGarante\b/gi
    ],
    description: 'References EU data protection authority or officer'
  }
];

// Red Flag Signals — indicators that the service is NOT EU-based
const redFlagPatterns: z.infer<typeof PatternSchema>[] = [
  {
    id: 'us_jurisdiction',
    category: 'red_flag',
    label: 'US Jurisdiction',
    weight: -12,
    patterns: [
      /\bgoverned\s+by\s+(?:the\s+)?laws?\s+of\s+(?:the\s+)?(?:State\s+of\s+)?(?:California|Delaware|New York|Texas|Florida|Nevada|Washington|Oregon|Virginia|Georgia|Illinois|Massachusetts|Colorado|Arizona|North Carolina|Pennsylvania|Ohio|Michigan|New Jersey|Maryland|Utah|Connecticut|Wyoming)/gi,
      /\bjurisdiction\s+(?:of\s+)?(?:the\s+)?(?:State\s+of\s+)?(?:California|Delaware|New York|Texas|Florida|Nevada|Washington)/gi,
      /\bgoverned\s+by\s+(?:the\s+)?laws?\s+of\s+(?:the\s+)?United\s+States/gi
    ],
    description: 'US state/federal jurisdiction'
  },
  {
    id: 'us_registered',
    category: 'red_flag',
    label: 'US Registration',
    weight: -12,
    patterns: [
      /\b(?:registered|incorporated|organized)\s+in\s+(?:the\s+)?(?:State\s+of\s+)?(?:Delaware|California|Nevada|Wyoming|New York|Texas|Florida|Washington)/gi,
      /\bDelaware\s+(?:corporation|LLC|company|entity)\b/gi
    ],
    description: 'Company registered in a US state'
  },
  {
    id: 'non_eu_hq',
    category: 'red_flag',
    label: 'Non-EU Headquarters',
    weight: -8,
    patterns: [
      /\b(?:headquartered|based|located)\s+in\s+(?:the\s+)?(?:United States|USA|U\.S\.A?\.|United Kingdom|UK|China|India|Japan|Singapore|Australia|Canada|Brazil|Israel)\b/gi
    ],
    description: 'Headquarters in a non-EU country'
  },
  {
    id: 'binding_arbitration',
    category: 'red_flag',
    label: 'Binding Arbitration',
    weight: -4,
    patterns: [
      /\bbinding\s+arbitration\b/gi,
      /\bmandatory\s+arbitration\b/gi
    ],
    description: 'Mandatory binding arbitration (uncommon in EU)'
  }
];

const allPatterns = [...euPositivePatterns, ...redFlagPatterns];

// Validate all patterns against schema at startup
function validatePatterns(): void {
  allPatterns.forEach(pattern => {
    try {
      PatternSchema.parse(pattern);
    } catch (error) {
      console.error('Invalid pattern configuration:', pattern.id, error);
      throw error;
    }
  });
}

validatePatterns();

export { allPatterns as patterns };
export { euPositivePatterns, redFlagPatterns };
