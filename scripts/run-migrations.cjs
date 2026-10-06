/**
 * Cross-platform deterministic migration runner script.
 * Can be executed via node in CI/CD pipelines, container entrypoints, or local npm scripts.
 */
const { execSync } = require('child_process');

console.log('🚀 [Migration Runner] Initiating Prisma migrations deploy...');

try {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('✅ [Migration Runner] All pending migrations deployed successfully.');
  process.exit(0);
} catch (error) {
  console.error('❌ [Migration Runner] FATAL: Prisma migration deployment failed!');
  if (error.message) {
    console.error(error.message);
  }
  process.exit(1);
}
