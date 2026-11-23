WITH filtered AS (
  SELECT
    s.id,
    s.service_id,
    s.name,
    s.description,
    s.examples,
    s.entities,
    s.current_state,
    s.ruuter_type,
    s.slot,
    s.llm_index_status,
    s.llm_index_failure_reason,
    s.llm_index_attempt_no,
    s.updated_at,
    d_in.incoming_count,
    d_out.outgoing_count,
    d_out.outgoing_problems AS problem_count
  FROM services s
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
  WHERE NOT s.deleted
    AND (:search IS NULL OR :search = '' OR LOWER(s.name) LIKE LOWER('%' || :search || '%'))
    AND (:state IS NULL OR :state = '' OR s.current_state::TEXT = :state)
    AND (
      :dependencies IS NULL OR :dependencies = '' OR :dependencies = 'all'
      OR (:dependencies = 'yes' AND d_in.incoming_count + d_out.outgoing_count > 0)
      OR (:dependencies = 'no' AND d_in.incoming_count + d_out.outgoing_count = 0)
      OR (:dependencies = 'problematic' AND d_out.outgoing_problems > 0)
    )
    AND (
      :exclude_pinned_for IS NULL OR :exclude_pinned_for = ''
      OR NOT EXISTS (
        SELECT 1 FROM user_pinned_service p
        WHERE p.user_id_code = :exclude_pinned_for AND p.service_id = s.service_id
      )
    )
)
SELECT
  service_id,
  name,
  description,
  examples,
  entities,
  current_state AS state,
  ruuter_type AS type,
  slot,
  llm_index_status AS index_status,
  llm_index_failure_reason AS index_failure_reason,
  llm_index_attempt_no AS index_attempt_no,
  incoming_count,
  outgoing_count,
  problem_count,
  COUNT(*) OVER () AS total_count,
  CEIL(COUNT(*) OVER () / :page_size::DECIMAL) AS total_pages
FROM filtered
ORDER BY
  CASE WHEN :sorting = 'name asc' THEN name END ASC,
  CASE WHEN :sorting = 'name desc' THEN name END DESC,
  CASE WHEN :sorting = 'state asc' THEN current_state END ASC,
  CASE WHEN :sorting = 'state desc' THEN current_state END DESC,
  CASE WHEN :sorting = 'dependencies asc' THEN incoming_count + outgoing_count END ASC,
  CASE WHEN :sorting = 'dependencies desc' THEN incoming_count + outgoing_count END DESC,
  CASE WHEN :sorting = 'index asc' THEN llm_index_status END ASC NULLS LAST,
  CASE WHEN :sorting = 'index desc' THEN llm_index_status END DESC NULLS LAST,
  CASE WHEN :sorting = 'edited asc' THEN updated_at END ASC,
  CASE WHEN :sorting IS NULL OR :sorting = '' OR :sorting = 'edited desc' THEN updated_at END DESC,
  name ASC,
  id ASC
OFFSET ((GREATEST(:page, 1) - 1) * :page_size) LIMIT :page_size;
