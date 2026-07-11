CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'GCASH', 'BANK_TRANSFER', 'CHECK', 'CARD');--> statement-breakpoint
ALTER TYPE "public"."doc_series" ADD VALUE 'SI';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'SALE';--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"tin" varchar(20),
	"address" varchar(240),
	"contact_person" varchar(160),
	"email" varchar(255),
	"phone" varchar(40),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"vat_class" "vat_class" DEFAULT 'VATABLE' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"unit_cost" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"si_number" varchar(40) NOT NULL,
	"customer_id" uuid,
	"customer_name" varchar(200),
	"customer_tin" varchar(20),
	"warehouse_id" uuid NOT NULL,
	"status" "doc_status" DEFAULT 'POSTED' NOT NULL,
	"sale_date" date NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vatable_sales" numeric(14, 2) DEFAULT '0' NOT NULL,
	"zero_rated_sales" numeric(14, 2) DEFAULT '0' NOT NULL,
	"exempt_sales" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'CASH' NOT NULL,
	"amount_tendered" numeric(14, 2),
	"notes" text,
	"created_by" uuid NOT NULL,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_si_number_unique" UNIQUE("si_number")
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "selling_price" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_item_idx" ON "sale_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "sales_customer_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_warehouse_idx" ON "sales" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("sale_date");