// Import this before any ../src module: env.ts reads process.env when it is first imported.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://learnquest:learnquest@localhost:5432/learnquest_test";
process.env.BETTER_AUTH_SECRET ??= "test-only-secret-not-for-production-0123456789";
