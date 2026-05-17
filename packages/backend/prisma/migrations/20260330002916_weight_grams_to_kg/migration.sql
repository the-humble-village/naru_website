-- Convert existing weight data from grams to kilograms
UPDATE "children" SET "weight" = "weight" / 1000.0 WHERE "weight" > 0;
UPDATE "child_visits" SET "weight" = "weight" / 1000.0 WHERE "weight" > 0;
