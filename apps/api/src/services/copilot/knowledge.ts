/**
 * Fiscora Internal Knowledge Base.
 *
 * This is the copilot's PRIMARY source of truth for "how / what / explain"
 * questions — pages, features, workflows, permissions, procurement processes,
 * and AI modules. The copilot searches this BEFORE ever reaching the LLM; the
 * LLM only rephrases the matched article(s). Nothing here is general knowledge.
 *
 * The structure is deliberately RAG-ready: each article is a self-contained
 * chunk with keywords. A future indexer.ts/embeddings.ts can index `body` for
 * vector search without changing the copilot engine — swap `searchKnowledge`.
 */

export interface KnowledgeArticle {
  id: string;
  title: string;
  /** Optional page this article maps to (enables "learn + go there"). */
  route?: string;
  category:
    | "workflow"
    | "feature"
    | "ai"
    | "security"
    | "concept"
    | "getting-started";
  summary: string;
  /** Grounding text the LLM may rephrase. Fiscora-specific, factual. */
  body: string;
  keywords: string[];
}

export const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: "kb-purchase-request",
    title: "Creating a Purchase Request",
    route: "/requests",
    category: "workflow",
    summary: "How to raise a purchase request (PR) in Fiscora.",
    body: "A Purchase Request (PR) is the starting point of procurement in Fiscora. Open Purchase Requests from the sidebar, click 'New Request', then enter a title, category, estimated amount, and (optionally) a preferred vendor. On submit, the request moves from DRAFT to SUBMITTED and is routed to an approver based on the approval matrix (amount + department + category). You can track its status — SUBMITTED, APPROVED, REJECTED, or CONVERTED_TO_PO — from the same page.",
    keywords: ["purchase request", "create request", "raise request", "requisition", "new pr", "pr", "how to request"],
  },
  {
    id: "kb-rfq",
    title: "RFQ Workflow",
    route: "/rfqs",
    category: "workflow",
    summary: "How the Request for Quotation process works.",
    body: "An RFQ (Request for Quotation) lets Procurement collect competitive bids from vendors. The flow is: create the RFQ with line items, open it for bidding, invite vendors, receive and score their bids, then award to the winning vendor. Awarding an RFQ can generate a Purchase Order automatically. RFQs are visible to Procurement, and results feed savings analytics.",
    keywords: ["rfq", "request for quote", "quotation", "bidding", "bids", "tender", "award", "rfq workflow"],
  },
  {
    id: "kb-invoice-approval",
    title: "Invoice Approval",
    route: "/documents",
    category: "workflow",
    summary: "How invoices are reviewed, matched, and approved.",
    body: "When an invoice is uploaded, Fiscora extracts its fields (vendor, invoice number, amounts, taxes) and runs validation and 3-way matching against the related PO and goods receipt. Finance and CFO roles review the invoice, resolve any flags, and approve or reject it. Approved invoices proceed to payment. Every action is captured in the audit trail.",
    keywords: ["invoice approval", "approve invoice", "invoice review", "invoice workflow", "how does invoice approval work"],
  },
  {
    id: "kb-three-way-match",
    title: "Three-Way Matching",
    category: "concept",
    summary: "What 3-way matching is and how Fiscora automates it.",
    body: "Three-way matching is a control that compares three documents before payment: the Purchase Order (what was ordered), the Goods Receipt Note / GRN (what was received), and the Invoice (what is being billed). Fiscora automatically matches quantities and amounts across all three and flags mismatches — price mismatch, quantity mismatch, or missing PO — so you never overpay or pay for undelivered goods.",
    keywords: ["3-way match", "three way match", "three-way matching", "matching", "po grn invoice", "match"],
  },
  {
    id: "kb-ocr",
    title: "OCR & AI Extraction in Fiscora",
    category: "ai",
    summary: "How Fiscora reads and extracts data from documents.",
    body: "Fiscora's Document Intelligence pipeline processes uploaded documents through stages: image intelligence (quality analysis and enhancement — deskew, denoise, contrast), OCR to read text, and field extraction to pull structured data such as vendor, invoice number, dates, taxes, and totals. Each extracted field carries a confidence score and provenance so you can see how it was derived. Low-confidence fields are routed for human review rather than trusted blindly.",
    keywords: ["ocr", "extraction", "ai extraction", "how does ocr work", "document intelligence", "read document", "scan"],
  },
  {
    id: "kb-procurement-intelligence",
    title: "Procurement Intelligence",
    route: "/analytics",
    category: "ai",
    summary: "How Fiscora turns procurement data into insight.",
    body: "Procurement Intelligence is where Fiscora goes beyond document reading. It detects duplicate invoices, flags potential fraud and maverick/off-contract spend, scores vendor risk, surfaces savings opportunities, and checks policy and budget compliance. These insights draw on every prior stage (extraction, validation, matching) and are what make Fiscora a procurement platform rather than just an OCR tool.",
    keywords: ["procurement intelligence", "duplicate invoice", "fraud", "vendor risk", "savings", "maverick spend", "policy", "insights"],
  },
  {
    id: "kb-permissions",
    title: "Fiscora Permissions (RBAC)",
    route: "/admin/permissions",
    category: "security",
    summary: "How roles and permissions control access.",
    body: "Fiscora uses role-based access control (RBAC). Each user has a role (Employee, Manager, Director, Procurement, Finance, CFO, Auditor, Admin, Vendor), and each role is granted a set of permissions (e.g. request.approve, invoice.view, payment.approve). Permissions gate both UI pages and API actions, and are enforced on every request. Admins manage the role-permission matrix from Roles & Permissions.",
    keywords: ["permission", "permissions", "rbac", "role", "roles", "access control", "who can", "fiscora permissions"],
  },
  {
    id: "kb-vendor-management",
    title: "Vendor Management",
    route: "/vendors",
    category: "feature",
    summary: "Managing suppliers and vendor onboarding.",
    body: "Vendor Management is the directory of your suppliers. Procurement can add vendors, capture GST/PAN and bank details, invite vendors to self-onboard through the vendor portal, and track compliance and risk. Vendor onboarding submissions are reviewed and approved before a vendor becomes active and eligible for POs and payments.",
    keywords: ["vendor", "vendors", "supplier", "suppliers", "vendor management", "onboard vendor", "vendor onboarding"],
  },
  {
    id: "kb-payments",
    title: "Payments",
    route: "/payments",
    category: "workflow",
    summary: "How approved invoices become payments.",
    body: "Once an invoice is approved, it enters the payments pipeline. Finance processes and readies payments, payments are approved (CFO/Finance), and then marked as paid. Fiscora tracks payment status and cash-flow so you always know what is due, scheduled, or paid, and can export to accounting systems like Tally.",
    keywords: ["payment", "payments", "pay invoice", "disbursement", "cash flow", "mark paid"],
  },
  {
    id: "kb-contracts",
    title: "Contracts",
    route: "/contracts",
    category: "feature",
    summary: "Managing contracts, renewals, and obligations.",
    body: "The Contracts module stores vendor and service contracts with their key terms — parties, effective and expiry dates, renewal terms, and obligations. Fiscora surfaces upcoming renewals and expiries so contracts don't lapse silently, and contract intelligence extracts clauses for review.",
    keywords: ["contract", "contracts", "renewal", "expiry", "agreement", "obligation", "clause"],
  },
  {
    id: "kb-approvals",
    title: "Approvals Inbox",
    route: "/approvals",
    category: "workflow",
    summary: "Where approvers act on pending items.",
    body: "The Approvals Inbox is where approvers see items awaiting their decision — purchase requests, invoices, and payments routed to them by the approval matrix. From here you can approve or reject with a reason. Who can approve what is determined by role and the approval rules (amount, department, category).",
    keywords: ["approval", "approvals", "pending approval", "approve", "reject", "approval inbox", "what needs my approval"],
  },
  {
    id: "kb-analytics",
    title: "Analytics & Control Tower",
    route: "/analytics",
    category: "feature",
    summary: "Spend, savings, and procurement KPIs.",
    body: "Analytics (the Control Tower) gives leadership a real-time view of procurement: total spend, spend by category and department, savings achieved, cycle times, and risk. It's the executive dashboard for understanding where money goes and where to optimize.",
    keywords: ["analytics", "control tower", "spend", "savings", "kpi", "report", "reports", "dashboard", "metrics"],
  },
  {
    id: "kb-audit",
    title: "Audit Trail",
    route: "/admin/audit",
    category: "security",
    summary: "The forensic record of every action.",
    body: "Fiscora records an immutable audit trail of significant actions — who did what, when, with which permission, and from where. Auditors and admins can filter and export this evidence for compliance. Even AI Copilot interactions are logged, so every action is traceable.",
    keywords: ["audit", "audit trail", "audit log", "activity", "history", "compliance evidence", "forensic"],
  },
  {
    id: "kb-copilot",
    title: "Fiscora AI Copilot",
    category: "ai",
    summary: "What the copilot can do and how it stays grounded.",
    body: "The Fiscora AI Copilot answers questions and navigates the app using only your Fiscora workspace — your data, your permissions, and Fiscora's knowledge base. It routes your question to an approved, permission-checked tool, grounds the answer in real results, and uses a language model only to phrase that grounded answer. It never uses general internet knowledge and never reveals data your role can't access.",
    keywords: ["copilot", "ai copilot", "assistant", "ask ai", "what can you do", "help", "chatbot"],
  },
  {
    id: "kb-getting-started",
    title: "Getting Started with Fiscora",
    route: "/dashboard",
    category: "getting-started",
    summary: "A quick orientation to the platform.",
    body: "Fiscora is an AI procurement intelligence platform. A typical flow: raise a Purchase Request, source via RFQ, issue a Purchase Order, receive goods (GRN), upload the Invoice (Fiscora extracts and 3-way matches it), approve, and pay. The Dashboard gives you an overview, and the Analytics/Control Tower shows spend and savings across the organization.",
    keywords: ["getting started", "overview", "what is fiscora", "how does fiscora work", "introduction", "procure to pay", "p2p"],
  },
];

export interface KnowledgeHit {
  article: KnowledgeArticle;
  score: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "how", "do", "does", "what", "explain",
  "to", "in", "of", "for", "me", "my", "i", "can", "you", "about", "and",
  "with", "on", "it", "this", "that", "work", "works", "tell",
  // Generic question / filler words — never domain vocabulary (so they don't
  // leak into the scope lexicon and let general questions slip through).
  "who", "when", "where", "why", "which", "whose", "will", "should", "was",
  "were", "your", "into", "from", "get", "new",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t)
  );
}

/**
 * Deterministic keyword search over the knowledge base. Returns the best
 * matching articles (highest score first). A future embeddings-based indexer
 * can replace this function body without touching callers.
 */
export function searchKnowledge(query: string, limit = 3): KnowledgeHit[] {
  const q = query.toLowerCase();
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];

  const hits: KnowledgeHit[] = [];

  for (const article of KNOWLEDGE_BASE) {
    let score = 0;

    for (const kw of article.keywords) {
      if (q.includes(kw)) {
        score += 10 + kw.length / 5; // phrase match is strong
      }
    }

    const titleTokens = tokenize(article.title);
    for (const t of titleTokens) {
      if (qTokens.has(t)) score += 4;
    }

    const bodyTokens = new Set(tokenize(`${article.summary} ${article.body}`));
    for (const t of qTokens) {
      if (bodyTokens.has(t)) score += 1;
    }

    if (score > 0) hits.push({ article, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** All lowercase domain terms — used by the scope classifier. */
export function knowledgeLexicon(): Set<string> {
  const lex = new Set<string>();
  for (const a of KNOWLEDGE_BASE) {
    for (const kw of a.keywords) {
      for (const t of tokenize(kw)) lex.add(t);
    }
    for (const t of tokenize(a.title)) lex.add(t);
  }
  return lex;
}
