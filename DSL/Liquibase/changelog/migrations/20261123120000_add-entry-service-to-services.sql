-- liquibase formatted sql

ALTER TABLE services
    ADD COLUMN entry_service BOOLEAN NOT NULL DEFAULT FALSE;
