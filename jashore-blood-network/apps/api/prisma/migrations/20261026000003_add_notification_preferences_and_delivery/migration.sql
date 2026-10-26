-- =============================================================================
-- Migration: 20261026000003_add_notification_preferences_and_delivery
-- =============================================================================
-- Adds:
--   1. Donor alert preferences to notification_preferences
--   2. Idempotency key to notifications (prevents duplicate alerts)
--   3. notification_delivery_attempts table (tracks delivery status)
-- =============================================================================

-- AlterTable: add donor alert preferences to notification_preferences
ALTER TABLE "notification_preferences" ADD COLUMN "blood_request_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN "preferred_blood_groups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "notification_preferences" ADD COLUMN "quiet_hours_start" INTEGER;
ALTER TABLE "notification_preferences" ADD COLUMN "quiet_hours_end" INTEGER;
ALTER TABLE "notification_preferences" ADD COLUMN "max_alerts_per_day" INTEGER NOT NULL DEFAULT 10;

-- AlterTable: add idempotency key to notifications
ALTER TABLE "notifications" ADD COLUMN "idempotency_key" VARCHAR(255);

-- CreateIndex: idempotency unique constraint
CREATE UNIQUE INDEX "notifications_idempotency_key_unique" ON "notifications" ("idempotency_key");

-- CreateIndex: related lookup for notifications
CREATE INDEX "notifications_related_type_related_id_idx" ON "notifications" ("related_type", "related_id");

-- CreateTable: notification_delivery_attempts
CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "provider_message_id" VARCHAR(255),
    "error" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_notification_id_idx" ON "notification_delivery_attempts" ("notification_id");

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_recipient_channel_attempted_idx" ON "notification_delivery_attempts" ("recipient_id", "channel", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_status_attempted_idx" ON "notification_delivery_attempts" ("status", "attempted_at");

-- AddForeignKey
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
