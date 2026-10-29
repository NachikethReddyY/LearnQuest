CREATE TABLE "enrollments" (
	"learner_id" text NOT NULL,
	"path_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_learner_id_path_id_pk" PRIMARY KEY("learner_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "path_courses" (
	"path_id" text NOT NULL,
	"world_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "path_courses_path_id_world_id_pk" PRIMARY KEY("path_id","world_id")
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"owner_id" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"origin" text DEFAULT 'official' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paths_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "daily_goal_xp" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "origin" text DEFAULT 'official' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paths" ADD CONSTRAINT "paths_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;