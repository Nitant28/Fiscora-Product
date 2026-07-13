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
  if (!d.token) throw new Error(`login failed: ${JSON.stringify(d)}`);
  return d.token as string;
}

async function main() {
  const token = await login();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const checks = [
    ["GET /onboarding/status", () => fetch(`${base}/onboarding/status`, { headers })],
    [
      "POST /import/vendors",
      () =>
        fetch(`${base}/import/vendors`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            csv: "name,email,paymentTerms\nBuildTest Co,buildtest@co.com,NET30",
            fileName: "test.csv",
          }),
        }),
    ],
    ["GET /import/jobs", () => fetch(`${base}/import/jobs`, { headers })],
  ];

  for (const [label, run] of checks) {
    const res = await run();
    const body = await res.json();
    console.log(`${label}: ${res.status}`, JSON.stringify(body).slice(0, 200));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
