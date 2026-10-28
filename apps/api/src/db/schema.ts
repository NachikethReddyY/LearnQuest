import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at").notNull().defaultNow();

// Better Auth tables (shape per its Drizzle adapter docs).
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// App tables.
export const learners = pgTable("learners", {
  id: id(),
  kind: text("kind", { enum: ["user"] })
    .notNull()
    .default("user"),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const worlds = pgTable("worlds", {
  id: id(),
  slug: text("slug").notNull().unique(),
  config: jsonb("config").notNull().default({}),
});

export const concepts = pgTable(
  "concepts",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("concepts_world_slug").on(t.worldId, t.slug)],
);

export type LessonSource = { repo: string; sha: string; path: string };

export const lessons = pgTable("lessons", {
  id: id(),
  slug: text("slug").notNull().unique(),
  worldId: text("world_id")
    .notNull()
    .references(() => worlds.id),
  title: text("title").notNull(),
  sourceKind: text("source_kind", { enum: ["repo", "authored"] }).notNull(),
  source: jsonb("source").$type<LessonSource>(),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  // No FK to lesson_versions: it would be circular; the app keeps it consistent.
  currentVersionId: text("current_version_id"),
  createdAt: createdAt(),
});

export const lessonVersions = pgTable(
  "lesson_versions",
  {
    id: id(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id),
    version: integer("version").notNull(),
    createdAt: createdAt(),
    publishedAt: timestamp("published_at"),
  },
  (t) => [uniqueIndex("lesson_versions_lesson_version").on(t.lessonId, t.version)],
);

export type StepPublic = { title: string; prompt: string; kind: "mcq" | "cloze"; options?: string[] };
export type StepSecret = {
  beforeFiles: Record<string, string>;
  hunks: unknown[];
  answer: number | string;
  accepted?: string[];
  hints: { text: string; eliminate?: number }[];
  explanations: { workedExample: string; practice: string };
};

export const steps = pgTable(
  "steps",
  {
    id: id(),
    lessonVersionId: text("lesson_version_id")
      .notNull()
      .references(() => lessonVersions.id),
    idx: integer("idx").notNull(),
    public: jsonb("public").$type<StepPublic>().notNull(),
    secret: jsonb("secret").$type<StepSecret>().notNull(),
  },
  (t) => [uniqueIndex("steps_version_idx").on(t.lessonVersionId, t.idx)],
);

export const stepProgress = pgTable(
  "step_progress",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id),
    stepId: text("step_id")
      .notNull()
      .references(() => steps.id),
    state: text("state", { enum: ["predicting", "hinting", "revealed", "skipped"] })
      .notNull()
      .default("predicting"),
    rungsTaken: integer("rungs_taken").notNull().default(0),
    attemptAllowed: boolean("attempt_allowed").notNull().default(true),
    retryAllowed: boolean("retry_allowed").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.stepId] })],
);

export const attempts = pgTable(
  "attempts",
  {
    id: id(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id),
    stepId: text("step_id")
      .notNull()
      .references(() => steps.id),
    kind: text("kind", { enum: ["mcq", "cloze", "skip"] }).notNull(),
    response: jsonb("response"),
    observed: boolean("observed").notNull(),
    correct: boolean("correct"),
    hintsUsed: integer("hints_used").notNull().default(0),
    feedback: jsonb("feedback"),
    missedConcepts: text("missed_concepts")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("attempts_one_observed")
      .on(t.learnerId, t.stepId)
      .where(sql`${t.observed}`),
    index("attempts_step").on(t.stepId),
  ],
);

export const hintEvents = pgTable(
  "hint_events",
  {
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id),
    stepId: text("step_id")
      .notNull()
      .references(() => steps.id),
    rung: integer("rung").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.stepId, t.rung] })],
);
