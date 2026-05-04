#!/usr/bin/env bash
set -euo pipefail

echo "==> Removing local SQLite database"
rm -f prisma/dev.db

echo "==> Validating Prisma schema"
npx prisma validate

echo "==> Generating Prisma client"
npm run db:generate

echo "==> Pushing schema"
touch prisma/dev.db
npm run db:push

echo "==> Seeding database"
npm run db:seed

echo "==> Clean reseed complete"
