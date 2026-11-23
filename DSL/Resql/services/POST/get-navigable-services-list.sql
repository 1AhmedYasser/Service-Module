
SELECT service_id, name, current_state AS state
FROM (
  SELECT DISTINCT ON (service_id) service_id, name, current_state
  FROM services
  WHERE NOT deleted
  ORDER BY service_id, id DESC
) latest
WHERE current_state IN ('active', 'ready', 'draft')
ORDER BY name ASC;
