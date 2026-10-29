# Build context is the repo root (pnpm workspace). Plan: docs/api-plan.md §5 D1.
# Node 22.18+ runs the .ts sources directly (type stripping), so no build step.
FROM node:22-slim

RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @learnquest/api...

ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "src/server.ts"]
