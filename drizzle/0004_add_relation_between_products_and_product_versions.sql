ALTER TABLE "products" ALTER COLUMN "version" SET DEFAULT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_versions" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;