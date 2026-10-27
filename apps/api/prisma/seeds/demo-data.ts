/**
 * Demo data seed CLI (fictional data for demos/pilots).
 *
 * Delegates to the shared seeder in src/seed/demo-seed.ts, which is also
 * used by main.ts for seed-on-boot.
 *
 * Usage:
 *   pnpm --filter @jbn/api exec tsx prisma/seeds/demo-data.ts
 */

import { PrismaClient } from '../../src/generated/prisma';
import { seedDemoData, DEMO_ADMIN_PHONE } from '../../src/seed/demo-seed';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

async function main() {
  console.log('🌱 Seeding DEMO data (fictional)...');
  const result = await seedDemoData(prisma);
  console.log(
    `\n✅ Demo data seeded: ${result.donors} donors, ${result.requests} new requests, ${result.hospitals} new hospitals.`,
  );
  console.log(`👤 Demo admin phone (use it to log in): ${DEMO_ADMIN_PHONE}`);
  console.log('   All records are FICTIONAL — fine for demos, not for real use.');
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
