-- Migration: 20261026000006_add_search_analytics
-- Adds search analytics table for privacy-preserving aggregate metrics.

CREATE TABLE "search_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blood_group" VARCHAR(20),
    "upazila_id" UUID,
    "result_count" INTEGER NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "search_analytics_created_at_idx" ON "search_analytics" ("created_at" DESC);
CREATE INDEX "search_analytics_blood_group_created_at_idx" ON "search_analytics" ("blood_group", "created_at" DESC);
CREATE INDEX "search_analytics_upazila_id_created_at_idx" ON "search_analytics" ("upazila_id", "created_at" DESC);
