SELECT llm_index_status,
       llm_index_attempt_no
FROM endpoints
WHERE endpoint_id = :endpointId::uuid
  AND deleted IS FALSE;
