const isProductionBuild =
  process.env.RENDER !== undefined ||
  process.env.NODE_ENV === "production";

if (!isProductionBuild) {
  process.exit(0);
}

const url = process.env.DATABASE_URL || "";

if (!url) {
  // DATABASE_URL may be injected at runtime (not build time) on many hosts.
  // Skip validation if it's absent during build — the health endpoint will catch runtime issues.
  console.warn(
    "\n  [check-env] DATABASE_URL is not set during build.\n" +
    "  This is expected if your hosting provider injects it at runtime.\n" +
    "  Skipping localhost check.\n"
  );
  process.exit(0);
}

if (/localhost/i.test(url) || /127\.0\.0\.1/.test(url)) {
  console.error(
    "\n  DATABASE_URL points to localhost in a production build.\n" +
    "  Set a real database connection string in your hosting provider's environment variables.\n" +
    `  (found: ${url.slice(0, 60)}...)\n`
  );
  process.exit(1);
}
