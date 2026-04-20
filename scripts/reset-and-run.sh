#!/usr/bin/env bash
set -euo pipefail

echo "==> Validating Prisma schema"
npx prisma validate

echo "==> Generating Prisma client"
npm run db:generate

echo "==> Pushing schema"
npm run db:push

echo "==> Seeding database"
npm run db:seed

echo "==> Starting dev server"
npm run dev