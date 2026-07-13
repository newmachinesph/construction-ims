CREATE TABLE "roles" (
	"key" varchar(40) PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed the eight built-in roles BEFORE the FK is added, so existing users
-- (whose role is 'ADMIN', 'VIEWER', …) still satisfy the constraint.
INSERT INTO "roles" ("key", "label", "is_system", "permissions") VALUES
	('ADMIN', 'Administrator', true, '["item:read","item:write","category:read","category:write","supplier:read","supplier:write","project:read","project:write","warehouse:read","warehouse:write","po:read","po:create","po:update","po:approve","po:cancel","grn:read","grn:create","grn:post","mr:read","mr:create","mr:approve","mr:cancel","issuance:read","issuance:create","issuance:post","transfer:read","transfer:create","transfer:dispatch","transfer:receive","adjustment:read","adjustment:create","adjustment:approve","adjustment:post","sale:read","sale:create","sale:void","customer:read","customer:write","stock:read","movement:read","report:read","report:cost","audit:read","user:read","user:write","role:read","role:write","settings:read","settings:write"]'::jsonb),
	('PROJECT_MANAGER', 'Project Manager', true, '["item:read","category:read","supplier:read","project:read","warehouse:read","po:read","grn:read","mr:read","issuance:read","transfer:read","adjustment:read","sale:read","customer:read","stock:read","movement:read","report:read","report:cost","project:write","po:approve","po:cancel","mr:approve","mr:cancel","adjustment:approve"]'::jsonb),
	('PROCUREMENT_OFFICER', 'Procurement Officer', true, '["item:read","category:read","supplier:read","project:read","warehouse:read","po:read","grn:read","mr:read","issuance:read","transfer:read","adjustment:read","sale:read","customer:read","stock:read","movement:read","report:read","report:cost","supplier:write","item:write","po:create","po:update","po:cancel"]'::jsonb),
	('WAREHOUSEMAN', 'Warehouseman (Bodegero)', true, '["item:read","category:read","supplier:read","project:read","warehouse:read","po:read","grn:read","mr:read","issuance:read","transfer:read","adjustment:read","sale:read","customer:read","stock:read","movement:read","report:read","grn:create","grn:post","issuance:create","issuance:post","transfer:create","transfer:dispatch","transfer:receive","adjustment:create","sale:create","customer:write"]'::jsonb),
	('SITE_ENGINEER', 'Site Engineer', true, '["item:read","category:read","supplier:read","project:read","warehouse:read","po:read","grn:read","mr:read","issuance:read","transfer:read","adjustment:read","sale:read","customer:read","stock:read","movement:read","report:read","mr:create","mr:cancel","transfer:receive","adjustment:create"]'::jsonb),
	('ACCOUNTANT', 'Accountant', true, '["item:read","category:read","supplier:read","project:read","warehouse:read","po:read","grn:read","mr:read","issuance:read","transfer:read","adjustment:read","sale:read","customer:read","stock:read","movement:read","report:read","report:cost","audit:read","supplier:write","customer:write","sale:void"]'::jsonb),
	('AUDITOR', 'Auditor', true, '["item:read","category:read","supplier:read","project:read","warehouse:read","po:read","grn:read","mr:read","issuance:read","transfer:read","adjustment:read","sale:read","customer:read","stock:read","movement:read","report:read","report:cost","audit:read"]'::jsonb),
	('VIEWER', 'Viewer', true, '["stock:read","item:read","project:read","warehouse:read","report:read"]'::jsonb)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE varchar(40) USING "role"::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VIEWER';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
DROP TYPE "public"."role";
