// Test-only HTTPS interceptor: routes Resend API calls to a local success,
// so verification can run without a live Resend key. Logs the payload's `to`.
const realFetch = typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url ?? "";
  if (url.includes("api.resend.com")) {
    let to = "?";
    try {
      const body = JSON.parse(init.body || "{}");
      to = Array.isArray(body.to) ? body.to.join(",") : String(body.to ?? "?");
    } catch {}
    console.error(`[MOCK-RESEND] ${init.method || "GET"} ${url}  to=${to}`);
    return new Response(JSON.stringify({ id: "cm_mock_" + Date.now() }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (realFetch) return realFetch(input, init);
  throw new Error("no global fetch");
};