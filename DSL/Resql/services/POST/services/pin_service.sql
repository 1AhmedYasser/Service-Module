INSERT INTO user_pinned_service (user_id_code, service_id)
SELECT :user_id_code, :service_id
WHERE EXISTS (SELECT 1 FROM services WHERE service_id = :service_id AND NOT deleted)
ON CONFLICT (user_id_code, service_id) DO NOTHING;
