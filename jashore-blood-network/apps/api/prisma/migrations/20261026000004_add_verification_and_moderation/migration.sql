-- Migration: 20261026000004_add_verification_and_moderation
-- Adds donor verification workflow, verification review audit trail,
-- and suspicious activity flags for anti-fraud moderation.

-- CreateEnum: DonorVerificationStatus
CREATE TYPE "DonorVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum: SuspiciousActivityType
CREATE TYPE "SuspiciousActivityType" AS ENUM ('DUPLICATE_REQUEST', 'RAPID_REGISTRATION', 'EXCESSIVE_CONTACT_ATTEMPTS', 'IMPERSONATION_SUSPECTED', 'SPAM_SUBMISSION', 'OTHER');

-- AlterTable: add verification fields to donor_profiles
ALTER TABLE "donor_profiles" ADD COLUMN "verification_status" "DonorVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "donor_profiles" ADD COLUMN "verification_requested_at" TIMESTAMP(3);
ALTER TABLE "donor_profiles" ADD COLUMN "verification_reviewed_at" TIMESTAMP(3);
ALTER TABLE "donor_profiles" ADD COLUMN "verification_reviewed_by" UUID;
ALTER TABLE "donor_profiles" ADD COLUMN "verification_feedback" TEXT;
ALTER TABLE "donor_profiles" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "donor_profiles" ADD COLUMN "suspended_by" UUID;
ALTER TABLE "donor_profiles" ADD COLUMN "suspension_reason" TEXT;

-- CreateIndex: verification status for admin queue
CREATE INDEX "donor_profiles_verification_status_idx" ON "donor_profiles" ("verification_status");

-- CreateTable: donor_verification_reviews (append-only audit trail)
CREATE TABLE "donor_verification_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "donor_profile_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "previous_status" "DonorVerificationStatus" NOT NULL,
    "new_status" "DonorVerificationStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "donor_verification_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "donor_verification_reviews_donor_idx" ON "donor_verification_reviews" ("donor_profile_id", "created_at" DESC);
CREATE INDEX "donor_verification_reviews_reviewer_idx" ON "donor_verification_reviews" ("reviewer_id", "created_at" DESC);

ALTER TABLE "donor_verification_reviews" ADD CONSTRAINT "donor_verification_reviews_donor_profile_id_fkey" FOREIGN KEY ("donor_profile_id") REFERENCES "donor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: suspicious_activity_flags
CREATE TABLE "suspicious_activity_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "SuspiciousActivityType" NOT NULL,
    "subject_type" VARCHAR(60) NOT NULL,
    "subject_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suspicious_activity_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "suspicious_activity_queue_idx" ON "suspicious_activity_flags" ("type", "is_resolved", "created_at" DESC);
CREATE INDEX "suspicious_activity_subject_idx" ON "suspicious_activity_flags" ("subject_type", "subject_id");
