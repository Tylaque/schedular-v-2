const { execSync } = require("child_process");
try {
  execSync("npx prisma generate", { stdio: "inherit" });
} catch {
  console.log("prisma generate skipped (DATABASE_URL not set during build)");
  process.exit(0);
}
