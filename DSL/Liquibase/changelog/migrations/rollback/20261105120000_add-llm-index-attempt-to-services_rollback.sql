-- liquibase formatted sql
-- rollback

ALTER TABLE services
    DROP COLUMN IF EXISTS llm_index_attempt_no,
    DROP COLUMN IF EXISTS llm_index_failure_reason,
    DROP COLUMN IF EXISTS llm_index_started_at;
