CREATE OR REPLACE FUNCTION extract_service_dependencies(flow_structure JSON)
RETURNS TABLE (target_id TEXT, target_name TEXT)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT DISTINCT ON (node -> 'data' -> 'jumpToService' ->> 'serviceId')
    node -> 'data' -> 'jumpToService' ->> 'serviceId',
    NULLIF(node -> 'data' -> 'jumpToService' ->> 'serviceName', '')
  FROM json_array_elements(
    CASE WHEN json_typeof(flow_structure -> 'nodes') = 'array' THEN flow_structure -> 'nodes' ELSE '[]'::JSON END
  ) AS node
  WHERE node ->> 'type' = 'custom'
    AND node -> 'data' ->> 'stepType' = 'jump-to-service'
    AND COALESCE(node -> 'data' -> 'jumpToService' ->> 'serviceId', '') <> '';
$$;
