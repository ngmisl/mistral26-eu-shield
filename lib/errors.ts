import { Data } from 'effect';

// Probe Error
class ProbeError extends Data.TaggedError('ProbeError')<{
  path: string;
  reason: 'fetch_failed' | 'not_html' | 'read_failed' | 'too_short' | 'timeout';
}> {}

// Detection Error
class DetectionError extends Data.TaggedError('DetectionError')<{
  reason: 'no_url_match' | 'no_content_match' | 'no_pages_found';
}> {}

// Cache Error
class CacheError extends Data.TaggedError('CacheError')<{
  reason: 'read_failed' | 'write_failed' | 'validation_failed';
  domain: string;
}> {}

// Message Error
class MessageError extends Data.TaggedError('MessageError')<{
  reason: 'validation_failed' | 'send_failed';
  raw: unknown;
}> {}

export { ProbeError, DetectionError, CacheError, MessageError };