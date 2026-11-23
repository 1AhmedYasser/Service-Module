UPDATE services
SET
    name = :name,
    description = :description,
    slot = :slot,
    examples = ARRAY[:examples]::text[],
    entities = ARRAY[:entities]::text[],
    discoverable = COALESCE(:discoverable::boolean, discoverable),
    current_state = :state::service_state,
    structure = :structure::json,
    updated_at = NOW()
WHERE service_id = :id;
