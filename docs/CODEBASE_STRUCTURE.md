# Fiscora P1 — Codebase Structure

This document maps every major folder and file so you can navigate the monorepo quickly.
Each source file also contains section comments (`/* --- ... --- */`) describing what that block does.

---

## Top-level layout

```
P1/
├── apps/           # Runnable applications
├── packages/       # Shared UI packages (Turbo monorepo)
├── prisma/         # Database schema + migrations
├── scripts/        # One-off backfills and verify scripts
├── docs/           # Architecture and structure docs (this file)
├── package.json    # Root workspace scripts (dev, build, lint)
└── turbo.json      # Turborepo pipeline config
```

---

## `apps/api` — Backend (Fastify + Prisma, port 4000)

| Path | Purpose |
|------|---------|
| `src/server.ts` | Main HTTP server: registers routes, document upload, analytics, audit |
| `src/db.ts` | Prisma client singleton |
| `src/queue.ts` | BullMQ invoice processing queue (Redis) |
| `src/lib/auth.ts` | Login, sessions, password hashing, approval helpers |
| `src/lib/authMiddleware.ts` | `requireAuth`, `requirePermission` guards |
| `src/lib/permissions.ts` | Permission key constants + role matrix |
| `src/lib/audit.ts` | Audit log writes + approval rule resolver |
| `src/lib/seed.ts` | Demo data seed on startup |
| `src/services/` | Business logic (payments, fraud, contracts, analytics, …) |
| `src/modules/` | HTTP route modules (RFQ, PO, payments, auth, …) |
| `src/agents/` | Procurement agent (invoice recommendations) |
| `src/procurement/` | Item intelligence helpers |
| `src/types/` | Shared TypeScript response types |
| `uploads/` | Stored invoice PDFs and vendor docs |

### Module pattern (`src/modules/<name>/`)

```
<name>.routes.ts      → Registers URLs + permission guards
<name>.controller.ts  → Parses request, calls service, sends response
<name>.service.ts     → Core business logic + DB writes
<name>.types.ts       → Request/response shapes (optional)
```

---

## `apps/web` — Frontend (Next.js, port 3000)

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages (dashboard, invoices, RFQs, …) |
| `app/api/auth/` | Login/logout — sets session cookie |
| `app/api/proxy/` | Proxies browser requests to API with session token |
| `components/` | Reusable React UI (actions, badges, forms) |
| `lib/api.ts` | `apiFetch`, `getCurrentUser` for server components |
| `lib/permissions.ts` | Client-side permission checks + nav config |
| `lib/metrics.ts` | Money/date formatting helpers |
| `middleware.ts` | Redirects unauthenticated users to `/login` |

### Page → API flow

```
Browser page
  → /api/proxy/documents   (client components, sends cookie)
  → apiFetch("/documents") (server components, sends Bearer token)
    → apps/api :4000
      → requirePermission(...)
      → service / prisma
```

---

## `apps/worker` — Invoice extraction (BullMQ consumer)

| Path | Purpose |
|------|---------|
| `src/worker.ts` | Queue consumer entry point |
| `src/extract.ts` | Orchestrates OCR + field extraction |
| `src/ocr.ts` | PDF/image text extraction |
| `src/extraction/` | Regex, validation, categorization, flags |
| `src/procurement/` | PO matching, savings, vendor scoring |
| `src/risk/` | Fraud detection during extraction |

---

## `prisma/`

| Path | Purpose |
|------|---------|
| `schema.prisma` | All models, enums, relations |
| `migrations/` | SQL migration history (one folder per sprint) |

Key model groups: `Document` (invoices), `PurchaseRequest`, `PurchaseOrder`, `Payment`, `Contract`, `User`/`Permission`, `AuditLog`.

---

## `scripts/`

| Script | Purpose |
|--------|---------|
| `backfill-*.ts` | Re-run intelligence/financials on existing DB rows |
| `verify-*.ts` | Assert a sprint feature works (run after changes) |
| `test-*.ts` | Ad-hoc service tests |

Run any script: `npx tsx scripts/<name>.ts`

---

## Demo logins (password: `fiscora123`)

| Email | Role |
|-------|------|
| admin@fiscora.com | ADMIN |
| cfo@fiscora.com | CFO |
| finance@fiscora.com | FINANCE |
| procurement@fiscora.com | PROCUREMENT |
| manager@fiscora.com | MANAGER |
| employee@fiscora.com | EMPLOYEE |
| auditor@fiscora.com | AUDITOR |

---

## Sprint roadmap (governance-first)

1. **7.1 RBAC** — Permission tables, `requirePermission` everywhere
2. **7.2** — Approval matrix builder (DB-driven rules)
3. **7.3** — Audit center
4. **7.4** — Vendor portal
5. **8** — AI copilot (after governance)
