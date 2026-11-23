-- Marks indexing attempts that have been IN_PROGRESS for longer than 15 minutes as FAILED.
-- 15 minutes covers CronManager queueing, package install, LLM context generation (with retries)
-- and embedding calls. A late callback for a timed-out attempt is ignored (status no longer IN_PROGRESS).
UPDATE endpoints
SET llm_index_status = 'FAILED'::llm_index_status,
    llm_index_failure_reason = 'Indexing timed out after 15 minutes'
WHERE llm_index_status = 'IN_PROGRESS'::llm_index_status
  AND llm_index_started_at IS NOT NULL
  AND llm_index_started_at < now() - INTERVAL '15 minutes'
RETURNING endpoint_id, llm_index_attempt_no;
