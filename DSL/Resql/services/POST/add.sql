INSERT INTO services (name, description, slot, examples, entities, discoverable, service_id, ruuter_type, current_state, structure)
VALUES (:name, :description, :slot, ARRAY[:examples]::text[], ARRAY[:entities]::text[], COALESCE(:discoverable::boolean, FALSE), :service_id, :ruuter_type::ruuter_request_type, :state::service_state, :structure::json);
