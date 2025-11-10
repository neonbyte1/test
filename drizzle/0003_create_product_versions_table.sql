CREATE TABLE "product_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"filename" varchar(64) NOT NULL
);
