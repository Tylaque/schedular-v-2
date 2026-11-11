const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createAuthorizationHelpers } = require("../lib/authz.ts");

function setup({ session, admins = {}, projects = {}, bookings = {} } = {}) {
  return createAuthorizationHelpers({
    getSession: async () => session ?? null,
    findAdmin: async (id) => admins[id] ?? null,
    findProject: async (id) => projects[id] ?? null,
    findBooking: async (id) => bookings[id] ?? null,
  });
}

test("requireActiveSession re-reads active admin identity and role from the DB", async () => {
  const active = setup({
    session: { user: { id: "fresh", role: "org_owner", isActive: false } },
    admins: { fresh: { id: "fresh", role: "admin", isActive: true } },
  });
  assert.deepEqual(await active.requireActiveSession(), { id: "fresh", role: "admin" });

  const noSession = setup();
  await assert.rejects(noSession.requireActiveSession(), /Unauthorized/);
  const deleted = setup({ session: { user: { id: "deleted" } } });
  await assert.rejects(deleted.requireActiveSession(), /Unauthorized/);
  const inactive = setup({
    session: { user: { id: "inactive" } },
    admins: { inactive: { id: "inactive", role: "org_owner", isActive: false } },
  });
  const legacy = await inactive.requireActiveSession((reason) => ({ ok: false, reason }));
  assert.deepEqual(legacy, { ok: false, reason: "unauthorized" });
});

test("requireRole permits only listed fresh roles and supports return-style denials", async () => {
  const helpers = setup({
    session: { user: { id: "actor" } },
    admins: { actor: { id: "actor", role: "super_admin", isActive: true } },
  });
  const actor = await helpers.requireActiveSession();
  assert.deepEqual(helpers.requireRole(actor, ["super_admin"]), actor);
  assert.deepEqual(helpers.requireRole(actor, ["org_owner"], (reason) => ({ ok: false, reason })), {
    ok: false, reason: "forbidden",
  });
  assert.throws(() => helpers.requireRole(actor, ["admin"]), /Forbidden/);
});

test("requireProjectAccess preserves canManageProject owner rules", async () => {
  const helpers = setup({ projects: { owned: { ownerId: "owner" }, ownerless: { ownerId: null } } });
  const owner = { id: "owner", role: "super_admin" };
  const orgOwner = { id: "global", role: "org_owner" };
  const outsider = { id: "other", role: "super_admin" };
  assert.equal(await helpers.requireProjectAccess(owner, "owned"), owner);
  assert.equal(await helpers.requireProjectAccess(orgOwner, "ownerless"), orgOwner);
  await assert.rejects(helpers.requireProjectAccess(outsider, "owned"), /Forbidden/);
  await assert.rejects(helpers.requireProjectAccess(owner, "missing"), /Forbidden/);
});

test("requireBookingAccess permits org owner, project owner, or assigned admin", async () => {
  const helpers = setup({ bookings: {
    assigned: { adminId: "assigned", project: { ownerId: "project-owner" } },
  } });
  const assigned = { id: "assigned", role: "admin" };
  const owner = { id: "project-owner", role: "super_admin" };
  const orgOwner = { id: "global", role: "org_owner" };
  const outsider = { id: "outsider", role: "super_admin" };
  assert.equal(await helpers.requireBookingAccess(assigned, "assigned"), assigned);
  assert.equal(await helpers.requireBookingAccess(owner, "assigned"), owner);
  assert.equal(await helpers.requireBookingAccess(orgOwner, "assigned"), orgOwner);
  await assert.rejects(helpers.requireBookingAccess(outsider, "assigned"), /Forbidden/);
  await assert.rejects(helpers.requireBookingAccess(assigned, "missing"), /Forbidden/);
});
