CREATE OR REPLACE FUNCTION sync_service_dependency_edges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    DELETE FROM service_dependency_edges WHERE source_id = OLD.service_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN NULL;
  END IF;

  DELETE FROM service_dependency_edges WHERE source_id = NEW.service_id;

  INSERT INTO service_dependency_edges (source_id, target_id, target_name)
  SELECT NEW.service_id, d.target_id, d.target_name
  FROM extract_service_dependencies(NEW.structure) AS d;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS services_sync_dependency_edges ON services;
CREATE TRIGGER services_sync_dependency_edges
AFTER INSERT OR DELETE OR UPDATE OF structure, service_id ON services
FOR EACH ROW
EXECUTE FUNCTION sync_service_dependency_edges();
