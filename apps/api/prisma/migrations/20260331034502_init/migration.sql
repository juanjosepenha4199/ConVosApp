-- CreateEnum
CREATE TYPE "public"."GroupType" AS ENUM ('couple', 'friends', 'family', 'other');

-- CreateEnum
CREATE TYPE "public"."GroupRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('date', 'food', 'trip', 'sport', 'hangout', 'other');

-- CreateEnum
CREATE TYPE "public"."PlanStatus" AS ENUM ('scheduled', 'cancelled', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "public"."ParticipantStatus" AS ENUM ('invited', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "public"."ValidationStatus" AS ENUM ('accepted', 'rejected', 'pending_review');

-- CreateEnum
CREATE TYPE "public"."PointsReason" AS ENUM ('plan_completed', 'streak_bonus', 'creative_bonus', 'cancel_penalty', 'mission_completed', 'admin_adjustment');

-- CreateEnum
CREATE TYPE "public"."ChallengeScope" AS ENUM ('global', 'group', 'user');

-- CreateEnum
CREATE TYPE "public"."ChallengeAssignmentStatus" AS ENUM ('active', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "public"."FeedItemType" AS ENUM ('plan_validated', 'plan_created', 'mission_completed', 'achievement');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "google_sub" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."GroupType" NOT NULL,
    "avatar_url" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_members" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "public"."GroupRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."group_invites" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."places" (
    "id" TEXT NOT NULL,
    "google_place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "public"."PlanType" NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "place_id" TEXT NOT NULL,
    "location_radius_m" INTEGER NOT NULL DEFAULT 250,
    "status" "public"."PlanStatus" NOT NULL DEFAULT 'scheduled',
    "cancelled_by" TEXT,
    "cancelled_reason" TEXT,
    "requires_all_confirm" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_participants" (
    "plan_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "public"."ParticipantStatus" NOT NULL DEFAULT 'invited',

    CONSTRAINT "plan_participants_pkey" PRIMARY KEY ("plan_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."photos" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "mime_type" TEXT,
    "sha256" TEXT,
    "captured_at_client" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_validations" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "captured_at_client" TIMESTAMP(3) NOT NULL,
    "submitted_at_server" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "distance_to_plan_m" INTEGER NOT NULL,
    "status" "public"."ValidationStatus" NOT NULL,
    "reject_reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "plan_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."points_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" "public"."PointsReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."streaks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "best_streak" INTEGER NOT NULL DEFAULT 0,
    "last_validated_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."challenges" (
    "id" TEXT NOT NULL,
    "scope" "public"."ChallengeScope" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "points_reward" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."challenge_assignments" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "user_id" TEXT,
    "group_id" TEXT,
    "status" "public"."ChallengeAssignmentStatus" NOT NULL DEFAULT 'active',
    "progress" JSONB,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "challenge_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feed_items" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "type" "public"."FeedItemType" NOT NULL,
    "plan_id" TEXT,
    "photo_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "public"."users"("google_sub");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "public"."group_members"("user_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_role_idx" ON "public"."group_members"("group_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "group_invites_token_key" ON "public"."group_invites"("token");

-- CreateIndex
CREATE INDEX "group_invites_group_id_idx" ON "public"."group_invites"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "places_google_place_id_key" ON "public"."places"("google_place_id");

-- CreateIndex
CREATE INDEX "plans_group_id_idx" ON "public"."plans"("group_id");

-- CreateIndex
CREATE INDEX "plans_scheduled_at_idx" ON "public"."plans"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "photos_storage_key_key" ON "public"."photos"("storage_key");

-- CreateIndex
CREATE INDEX "photos_sha256_idx" ON "public"."photos"("sha256");

-- CreateIndex
CREATE INDEX "photos_owner_user_id_idx" ON "public"."photos"("owner_user_id");

-- CreateIndex
CREATE INDEX "plan_validations_plan_id_idx" ON "public"."plan_validations"("plan_id");

-- CreateIndex
CREATE INDEX "plan_validations_user_id_idx" ON "public"."plan_validations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_validations_plan_id_user_id_key" ON "public"."plan_validations"("plan_id", "user_id");

-- CreateIndex
CREATE INDEX "points_ledger_user_id_idx" ON "public"."points_ledger"("user_id");

-- CreateIndex
CREATE INDEX "points_ledger_group_id_idx" ON "public"."points_ledger"("group_id");

-- CreateIndex
CREATE INDEX "points_ledger_plan_id_idx" ON "public"."points_ledger"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_user_id_key" ON "public"."streaks"("user_id");

-- CreateIndex
CREATE INDEX "challenge_assignments_challenge_id_idx" ON "public"."challenge_assignments"("challenge_id");

-- CreateIndex
CREATE INDEX "challenge_assignments_user_id_idx" ON "public"."challenge_assignments"("user_id");

-- CreateIndex
CREATE INDEX "challenge_assignments_group_id_idx" ON "public"."challenge_assignments"("group_id");

-- CreateIndex
CREATE INDEX "feed_items_group_id_idx" ON "public"."feed_items"("group_id");

-- CreateIndex
CREATE INDEX "feed_items_occurred_at_idx" ON "public"."feed_items"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscriptions_endpoint_key" ON "public"."notification_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "notification_subscriptions_user_id_idx" ON "public"."notification_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_invites" ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_invites" ADD CONSTRAINT "group_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plans" ADD CONSTRAINT "plans_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plans" ADD CONSTRAINT "plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plans" ADD CONSTRAINT "plans_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_participants" ADD CONSTRAINT "plan_participants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_participants" ADD CONSTRAINT "plan_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photos" ADD CONSTRAINT "photos_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_validations" ADD CONSTRAINT "plan_validations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_validations" ADD CONSTRAINT "plan_validations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_validations" ADD CONSTRAINT "plan_validations_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."points_ledger" ADD CONSTRAINT "points_ledger_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."points_ledger" ADD CONSTRAINT "points_ledger_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."streaks" ADD CONSTRAINT "streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challenge_assignments" ADD CONSTRAINT "challenge_assignments_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challenge_assignments" ADD CONSTRAINT "challenge_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."challenge_assignments" ADD CONSTRAINT "challenge_assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_items" ADD CONSTRAINT "feed_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_items" ADD CONSTRAINT "feed_items_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_items" ADD CONSTRAINT "feed_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_items" ADD CONSTRAINT "feed_items_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
