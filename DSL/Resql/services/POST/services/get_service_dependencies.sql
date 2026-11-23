SELECT *
FROM (
  SELECT
    'incoming' AS direction,
    e.source_id AS service_id,
    s.name,
    s.current_state AS state,
    s.ruuter_type AS type,
    s.deleted AS deleted,
    (
      SELECT COUNT(*) FROM service_dependency_edges x
      JOIN services xs ON xs.service_id = x.source_id AND NOT xs.deleted
      WHERE x.target_id = e.source_id
    ) AS incoming_count,
    (SELECT COUNT(*) FROM service_dependency_edges x WHERE x.source_id = e.source_id) AS outgoing_count
  FROM service_dependency_edges e
  JOIN services s ON s.service_id = e.source_id AND NOT s.deleted
  WHERE e.target_id = :service_id

  UNION ALL

  SELECT
    'outgoing' AS direction,
    e.target_id AS service_id,
    COALESCE(t.name, NULLIF(e.target_name, ''), e.target_id) AS name,
    t.current_state AS state,
    t.ruuter_type AS type,
    (t.service_id IS NULL OR t.deleted) AS deleted,
    (
      SELECT COUNT(*) FROM service_dependency_edges x
      JOIN services xs ON xs.service_id = x.source_id AND NOT xs.deleted
      WHERE x.target_id = e.target_id
    ) AS incoming_count,
    (SELECT COUNT(*) FROM service_dependency_edges x WHERE x.source_id = e.target_id) AS outgoing_count
  FROM service_dependency_edges e
  LEFT JOIN services t ON t.service_id = e.target_id
  WHERE e.source_id = :service_id
) dependencies
ORDER BY direction, deleted DESC, name ASC;
