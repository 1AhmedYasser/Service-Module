-- Marks the current successful attempt as FAILED when an older attempt's late result overwrote its
-- indexed content. Only applies while that attempt is still the current one and SUCCESS, so a
-- newer attempt started in the meantime is never touched.
UPDATE services
SET llm_index_status = 'FAILED'::llm_index_status,
    llm_index_failure_reason = :failureReason::text
WHERE service_id = :serviceId
  AND llm_index_attempt_no = :attemptNo::integer
  AND llm_index_status = 'SUCCESS'::llm_index_status
RETURNING service_id;
