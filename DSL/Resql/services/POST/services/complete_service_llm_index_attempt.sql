-- Records the final result of an indexing attempt.
-- Only the current attempt that is still IN_PROGRESS is updated, so late/stale/duplicate
-- results never overwrite a newer attempt. Returns no row when the result was ignored.
UPDATE services
SET llm_index_status = :status::llm_index_status,
    llm_index_failure_reason = CASE WHEN :status::text = 'FAILED' THEN NULLIF(:failureReason::text, '') ELSE NULL END
WHERE service_id = :serviceId
  AND llm_index_attempt_no = :attemptNo::integer
  AND llm_index_status = 'IN_PROGRESS'::llm_index_status
RETURNING service_id;
