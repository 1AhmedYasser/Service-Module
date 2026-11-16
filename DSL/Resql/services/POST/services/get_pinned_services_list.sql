SELECT
  s.service_id,
  s.name,
  s.description,
  s.examples,
  s.entities,
  s.current_state AS state,
  s.ruuter_type AS type,
  s.slot,
  s.llm_index_status AS index_status,
  s.llm_index_failure_reason AS index_failure_reason,
  s.llm_index_attempt_no AS index_attempt_no,
  d_in.incoming_count,
  d_out.outgoing_count,
  d_out.outgoing_problems AS problem_count
FROM user_pinned_service p
JOIN services s ON s.service_id = p.service_id AND NOT s.deleted
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS incoming_count
  FROM service_dependency_edges e
  JOIN services src ON src.service_id = e.source_id AND NOT src.deleted
  WHERE e.target_id = s.service_id
) d_in ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS outgoing_count, COUNT(*) FILTER (WHERE tgt.service_id IS NULL OR tgt.deleted) AS outgoing_problems
  FROM service_dependency_edges e
  LEFT JOIN services tgt ON tgt.service_id = e.target_id
  WHERE e.source_id = s.service_id
) d_out ON TRUE
WHERE p.user_id_code = :user_id_code
  AND (:search IS NULL OR :search = '' OR LOWER(s.name) LIKE LOWER('%' || :search || '%'))
  AND (:state IS NULL OR :state = '' OR s.current_state::TEXT = :state)
  AND (
    :dependencies IS NULL OR :dependencies = '' OR :dependencies = 'all'
    OR (:dependencies = 'yes' AND d_in.incoming_count + d_out.outgoing_count > 0)
    OR (:dependencies = 'no' AND d_in.incoming_count + d_out.outgoing_count = 0)
    OR (:dependencies = 'problematic' AND d_out.outgoing_problems > 0)
  )
ORDER BY
  CASE WHEN :sorting = 'name asc' THEN s.name END ASC,
  CASE WHEN :sorting = 'name desc' THEN s.name END DESC,
  CASE WHEN :sorting = 'state asc' THEN s.current_state END ASC,
  CASE WHEN :sorting = 'state desc' THEN s.current_state END DESC,
  CASE WHEN :sorting = 'dependencies asc' THEN d_in.incoming_count + d_out.outgoing_count END ASC,
  CASE WHEN :sorting = 'dependencies desc' THEN d_in.incoming_count + d_out.outgoing_count END DESC,
  CASE WHEN :sorting = 'index asc' THEN s.llm_index_status END ASC NULLS LAST,
  CASE WHEN :sorting = 'index desc' THEN s.llm_index_status END DESC NULLS LAST,
  CASE WHEN :sorting = 'edited asc' THEN s.updated_at END ASC,
  CASE WHEN :sorting = 'edited desc' THEN s.updated_at END DESC,
  s.name ASC,
  s.id ASC;
