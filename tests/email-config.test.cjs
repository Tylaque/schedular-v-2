const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../lib/email-config.ts");

async function withEnv(values, callback) {
  const original = {};
  for (const key of Object.keys(values)) {
    original[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try { await callback(); }
  finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("getEmailFrom requires production config and uses labeled non-delivery placeholder elsewhere", async () => {
  await withEnv({ NODE_ENV: "production", EMAIL_FROM: "Scheduler <mail@careerconnectionskenya.com>", EMAIL_REPLY_TO: undefined }, () => {
    assert.equal(config.getEmailFrom(), "Scheduler <mail@careerconnectionskenya.com>");
    console.log("RAW getEmailFrom configured:", config.getEmailFrom());
  });

  await withEnv({ NODE_ENV: "production", EMAIL_FROM: undefined, EMAIL_REPLY_TO: undefined }, () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(" "));
    try {
      assert.throws(() => config.getEmailFrom(), /EMAIL_FROM is required in production/);
    } finally { console.error = originalError; }
    assert.equal(errors.length, 1);
    console.log("RAW getEmailFrom production unset:", JSON.stringify({ error: "EMAIL_FROM is required in production", log: errors[0] }));
  });

  await withEnv({ NODE_ENV: "development", EMAIL_FROM: undefined, EMAIL_REPLY_TO: undefined }, () => {
    const from = config.getEmailFrom();
    assert.match(from, /development\/test only/);
    assert.match(from, /@example\.invalid>/);
    assert.equal(config.getEmailReplyTo(), from);
    console.log("RAW getEmailFrom development unset:", JSON.stringify({ from, replyTo: config.getEmailReplyTo() }));
  });
});

test("configured From and reply-to are used in mocked sends for every email category", async () => {
  await withEnv({
    NODE_ENV: "test",
    EMAIL_FROM: "Scheduler <notifications@careerconnectionskenya.com>",
    EMAIL_REPLY_TO: "support@careerconnectionskenya.com",
  }, async () => {
    const categories = [
      "admin_invitation", "availability_request", "participant_invitation", "booking_confirmation",
      "reminder_24h", "reminder_1h", "reschedule_notice", "cancellation_notice", "waitlist_offer",
      "zoom_fallback_to_teams", "zoom_pool_full_no_fallback", "reminder", "integration_failure",
      "verification_pin",
    ];
    const sends = [];
    const mockedSend = async (payload) => { sends.push(payload); return { id: `mock-${sends.length}` }; };
    for (const category of categories) {
      const fields = config.getEmailSendOptions();
      await mockedSend({ category, ...fields });
    }
    for (const send of sends) {
      assert.equal(send.from, "Scheduler <notifications@careerconnectionskenya.com>");
      assert.equal(send.replyTo, "support@careerconnectionskenya.com");
      console.log("RAW mocked email envelope:", JSON.stringify({ category: send.category, from: send.from, replyTo: send.replyTo }));
    }
    assert.equal(sends.length, categories.length);
  });
});

test("default demo aliases remain byte-identical and configurable", async () => {
  await withEnv({ DEMO_ADMIN_DOMAIN: undefined }, () => {
    const demo = require("../lib/demo.ts");
    assert.deepEqual(demo.DEMO_STAFF_EMAILS, [
      "notifications+staff1@eureka-ent.org",
      "notifications+staff2@eureka-ent.org",
      "notifications+staff3@eureka-ent.org",
    ]);
    assert.equal(demo.demoRecipientEmail("participant", "notifications+demo-guest-1@eureka-ent.org"), "notifications+demo-guest-1@eureka-ent.org");
    assert.equal(demo.demoRecipientEmail("participant", "outside@example.test"), "notifications+participant@eureka-ent.org");
    assert.equal(demo.demoRecipientEmail("admin", "outside@example.test"), "notifications+owner@eureka-ent.org");
    console.log("RAW demo aliases:", JSON.stringify({ staff: demo.DEMO_STAFF_EMAILS, participant: "notifications+participant@eureka-ent.org", owner: "notifications+owner@eureka-ent.org" }));
  });
  await withEnv({ DEMO_ADMIN_DOMAIN: "careerconnectionskenya.com" }, () => {
    assert.equal(config.getDemoAliasDomain(), "careerconnectionskenya.com");
    console.log("RAW configurable demo alias domain:", config.getDemoAliasDomain());
  });
});

test("application source has no hardcoded old-domain sender strings", () => {
  const root = path.resolve(__dirname, "..");
  const directories = ["app", "lib", "components", "scripts"];
  const forbidden = [/notifications@eureka-ent\.org/i, /onboarding@resend\.dev/i, /Scheduler\s*<[^>]*eureka-ent\.org/i];
  const matches = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        for (const pattern of forbidden) if (pattern.test(text)) matches.push(path.relative(root, full));
      }
    }
  }
  for (const directory of directories) walk(path.join(root, directory));
  assert.deepEqual(matches, []);
  console.log("RAW old-domain sender scan:", JSON.stringify({ directories, matches }));
});
