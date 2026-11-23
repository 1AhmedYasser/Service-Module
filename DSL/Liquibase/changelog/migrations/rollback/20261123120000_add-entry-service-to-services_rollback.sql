-- liquibase formatted sql
-- rollback

ALTER TABLE services
    DROP COLUMN entry_service;
