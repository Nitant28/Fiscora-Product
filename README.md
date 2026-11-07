# Fiscora

**AI-powered procurement and spend-governance platform for growing businesses.**

Fiscora takes a purchase from request to payment in one system: a request is checked against the live department budget, routed to the right approver, sourced through competitive RFQs, turned into a purchase order, matched against the goods receipt and invoice, and only then paid. Every step is recorded in an audit trail.

[Demo video](#demo) · [Features](#features) · [Architecture](#architecture) · [Getting started](#getting-started) · [Project structure](#project-structure) · [Status and roadmap](#status-and-roadmap)

---

## The problem

In most mid-sized companies, procurement lives in email threads, spreadsheets and a separate accounting tool. That causes predictable failures:

- **Overspending:** requests are approved without anyone seeing how much of the department's budget is actually left.
- **Approval bypass:** a large purchase is split into several small ones to stay under the approval limit.
- **Weak sourcing:** vendors are chosen by habit rather than by comparing bids, so savings are never measured.
- **Invoice errors and fraud:** duplicate invoices, invoices without a purchase order, and amounts that don't match what was delivered get paid anyway.
- **No visibility:** finance and leadership find out about spend, contract renewals and vendor risk after the fact.

## What Fiscora does

| Stage | What happens |
| --- | --- |
| **Request** | Employees raise a purchase request, optionally describing it in plain English for the AI assistant to fill in. The live department budget (total, reserved, committed, available) is shown before submission. |
| **Approve** | An approval matrix routes each request by amount (Manager → Director → CFO). Managers see budget impact and an AI recommendation, and can approve from the app or with a one-click email link. |
| **Source** | Procurement runs RFQs, collects vendor bids (price, lead time, warranty), scores them, awards the winner and records the savings against the highest bid. |
| **Order** | One click generates a purchase order, which moves through a tracked lifecycle: draft, sent, accepted, received, closed. |
| **Receive and match** | Goods receipts are recorded, and each invoice is three-way matched against its PO and receipt. Mismatches and duplicates block payment. |
| **Pay** | Payments are scheduled by due date and payment terms, and can be exported to Tally. |
| **Analyse** | Dashboards for each role cover spend, savings, budgets, contracts, vendor risk and approval cycle times. |

## Features

**Workspaces by role**
- Requester, Manager, Procurement, Finance and Executive workspaces, each focused on that role's decisions.
- Role-based access control with permissions per role, and a dashboard summarising spend, approvals, invoices, contracts and vendor risk.

**Budget and policy controls**
- Budget engine with reserve, commit, release and reconciliation of department budgets.
- Amount-based approval matrix and SLA tracking for approvals.
- Split-purchase detection: related requests within a 7-day window are combined and checked against approval limits.
- Maverick-spend analysis.

**Sourcing and purchasing**
- RFQs with vendor bid comparison, scoring, award and savings tracking.
- Purchase orders generated from approved requests or awarded RFQs, with lifecycle tracking.
- Catalog of approved items.

**Invoice processing**
- Invoice upload processed asynchronously by a background worker (BullMQ on Redis).
- Extraction combines an LLM (Gemini) with rule-based heuristics; each field records where its value came from and a confidence score.
- Data-quality scoring that keeps extraction errors separate from business risk.
- Duplicate-invoice detection and three-way match (PO, goods receipt, invoice) that block payment until resolved.
- Each invoice gets a recommended next step with a risk score and the evidence behind it.

**Vendors and contracts**
- Vendor onboarding by invite, with a vendor portal for uploading compliance documents (GST, PAN, bank details, insurance, MSA, NDA).
- GSTIN validation, including PAN extraction and duplicate-GSTIN detection.
- Vendor scoring, ranking, performance and risk signals.
- Contract repository with utilization tracking, expiry alerts, a renewal queue and a contract action center.

**Platform**
- Multi-tenant: every tenant's data is isolated automatically at the data-access layer.
- Authentication with Clerk; API keys for integrations.
- Audit log of user actions, soft delete, and API rate limiting.
- CSV import for vendors, departments, users and budgets.
- Email notifications (Resend), subscription plans with feature gating, and an "Ask AI" copilot.
- Tally export for Indian accounting workflows.

## Demo
https://www.youtube.com/watch?v=tDqUaRhy91w&t=216s

## Architecture

```mermaid
flowchart LR
    U[Browser] --> W[apps/web<br/>Next.js]
    W -->|REST| A[apps/api<br/>Fastify + TypeScript]
    A --> P[(PostgreSQL<br/>Prisma ORM)]
    A -->|enqueue invoice jobs| R[(Redis<br/>BullMQ)]
    R --> K[apps/worker<br/>document processing]
    K -->|preferred| AI[apps/ai<br/>Python FastAPI<br/>/v1/extract]
    K -->|fallback| X[OCR + Gemini<br/>+ heuristics]
    K --> P
    A --> C[Clerk auth]
    A --> E[Resend email]
```

| App | Role | Stack |
| --- | --- | --- |
| `apps/web` | User interface for all workspaces, vendor portal and admin | Next.js, React, TypeScript, Clerk |
| `apps/api` | Business logic: requests, approvals, budgets, RFQs, POs, matching, payments, contracts, analytics | Fastify, TypeScript, Prisma, Zod, BullMQ |
| `apps/worker` | Background invoice and document processing | Node.js, BullMQ, Gemini, Sharp |
| `apps/ai` | Document AI service (OCR, extraction, evaluation) | Python, FastAPI, OpenCV |
| `prisma/` | Database schema (55 models) and migrations | PostgreSQL 16, Prisma 5 |

**How multi-tenancy works:** each request sets the tenant in a request-scoped context, and a Prisma client extension (`apps/api/src/lib/prismaTenant.ts`) automatically adds the tenant filter to reads and writes on tenant-owned models. `pnpm --filter api verify:tenant` checks isolation.

Architecture decisions are recorded in [`docs/adr`](docs/adr), and engineering standards in [`docs/engineering`](docs/engineering).

## Getting started

### Prerequisites

- Node.js 18+ and pnpm 9
- Docker (for PostgreSQL and Redis)
- A [Clerk](https://clerk.com) application (for authentication)
- Optional: a Gemini API key (invoice extraction), a Resend API key (email), Python 3.10+ (AI service)

### 1. Install

```bash
git clone https://github.com/Nitant28/Fiscora-Product.git
cd Fiscora-Product
pnpm install
```

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

This starts PostgreSQL on port **5433** and Redis on port **6380**.

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in at least:

| Variable | Example / purpose |
| --- | --- |
| `DATABASE_URL` | `postgresql://fiscora:fiscora@localhost:5433/fiscora` |
| `REDIS_URL` | `redis://localhost:6380` |
| `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` | From your Clerk dashboard |
| `GEMINI_API_KEY` | Invoice field extraction |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Approval and notification emails |
| `AI_SERVICE_URL` | Python AI service, default `http://localhost:8000` |
| `PORT` | API port, default `4000` |

### 4. Create the database and demo data

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

### 5. Run

```bash
pnpm dev                                   # API on :4000, web on :3000
pnpm --filter worker exec tsx src/worker.ts  # invoice worker (separate terminal)
```

Optional AI service:

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Open http://localhost:3000.

## Verification scripts

The `scripts/` folder contains end-to-end checks for core business rules, for example:

```bash
pnpm exec tsx scripts/verify-approval-matrix.ts
pnpm exec tsx scripts/verify-split-purchase-fraud.ts
pnpm exec tsx scripts/verify-duplicate-invoice-fraud.ts
pnpm exec tsx scripts/verify-rbac.ts
pnpm exec tsx scripts/verify-contract-expiry-alerts.ts
```

The Python AI service has unit, integration and golden-document tests:

```bash
cd apps/ai && pytest
```

## Project structure

```text
Fiscora-Product/
├── apps/
│   ├── web/        # Next.js frontend
│   ├── api/        # Fastify API (modules/, services/, integrations/tally)
│   ├── worker/     # BullMQ document-processing worker
│   ├── ai/         # Python FastAPI document-AI service
│   └── docs/       # Documentation site
├── packages/       # Shared UI, ESLint and TypeScript config
├── prisma/         # schema.prisma, migrations, seed
├── scripts/        # Verification and backfill scripts
├── golden_documents/  # Expected outputs for invoice, PO and receipt tests
├── docs/           # ADRs and engineering standards
└── docker-compose.yml
```

## Status and roadmap

Fiscora is an actively developed portfolio project. The procurement workflow (requests, approvals, budgets, RFQs, POs, matching, payments, contracts, vendors, analytics) is implemented in the API and web apps.

In progress:
- [ ] Python AI service: several OCR engines, image-enhancement steps and pipelines are still placeholders.
- [ ] Replace the fallback OCR provider's public demo key with a configurable key or a self-hosted OCR engine.
- [ ] Automated test suites for the API and worker, run in CI.
- [ ] Production deployment guide.

## Tech stack

TypeScript · Next.js · React · Fastify · Prisma · PostgreSQL · Redis · BullMQ · Clerk · Resend · Gemini · Python · FastAPI · OpenCV · Docker · Turborepo · pnpm

## Author

**Nitant Singh** — [GitHub](https://github.com/Nitant28)
