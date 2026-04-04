-- Drop location columns from validations (photo + time checks only from now on).
ALTER TABLE "plan_validations" DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "distance_to_plan_m";

-- Replace plan ↔ place with optional text label.
ALTER TABLE "plans" ADD COLUMN "venue_label" VARCHAR(200);

UPDATE "plans" AS p
SET "venue_label" = LEFT(
  pl."name" || CASE
    WHEN pl."address" IS NOT NULL AND TRIM(pl."address") <> '' AND pl."address" <> pl."name" THEN ' · ' || pl."address"
    ELSE ''
  END,
  200
)
FROM "places" AS pl
WHERE p."place_id" = pl."id";

ALTER TABLE "plans" DROP CONSTRAINT "plans_place_id_fkey";
ALTER TABLE "plans" DROP COLUMN "place_id";
ALTER TABLE "plans" DROP COLUMN "location_radius_m";

DROP TABLE "places";
