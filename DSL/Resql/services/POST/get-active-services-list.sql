
SELECT service_id, name
FROM (
  SELECT DISTINCT ON (service_id) service_id, name, current_state
  FROM services
  WHERE NOT deleted
  ORDER BY service_id, id DESC
) latest
WHERE current_state = 'active'
ORDER BY name ASC;
