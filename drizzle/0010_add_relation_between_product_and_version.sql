ALTER TABLE "products" DROP COLUMN "version";
ALTER TABLE "products" ADD COLUMN "version_id" uuid;
