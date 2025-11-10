CREATE TABLE "users_to_products" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users_to_products" ADD CONSTRAINT "users_to_products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_products" ADD CONSTRAINT "users_to_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;