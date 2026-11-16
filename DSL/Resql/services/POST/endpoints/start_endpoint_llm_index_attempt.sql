-- Starts a new LLM indexing attempt: IN_PROGRESS, next attempt number, clears previous failure reason.
-- The returned attempt number is sent to the LLM module and echoed back in its callback.
UPDATE endpoints
SET llm_index_status = 'IN_PROGRESS'::llm_index_status,
    llm_index_attempt_no = COALESCE(llm_index_attempt_no, 0) + 1,
    llm_index_failure_reason = NULL,
    llm_index_started_at = now()
WHERE endpoint_id = :endpointId::uuid
  AND deleted IS FALSE
RETURNING llm_index_attempt_no;
