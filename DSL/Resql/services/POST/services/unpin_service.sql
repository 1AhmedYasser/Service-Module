DELETE FROM user_pinned_service
WHERE user_id_code = :user_id_code AND service_id = :service_id;
