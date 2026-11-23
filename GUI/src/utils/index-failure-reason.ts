import { TFunction } from 'i18next';

type ReasonMatcher = {
  readonly pattern: RegExp;
  readonly key: string;
  readonly params?: (match: RegExpMatchArray) => Record<string, string>;
};

const REASON_MATCHERS: ReasonMatcher[] = [
  { pattern: /^LLM module is not reachable\b/i, key: 'llmUnreachable' },
  {
    pattern: /^Submission to LLM module failed \(HTTP ([^)]*)\)/i,
    key: 'submissionFailed',
    params: (match) => ({ status: match[1] }),
  },
  {
    pattern: /^Indexing timed out after (\d+) minutes?/i,
    key: 'timedOut',
    params: (match) => ({ minutes: match[1] }),
  },
  { pattern: /^Indexed content was overwritten by an older attempt\b/i, key: 'outdated' },
];

export const translateIndexFailureReason = (reason: string | null | undefined, t: TFunction): string | undefined => {
  const trimmed = reason?.trim();
  if (!trimmed) return undefined;
  for (const { pattern, key, params } of REASON_MATCHERS) {
    const match = pattern.exec(trimmed);
    if (match) return t(`global.indexFailure.${key}`, params?.(match) ?? {});
  }
  return t('global.indexFailure.generic');
};
