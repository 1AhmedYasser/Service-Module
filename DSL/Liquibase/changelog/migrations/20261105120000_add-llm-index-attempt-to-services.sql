-- liquibase formatted sql

ALTER TABLE services
    ADD COLUMN llm_index_attempt_no     INTEGER     DEFAULT NULL,
    ADD COLUMN llm_index_failure_reason TEXT        DEFAULT NULL,
    ADD COLUMN llm_index_started_at     TIMESTAMPTZ DEFAULT NULL;
