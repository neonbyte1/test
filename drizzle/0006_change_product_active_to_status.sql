ALTER TABLE "products" RENAME COLUMN "active" TO "status";
ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT;

-- Convert the boolean to integer values
ALTER TABLE "products"
ALTER COLUMN "status" TYPE integer
USING CASE
    WHEN "status" = true THEN 1
    WHEN "status" = false THEN 0
    ELSE NULL
END;

ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 0;
