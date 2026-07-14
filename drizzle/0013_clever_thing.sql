CREATE TABLE "uoms" (
	"code" varchar(24) PRIMARY KEY NOT NULL,
	"label" varchar(40) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed the built-in construction units BEFORE the FK is added, so existing items
-- (whose uom is 'BAG', 'PC', 'CU_M', …) still satisfy the constraint.
INSERT INTO "uoms" ("code", "label", "is_system") VALUES
	('BAG', 'bag', true),
	('PC', 'pc', true),
	('LENGTH', 'length', true),
	('KG', 'kg', true),
	('TON', 'ton', true),
	('CU_M', 'cu.m', true),
	('SQ_M', 'sq.m', true),
	('M', 'm', true),
	('LM', 'lm', true),
	('BD_FT', 'bd.ft', true),
	('SHEET', 'sheet', true),
	('ROLL', 'roll', true),
	('L', 'L', true),
	('GAL', 'gal', true),
	('PAIL', 'pail', true),
	('SET', 'set', true),
	('LOT', 'lot', true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
-- enum -> varchar: the USING cast is required (an enum has no implicit cast to varchar).
ALTER TABLE "items" ALTER COLUMN "uom" SET DATA TYPE varchar(24) USING "uom"::text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_type" varchar(12);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_value" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_uom_uoms_code_fk" FOREIGN KEY ("uom") REFERENCES "public"."uoms"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
DROP TYPE "public"."uom";
