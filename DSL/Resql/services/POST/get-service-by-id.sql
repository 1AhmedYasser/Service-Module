SELECT
  id,
  name,
  description,
  slot,
  examples,
  entities,
  discoverable,
  entry_service,
  current_state AS state,
  ruuter_type AS type,
  structure::json,
  service_id
FROM services
WHERE service_id = :id
  AND NOT deleted;
