// Verify the super_admin/org_owner password-login block against production.
// Usage: node scripts/verify-password-block.js <email> <password>
// Expectation: REJECTED for super_admin/org_owner (security fix intact).
// Exit code 0 = rejected (good), 1 = accepted (BAD - bypass present), 2 = harness error.
const BASE = "https://eureka-ent.org";

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: node scripts/verify-password-block.js <email> <password>");
    process.exit(2);
  }

  let cookies = "";
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { cache: "no-store" });
  const csrfBody = await csrfRes.json();
  if (!csrfBody.csrfToken) {
    console.error(`Could not fetch CSRF token (status ${csrfRes.status}).`);
    process.exit(2);
  }
  cookies = (csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [])
    .map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookies },
    body: new URLSearchParams({ csrfToken: csrfBody.csrfToken, email, password, json: "true" }).toString(),
    redirect: "manual",
  });
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const sessionCookie = setCookies.find((c) => /session-token=/.test(c));
  const location = res.headers.get("location");

  console.log(`email:       ${email}`);
  console.log(`result:      ${sessionCookie ? "ACCEPTED (session cookie set)" : "REJECTED (no session cookie)"}`);
  console.log(`location:    ${location}`);
  console.log(`expected:    REJECTED for super_admin/org_owner`);
  if (sessionCookie) {
    console.log("FAIL: password login was accepted - the role block may be bypassed.");
    process.exit(1);
  }
  if (!location || /error=/.test(location) === false) {
    console.log("Note: no sign-in error in redirect; treat rejection as authoritative only if no session cookie.");
  }
  console.log("PASS: login rejected - security fix intact.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
