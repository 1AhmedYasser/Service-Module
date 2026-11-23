SELECT llm_index_status,
       llm_index_attempt_no
FROM services
WHERE service_id = :serviceId
  AND deleted IS FALSE;
