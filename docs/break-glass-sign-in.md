# Break-glass Microsoft sign-in recovery

Use this procedure when an invited admin cannot complete the first Microsoft sign-in because an incorrect Microsoft identity is linked to the admin row. Run SQL against the intended database only. The examples use PostgreSQL and require the admin's exact `Admin.id`.

## Inspect admins and linked accounts (read-only)

```sql
SELECT a.id, a.email, ac.provider, ac."providerAccountId"
FROM "Admin" a LEFT JOIN "Account" ac ON ac."userId" = a.id
ORDER BY a.email, ac.provider;
```

## Unlink one admin's Microsoft account

Confirm the admin ID with the admin first. Substitute that exact ID in all three statements. Run the statements in the same database session. The `SELECT` is the review gate: confirm it returns only the intended admin's `azure-ad` account before running the `DELETE`.

```sql
BEGIN;

-- Review the exact row before deleting it.
SELECT a.id, a.email, ac.provider, ac."providerAccountId"
FROM "Admin" a
JOIN "Account" ac ON ac."userId" = a.id
WHERE a.id = '<ADMIN_ID>' AND ac.provider = 'azure-ad'
FOR UPDATE OF a, ac;

-- Delete only that admin's Microsoft identity link.
DELETE FROM "Account"
WHERE "userId" = '<ADMIN_ID>' AND provider = 'azure-ad';

-- Verify no Microsoft identity remains linked to this admin.
SELECT a.id, a.email, ac.provider, ac."providerAccountId"
FROM "Admin" a
LEFT JOIN "Account" ac ON ac."userId" = a.id AND ac.provider = 'azure-ad'
WHERE a.id = '<ADMIN_ID>';

-- COMMIT only after verifying the result. Otherwise run ROLLBACK.
COMMIT;
```

If the first `SELECT` returns no row or more than one row, stop and `ROLLBACK`; do not run the delete. Afterward, the admin can retry first-time linking with the invited email address. The account link is created only after the application verifies that the admin is active and the Microsoft identity belongs to the configured tenant.

## Confirm sign-in

Open the deployed sign-in page in a private browser window and choose Microsoft sign-in. Use the invited Microsoft account in the configured tenant. Confirm the user reaches the admin area and that the expected role and account are shown. Sign out, then repeat once to confirm the linked account signs in normally. Check the application logs for authentication errors without copying tokens or secrets.

`org_owner` and `super_admin` roles cannot use password login. They need an account in the configured Microsoft tenant and must use Microsoft sign-in.

## Render rollback

In the Render dashboard, open the web service, select **Events**, locate the last known-good deploy, and use **Rollback** (or **Redeploy** that successful deploy, depending on the dashboard controls). Confirm the target release before starting. Wait for the rollback deploy to become live, then verify the sign-in page and a fresh sign-in. If the previous release is not available, deploy the prior known-good commit from the service's **Deploys** page.

## Azure account-type change order

Set the required Render environment variables first, deploy, and verify a fresh Microsoft sign-in. Only after that succeeds, change the Azure app registration's **Supported account types**. This order keeps the running application tenant configuration aligned with the identity-provider setting during the transition.
