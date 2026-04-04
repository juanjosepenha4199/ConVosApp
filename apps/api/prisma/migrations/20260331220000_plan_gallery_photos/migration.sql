-- CreateTable
CREATE TABLE "plan_photos" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_photos_plan_id_photo_id_key" ON "plan_photos"("plan_id", "photo_id");

-- CreateIndex
CREATE INDEX "plan_photos_plan_id_idx" ON "plan_photos"("plan_id");

-- AddForeignKey
ALTER TABLE "plan_photos" ADD CONSTRAINT "plan_photos_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_photos" ADD CONSTRAINT "plan_photos_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
