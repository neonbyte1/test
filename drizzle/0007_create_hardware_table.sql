CREATE TABLE "hardware" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"state" integer NOT NULL,
	"hash" varchar NOT NULL,
	"components" jsonb NOT NULL
);
