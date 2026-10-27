-- CreateTable: otp_codes (built-in OTP auth mode)
-- No RLS is enabled on this table: it stores only short-lived hashed
-- codes and is accessed exclusively by the API service connection.
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "otp_codes_phone_created_at_idx" ON "otp_codes"("phone", "created_at" DESC);
