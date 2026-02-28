import { z } from 'zod';

// Compliance Status
const ComplianceStatus = z.enum(['green', 'red', 'grey']);

// Page Type
const PageType = z.enum(['tos', 'privacy', 'cookie', 'legal']);

// Signal Category
const SignalCategory = z.enum(['eu_positive', 'red_flag']);

// Pattern Schema
const PatternSchema = z.object({
  id: z.string(),
  category: SignalCategory,
  label: z.string(),
  weight: z.number(),
  patterns: z.array(z.instanceof(RegExp)),
  description: z.string()
});

// Matched Signal Schema
const MatchedSignalSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: SignalCategory,
  weight: z.number(),
  description: z.string(),
  matchCount: z.number()
});

// Detection Result Schema
const DetectionResultSchema = z.object({
  detected: z.boolean(),
  type: PageType.nullable(),
  url: z.string(),
  text: z.string()
});

// Scoring Result Schema
const ScoringResultSchema = z.object({
  score: z.number(),
  status: ComplianceStatus,
  confidence: z.number().min(0).max(100),
  signals: z.array(MatchedSignalSchema),
  totalPossibleSignals: z.number()
});

// Cached Result Schema
const CachedResultSchema = z.object({
  domain: z.string(),
  score: z.number(),
  status: ComplianceStatus,
  confidence: z.number().min(0).max(100),
  signals: z.array(MatchedSignalSchema),
  analyzedUrl: z.string(),
  timestamp: z.number()
});

// Extension Message Types
const CheckPageMessage = z.object({
  type: z.literal('CHECK_PAGE'),
  domain: z.string()
});

const ScanResultMessage = z.object({
  type: z.literal('SCAN_RESULT'),
  domain: z.string(),
  result: ScoringResultSchema,
  url: z.string()
});

const GetResultMessage = z.object({
  type: z.literal('GET_RESULT'),
  domain: z.string()
});

const ForceRescanMessage = z.object({
  type: z.literal('FORCE_RESCAN'),
  domain: z.string()
});

// Extension Message Union
const ExtensionMessage = z.discriminatedUnion('type', [
  CheckPageMessage,
  ScanResultMessage,
  GetResultMessage,
  ForceRescanMessage
]);

export {
  ComplianceStatus,
  PageType,
  SignalCategory,
  PatternSchema,
  MatchedSignalSchema,
  DetectionResultSchema,
  ScoringResultSchema,
  CachedResultSchema,
  ExtensionMessage
};

export type {
  ComplianceStatus as ComplianceStatusType,
  PageType as PageTypeType,
  SignalCategory as SignalCategoryType,
  PatternSchema as PatternSchemaType,
  MatchedSignalSchema as MatchedSignalSchemaType,
  DetectionResultSchema as DetectionResultSchemaType,
  ScoringResultSchema as ScoringResultSchemaType,
  CachedResultSchema as CachedResultSchemaType,
  ExtensionMessage as ExtensionMessageType
};