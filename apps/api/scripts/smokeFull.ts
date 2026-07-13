/**
 * Full smoke test for Import Center + Onboarding API routes.
 */
const base = "http://127.0.0.1:4000";

async function login() {
  const r = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@fiscora.com",
      password: "fiscora123",
    }),
  });
  const d = await r.json();
  if (!d.token) throw new Error(`Login failed: ${JSON.stringify(d)}`);
  return d.token as string;
}

async function request(
  token: string,
  method: string,
  path: string,
  body?: unknown
) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const token = await login();
  const stamp = Date.now();

  const tests: { name: string; run: () => Promise<{ status: number }> }[] = [
    {
      name: "GET /health",
      run: async () => {
        const r = await fetch(`${base}/health`);
        return { status: r.status };
      },
    },
    {
      name: "GET /onboarding/status",
      run: async () => request(token, "GET", "/onboarding/status"),
    },
    {
      name: "POST /import/departments",
      run: async () =>
        request(token, "POST", "/import/departments", {
          csv: `name,budget\nSmoke IT ${stamp},500000\nSmoke Finance ${stamp},300000`,
          fileName: "dept-smoke.csv",
        }),
    },
    {
      name: "POST /import/budgets",
      run: async () =>
        request(token, "POST", "/import/budgets", {
          csv: `name,budget\nSmoke IT ${stamp},600000`,
          fileName: "budget-smoke.csv",
        }),
    },
    {
      name: "POST /import/vendors",
      run: async () =>
        request(token, "POST", "/import/vendors", {
          csv: `name,email,paymentTerms\nSmokeVendor ${stamp},v${stamp}@test.com,NET30`,
          fileName: "vendor-smoke.csv",
        }),
    },
    {
      name: "POST /import/users",
      run: async () =>
        request(token, "POST", "/import/users", {
          csv: `name,email,role,department\nSmoke User,smoke${stamp}@test.com,EMPLOYEE,Smoke IT ${stamp}`,
          fileName: "user-smoke.csv",
        }),
    },
    {
      name: "POST /onboarding/company",
      run: async () =>
        request(token, "POST", "/onboarding/company", {
          name: "Default Company",
          industry: "Manufacturing",
          currency: "INR",
          timezone: "Asia/Kolkata",
        }),
    },
    {
      name: "GET /import/jobs",
      run: async () => request(token, "GET", "/import/jobs"),
    },
    {
      name: "GET /departments",
      run: async () => request(token, "GET", "/departments"),
    },
    {
      name: "GET /vendors",
      run: async () => request(token, "GET", "/vendors"),
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const { status, data } = await test.run();
      const ok = status >= 200 && status < 300;
      if (ok) {
        passed++;
        console.log(`PASS ${test.name} (${status})`);
      } else {
        failed++;
        console.log(`FAIL ${test.name} (${status})`, JSON.stringify(data).slice(0, 120));
      }
    } catch (error) {
      failed++;
      console.log(`FAIL ${test.name}`, error);
    }
  }

  console.log(`\n${passed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
  console.log("All smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
