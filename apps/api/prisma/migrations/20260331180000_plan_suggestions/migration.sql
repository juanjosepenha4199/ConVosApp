-- CreateTable
CREATE TABLE "plan_suggestions" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_suggestions_group_id_idx" ON "plan_suggestions"("group_id");

-- AddForeignKey
ALTER TABLE "plan_suggestions" ADD CONSTRAINT "plan_suggestions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_suggestions" ADD CONSTRAINT "plan_suggestions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
