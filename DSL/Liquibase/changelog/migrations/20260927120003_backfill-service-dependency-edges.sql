INSERT INTO service_dependency_edges (source_id, target_id, target_name)
SELECT s.service_id, d.target_id, d.target_name
FROM services s
CROSS JOIN LATERAL extract_service_dependencies(s.structure) AS d
ON CONFLICT (source_id, target_id) DO NOTHING;
