-- liquibase formatted sql
-- rollback

ALTER TABLE services
    DROP COLUMN discoverable;
