/**
 * Reference data seed for Jashore Blood Network.
 *
 * This seed inserts ONLY legitimate reference data:
 *   - The country is implicit (Bangladesh) on each district row.
 *   - One district: Jashore.
 *   - Eight upazilas of Jashore.
 *
 * It does NOT insert any:
 *   - Donor records
 *   - Hospital records
 *   - Blood bank records
 *   - Blood request records
 *   - User accounts / profiles
 *
 * Idempotent: safe to run multiple times. Uses upsert keyed on (name, country)
 * for districts and (districtId, name) for upazilas.
 *
 * Usage:
 *   pnpm --filter @jbn/api prisma:seed
 *
 * Requires DATABASE_URL and DIRECT_URL env vars. In production, run only
 * against the production database with explicit approval.
 */

import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

// Verified administrative reference data.
// Source: Bangladesh Bureau of Statistics, Jashore District statistics.
// Names must be re-verified against authoritative sources before any
// production deployment.
const JASHORE_UPAZILAS = [
  'Jashore Sadar',
  'Abhaynagar',
  'Bagherpara',
  'Chaugachha',
  'Jhikargachha',
  'Keshabpur',
  'Manirampur',
  'Sharsha',
] as const;

async function main() {
  console.log('🌱 Seeding reference data…');

  // 1. Upsert the Jashore district
  const district = await prisma.district.upsert({
    where: { name_country: { name: 'Jashore', country: 'Bangladesh' } },
    update: {},
    create: {
      name: 'Jashore',
      country: 'Bangladesh',
      code: 'JSR',
    },
  });
  console.log(`  ✓ District: ${district.name} (${district.id})`);

  // 2. Upsert each upazila
  for (const upazilaName of JASHORE_UPAZILAS) {
    const upazila = await prisma.upazila.upsert({
      where: {
        districtId_name: {
          districtId: district.id,
          name: upazilaName,
        },
      },
      update: {},
      create: {
        districtId: district.id,
        name: upazilaName,
      },
    });
    console.log(`  ✓ Upazila: ${upazila.name} (${upazila.id})`);
  }

  console.log(`\n✅ Seeded 1 district and ${JASHORE_UPAZILAS.length} upazilas.`);
  console.log('   No donor, hospital, or user records were inserted.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
