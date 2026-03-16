---
name: db
description: Run database operations like migrate, push, generate, reset, or add a table.
---

Database operation: $ARGUMENTS

Common operations:
- "migrate" → Run `npx prisma migrate dev --name <name>`
- "push" → Run `npx prisma db push` to sync schema without migration
- "generate" → Run `npx prisma generate` to regenerate client
- "reset" → Run `npx prisma migrate reset` (WARNING: drops all data)
- "studio" → Run `npx prisma studio` to open DB browser
- "add table <name>" → Edit `prisma/schema.prisma`, add model, create repository in `src/repositories/`, register in DI container, run generate

After any schema change, regenerate the Prisma client and run typecheck.
