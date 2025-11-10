CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"process" varchar(64) NOT NULL,
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"last_update" timestamp DEFAULT NULL,
	"key" varchar(64) DEFAULT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name")
);
