-- =============================================================================
-- Migration: 20261026000002_add_blood_request_fields
-- =============================================================================
-- Adds fields required by Phase 6 (Blood Request Management):
--   - patient_display_name: privacy-preserving patient name
--   - blood_component: optional component type (WHOLE_BLOOD, PLASMA, etc.)
--   - hospital_name: free-text hospital name (fallback when hospital not in directory)
--   - urgency: URGENT, NORMAL, FLEXIBLE
--   - contact_method: PHONE, EMAIL, IN_APP
--   - notes: additional notes (separate from contact_note)
--
-- All new fields are nullable or have defaults, so the migration is
-- non-destructive and backward-compatible with existing rows.
-- =============================================================================

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('URGENT', 'NORMAL', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "BloodComponent" AS ENUM ('WHOLE_BLOOD', 'PLASMA', 'PLATELETS', 'RED_BLOOD_CELLS');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('PHONE', 'EMAIL', 'IN_APP');

-- AlterTable: add new columns to blood_requests
ALTER TABLE "blood_requests" ADD COLUMN "patient_display_name" VARCHAR(120);
ALTER TABLE "blood_requests" ADD COLUMN "blood_component" "BloodComponent";
ALTER TABLE "blood_requests" ADD COLUMN "hospital_name" VARCHAR(180);
ALTER TABLE "blood_requests" ADD COLUMN "urgency" "UrgencyLevel" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "blood_requests" ADD COLUMN "contact_method" "ContactMethod" NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "blood_requests" ADD COLUMN "notes" TEXT;

-- CreateIndex: urgency + status for urgency-sorted listing
CREATE INDEX "blood_requests_urgency_idx" ON "blood_requests" ("urgency", "status", "created_at" DESC);
