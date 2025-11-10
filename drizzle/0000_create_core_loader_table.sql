CREATE TABLE "core_loader" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"last_update" timestamp,
	"public_key" varchar(64) NOT NULL,
	"private_key" varchar(64) NOT NULL
);
