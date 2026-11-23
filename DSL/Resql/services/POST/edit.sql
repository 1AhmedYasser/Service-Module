UPDATE services
SET
    name = :name,
    description = :description,
    slot = :slot,
    examples = ARRAY[:examples]::text[],
    entities = ARRAY[:entities]::text[],
    discoverable = COALESCE(:discoverable::boolean, discoverable),
    entry_service = COALESCE(:entry_service::boolean, entry_service),
    current_state = :state::service_state,
    structure = :structure::json,
    updated_at = NOW()
WHERE service_id = :id;
