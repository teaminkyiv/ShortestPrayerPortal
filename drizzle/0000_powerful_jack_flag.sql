CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"testimony_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "testimonies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "testimony_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"testimony_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"ai_summary" text,
	"edited_version" text,
	"summarized_at" timestamp,
	"published_at" timestamp,
	"published_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "testimony_reviews_testimony_id_unique" UNIQUE("testimony_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"telegram_id" bigint PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonies" ADD CONSTRAINT "testimonies_telegram_id_users_telegram_id_fk" FOREIGN KEY ("telegram_id") REFERENCES "public"."users"("telegram_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimony_reviews" ADD CONSTRAINT "testimony_reviews_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE no action ON UPDATE no action;