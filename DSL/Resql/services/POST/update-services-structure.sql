UPDATE services AS s
SET structure = t.structure
FROM UNNEST(
    ARRAY[:names]::text[],
    ARRAY[:structures]::json[]
) AS t(name, structure)
WHERE s.name = t.name
  AND NOT s.deleted;
