-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REGISTERED_USER', 'DONOR', 'VOLUNTEER_COORDINATOR', 'HOSPITAL_REPRESENTATIVE', 'MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "DonorVisibility" AS ENUM ('LISTED', 'UNLISTED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('IN_APP_ONLY', 'IN_APP_AND_PHONE', 'IN_APP_AND_EMAIL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('HOSPITAL', 'BLOOD_BANK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_MATCH', 'RESPONSE_RECEIVED', 'REQUEST_VERIFIED', 'REQUEST_ARRANGED', 'REQUEST_COMPLETED', 'REQUEST_CANCELLED', 'ABUSE_REPORT_UPDATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('DONOR_DISCOVERABILITY', 'NOTIFICATION_IN_APP', 'NOTIFICATION_EMAIL', 'NOTIFICATION_SMS', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "ConsentAction" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AbuseReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AbuseReportTargetType" AS ENUM ('PROFILE', 'DONOR_PROFILE', 'BLOOD_REQUEST', 'REQUEST_RESPONSE', 'HOSPITAL', 'BLOOD_BANK', 'NOTIFICATION');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "full_name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "country" VARCHAR(80) NOT NULL DEFAULT 'Bangladesh',
    "code" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upazilas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "district_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(20),
    "headquarters_lat" DECIMAL(9,6),
    "headquarters_lng" DECIMAL(9,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upazilas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "upazila_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "blood_group" "BloodGroup" NOT NULL,
    "upazila_id" UUID NOT NULL,
    "locality_id" UUID,
    "last_donation_at" DATE,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "availability_confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibility" "DonorVisibility" NOT NULL DEFAULT 'LISTED',
    "contact_preference" "ContactPreference" NOT NULL DEFAULT 'IN_APP_ONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "donor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL,
    "blood_group" "BloodGroup" NOT NULL,
    "units_requested" SMALLINT NOT NULL,
    "upazila_id" UUID NOT NULL,
    "hospital_id" UUID,
    "required_by" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verification_note" TEXT,
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "contact_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(180) NOT NULL,
    "upazila_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(30),
    "operating_hours" TEXT,
    "services_offered" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "represented_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_banks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hospital_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "upazila_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(30),
    "operating_hours" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "blood_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_type" "FacilityType" NOT NULL,
    "hospital_id" UUID,
    "blood_bank_id" UUID,
    "verified_by" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "evidence_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "related_type" VARCHAR(60),
    "related_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "action" "ConsentAction" NOT NULL,
    "actor_id" UUID NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID,
    "target_type" "AbuseReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(60) NOT NULL,
    "target_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_phone_key" ON "profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_phone_idx" ON "profiles"("phone");

-- CreateIndex
CREATE INDEX "profiles_email_idx" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_is_active_deleted_at_idx" ON "profiles"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "user_roles_profile_id_idx" ON "user_roles"("profile_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE INDEX "user_roles_revoked_at_idx" ON "user_roles"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_profile_role_active_unique" ON "user_roles"("profile_id", "role");

-- CreateIndex
CREATE INDEX "districts_country_idx" ON "districts"("country");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_country_unique" ON "districts"("name", "country");

-- CreateIndex
CREATE INDEX "upazilas_district_id_idx" ON "upazilas"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "upazilas_district_name_unique" ON "upazilas"("district_id", "name");

-- CreateIndex
CREATE INDEX "localities_upazila_id_is_approved_idx" ON "localities"("upazila_id", "is_approved");

-- CreateIndex
CREATE UNIQUE INDEX "localities_upazila_name_unique" ON "localities"("upazila_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "donor_profiles_profile_id_key" ON "donor_profiles"("profile_id");

-- CreateIndex
CREATE INDEX "donor_profiles_search_idx" ON "donor_profiles"("blood_group", "upazila_id", "is_available", "deleted_at");

-- CreateIndex
CREATE INDEX "donor_profiles_stale_availability_idx" ON "donor_profiles"("availability_confirmed_at");

-- CreateIndex
CREATE INDEX "donor_profiles_profile_id_deleted_at_idx" ON "donor_profiles"("profile_id", "deleted_at");

-- CreateIndex
CREATE INDEX "blood_requests_donor_match_idx" ON "blood_requests"("status", "blood_group", "upazila_id");

-- CreateIndex
CREATE INDEX "blood_requests_my_requests_idx" ON "blood_requests"("requester_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "blood_requests_expiring_idx" ON "blood_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "blood_requests_upazila_id_status_idx" ON "blood_requests"("upazila_id", "status");

-- CreateIndex
CREATE INDEX "request_responses_my_responses_idx" ON "request_responses"("donor_id", "status");

-- CreateIndex
CREATE INDEX "request_responses_request_id_status_idx" ON "request_responses"("request_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "request_responses_request_donor_unique" ON "request_responses"("request_id", "donor_id");

-- CreateIndex
CREATE INDEX "hospitals_upazila_id_verification_status_idx" ON "hospitals"("upazila_id", "verification_status");

-- CreateIndex
CREATE INDEX "hospitals_verification_status_idx" ON "hospitals"("verification_status");

-- CreateIndex
CREATE INDEX "blood_banks_upazila_id_verification_status_idx" ON "blood_banks"("upazila_id", "verification_status");

-- CreateIndex
CREATE INDEX "blood_banks_hospital_id_idx" ON "blood_banks"("hospital_id");

-- CreateIndex
CREATE INDEX "facility_verifications_facility_type_status_created_at_idx" ON "facility_verifications"("facility_type", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "facility_verifications_hospital_id_idx" ON "facility_verifications"("hospital_id");

-- CreateIndex
CREATE INDEX "facility_verifications_blood_bank_id_idx" ON "facility_verifications"("blood_bank_id");

-- CreateIndex
CREATE INDEX "notifications_inbox_idx" ON "notifications"("recipient_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_profile_id_key" ON "notification_preferences"("profile_id");

-- CreateIndex
CREATE INDEX "consent_records_profile_id_consent_type_acted_at_idx" ON "consent_records"("profile_id", "consent_type", "acted_at" DESC);

-- CreateIndex
CREATE INDEX "consent_records_actor_id_acted_at_idx" ON "consent_records"("actor_id", "acted_at" DESC);

-- CreateIndex
CREATE INDEX "abuse_reports_queue_idx" ON "abuse_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "abuse_reports_target_type_target_id_idx" ON "abuse_reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "abuse_reports_reporter_id_created_at_idx" ON "abuse_reports"("reporter_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_target_idx" ON "audit_logs"("target_type", "target_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upazilas" ADD CONSTRAINT "upazilas_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localities" ADD CONSTRAINT "localities_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localities" ADD CONSTRAINT "localities_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "blood_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_represented_by_fkey" FOREIGN KEY ("represented_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_banks" ADD CONSTRAINT "blood_banks_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_banks" ADD CONSTRAINT "blood_banks_upazila_id_fkey" FOREIGN KEY ("upazila_id") REFERENCES "upazilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_verifications" ADD CONSTRAINT "facility_verifications_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_verifications" ADD CONSTRAINT "facility_verifications_blood_bank_id_fkey" FOREIGN KEY ("blood_bank_id") REFERENCES "blood_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_verifications" ADD CONSTRAINT "facility_verifications_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

