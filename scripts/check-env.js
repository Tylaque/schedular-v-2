const isProductionBuild =
  process.env.RENDER !== undefined ||
  process.env.NODE_ENV === "production";

if (!isProductionBuild) {
  process.exit(0);
}

const url = process.env.DATABASE_URL || "";

if (!url) {
  console.error(
    "\n  DATABASE_URL is missing or empty.\n" +
    "  Set a real database connection string in your hosting provider's environment variables.\n"
  );
  process.exit(1);
}

if (/localhost/i.test(url) || /127\.0\.0\.1/.test(url)) {
  console.error(
    "\n  DATABASE_URL points to localhost in a production build.\n" +
    "  Set a real database connection string in your hosting provider's environment variables.\n" +
    `  (found: ${url.slice(0, 60)}...)\n`
  );
  process.exit(1);
}
