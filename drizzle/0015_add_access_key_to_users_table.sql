ALTER TABLE "users" ADD COLUMN "access_key" varchar(32) NOT NULL DEFAULT REPLACE(gen_random_uuid()::text, '-', '');
