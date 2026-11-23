-- liquibase formatted sql

ALTER TABLE services
    ADD COLUMN discoverable BOOLEAN NOT NULL DEFAULT FALSE;
