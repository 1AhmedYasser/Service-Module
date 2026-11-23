-- Marks the current attempt FAILED when the indexing flow stopped before recording a result
-- (e.g. the LLM module was unreachable and Ruuter aborted service-index-llm after the attempt started).
-- Only an attempt that is still IN_PROGRESS is changed; an already recorded result is never touched.
UPDATE services
SET llm_index_status = 'FAILED'::llm_index_status,
    llm_index_failure_reason = :failureReason::text
WHERE service_id = :serviceId
  AND llm_index_status = 'IN_PROGRESS'::llm_index_status
RETURNING service_id, llm_index_attempt_no;
