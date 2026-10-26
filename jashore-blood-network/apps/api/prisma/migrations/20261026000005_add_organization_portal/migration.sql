-- Migration: 20261026000005_add_organization_portal
-- Adds organization membership, verification reviews, and coordination records.

-- AlterEnum: extend VerificationStatus with new values
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- CreateEnum: OrganizationMemberRole
CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum: OrganizationCoordinationStatus
CREATE TYPE "OrganizationCoordinationStatus" AS ENUM ('NOTIFIED', 'RESPONDED', 'COORDINATING', 'UNABLE_TO_HELP');

-- AlterTable: add organization fields to hospitals
ALTER TABLE "hospitals" ADD COLUMN "email" VARCHAR(255);
ALTER TABLE "hospitals" ADD COLUMN "website" VARCHAR(255);
ALTER TABLE "hospitals" ADD COLUMN "verification_feedback" TEXT;
ALTER TABLE "hospitals" ADD COLUMN "verification_reviewed_at" TIMESTAMP(3);
ALTER TABLE "hospitals" ADD COLUMN "verification_reviewed_by" UUID;
ALTER TABLE "hospitals" ADD COLUMN "verification_requested_at" TIMESTAMP(3);
ALTER TABLE "hospitals" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "hospitals" ADD COLUMN "suspended_by" UUID;
ALTER TABLE "hospitals" ADD COLUMN "suspension_reason" TEXT;

-- CreateTable: organization_members
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hospital_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'STAFF',
    "invited_by" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),
    "removed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_members_hospital_id_removed_at_idx" ON "organization_members" ("hospital_id", "removed_at");
CREATE INDEX "organization_members_profile_id_removed_at_idx" ON "organization_members" ("profile_id", "removed_at");
CREATE UNIQUE INDEX "org_members_active_unique" ON "organization_members" ("hospital_id", "profile_id", "removed_at");

ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: organization_verification_reviews
CREATE TABLE "organization_verification_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hospital_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "previous_status" "VerificationStatus" NOT NULL,
    "new_status" "VerificationStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_verification_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_verification_reviews_hospital_id_created_at_idx" ON "organization_verification_reviews" ("hospital_id", "created_at" DESC);
CREATE INDEX "organization_verification_reviews_reviewer_id_created_at_idx" ON "organization_verification_reviews" ("reviewer_id", "created_at" DESC);

ALTER TABLE "organization_verification_reviews" ADD CONSTRAINT "organization_verification_reviews_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_verification_reviews" ADD CONSTRAINT "organization_verification_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: organization_coordination
CREATE TABLE "organization_coordination" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hospital_id" UUID NOT NULL,
    "blood_request_id" UUID NOT NULL,
    "status" "OrganizationCoordinationStatus" NOT NULL DEFAULT 'NOTIFIED',
    "note" TEXT,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_coordination_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_coordination_unique" ON "organization_coordination" ("hospital_id", "blood_request_id");
CREATE INDEX "organization_coordination_hospital_id_status_idx" ON "organization_coordination" ("hospital_id", "status");
CREATE INDEX "organization_coordination_blood_request_id_idx" ON "organization_coordination" ("blood_request_id");

ALTER TABLE "organization_coordination" ADD CONSTRAINT "organization_coordination_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_coordination" ADD CONSTRAINT "organization_coordination_blood_request_id_fkey" FOREIGN KEY ("blood_request_id") REFERENCES "blood_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_coordination" ADD CONSTRAINT "organization_coordination_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
