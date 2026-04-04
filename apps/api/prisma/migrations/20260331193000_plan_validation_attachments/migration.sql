-- CreateTable
CREATE TABLE "plan_validation_attachments" (
    "id" TEXT NOT NULL,
    "plan_validation_id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_validation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_validation_attachments_plan_validation_id_photo_id_key" ON "plan_validation_attachments"("plan_validation_id", "photo_id");

-- CreateIndex
CREATE INDEX "plan_validation_attachments_plan_validation_id_idx" ON "plan_validation_attachments"("plan_validation_id");

-- AddForeignKey
ALTER TABLE "plan_validation_attachments" ADD CONSTRAINT "plan_validation_attachments_plan_validation_id_fkey" FOREIGN KEY ("plan_validation_id") REFERENCES "plan_validations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_validation_attachments" ADD CONSTRAINT "plan_validation_attachments_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
