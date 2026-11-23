import { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { translateIndexFailureReason } from './index-failure-reason';

const t = ((key: string, params?: Record<string, string>) =>
  params && Object.keys(params).length > 0 ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

describe('translateIndexFailureReason', () => {
  it('returns undefined for empty reasons', () => {
    expect(translateIndexFailureReason(null, t)).toBeUndefined();
    expect(translateIndexFailureReason(undefined, t)).toBeUndefined();
    expect(translateIndexFailureReason('   ', t)).toBeUndefined();
  });

  it('maps the unreachable LLM module reason', () => {
    expect(translateIndexFailureReason('LLM module is not reachable. Please try again later.', t)).toBe(
      'global.indexFailure.llmUnreachable',
    );
  });

  it('maps submission failures with the HTTP status', () => {
    expect(translateIndexFailureReason('Submission to LLM module failed (HTTP 503)', t)).toBe(
      'global.indexFailure.submissionFailed:{"status":"503"}',
    );
    expect(translateIndexFailureReason('Submission to LLM module failed (HTTP unknown)', t)).toBe(
      'global.indexFailure.submissionFailed:{"status":"unknown"}',
    );
  });

  it('maps timeouts with the minutes', () => {
    expect(translateIndexFailureReason('Indexing timed out after 15 minutes', t)).toBe(
      'global.indexFailure.timedOut:{"minutes":"15"}',
    );
  });

  it('maps outdated attempts', () => {
    expect(translateIndexFailureReason('Indexed content was overwritten by an older attempt. Please reindex.', t)).toBe(
      'global.indexFailure.outdated',
    );
  });

  it('falls back to the generic message for unknown reasons', () => {
    expect(translateIndexFailureReason('Something exploded in the vector store', t)).toBe(
      'global.indexFailure.generic',
    );
  });
});
