/**
 * Demo data seed for Jashore Blood Network.
 *
 * Creates clearly fictional demo data for development and demonstration.
 * All records are marked with is_fictional = true where supported,
 * or use clearly fake names/phones.
 *
 * NEVER run against production. This is for dev/demo only.
 *
 * Usage:
 *   pnpm --filter @jbn/api exec tsx prisma/seeds/demo-data.ts
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

// Fictional phone numbers using test range +880 0NNN
const FICTIONAL_PHONES = [
  '+8801700000001', '+8801700000002', '+8801700000003', '+8801700000004',
  '+8801700000005', '+8801700000006', '+8801700000007', '+8801700000008',
];

const FICTIONAL_NAMES = [
  'Demo Donor One', 'Demo Donor Two', 'Demo Donor Three', 'Demo Donor Four',
  'Demo Donor Five', 'Demo Donor Six', 'Demo Donor Seven', 'Demo Donor Eight',
];

const BLOOD_GROUPS = ['O_POSITIVE', 'A_POSITIVE', 'B_POSITIVE', 'AB_POSITIVE', 'O_NEGATIVE', 'A_NEGATIVE'] as const;

async function main() {
  console.log('🌱 Seeding DEMO data (fictional)...');

  // Get upazilas
  const district = await prisma.district.findFirst({
    where: { name: 'Jashore' },
    include: { upazilas: true },
  });
  if (!district) {
    console.error('❌ Jashore district not found. Run reference-data seed first.');
    process.exit(1);
  }
  const upazilas = district.upazilas;
  console.log(`  Found ${upazilas.length} upazilas`);

  // Create fictional profiles + donor profiles
  for (let i = 0; i < FICTIONAL_NAMES.length; i++) {
    const phone = FICTIONAL_PHONES[i]!;
    const name = FICTIONAL_NAMES[i]!;
    const upazila = upazilas[i % upazilas.length]!;
    const bloodGroup = BLOOD_GROUPS[i % BLOOD_GROUPS.length]!;

    // Upsert profile
    const profile = await prisma.profile.upsert({
      where: { phone },
      update: {},
      create: {
        id: `demo-profile-${i + 1}`,
        phone,
        fullName: name,
        email: `demo${i + 1}@example.com`,
        isActive: true,
      },
    });

    // Add REGISTERED_USER + DONOR roles
    await prisma.userRole.upsert({
      where: { profileId_role: { profileId: profile.id, role: 'REGISTERED_USER' as never } },
      update: {},
      create: { profileId: profile.id, role: 'REGISTERED_USER' as never },
    });
    await prisma.userRole.upsert({
      where: { profileId_role: { profileId: profile.id, role: 'DONOR' as never } },
      update: {},
      create: { profileId: profile.id, role: 'DONOR' as never },
    });

    // Create donor profile
    const existingDonor = await prisma.donorProfile.findUnique({
      where: { profileId: profile.id },
    });
    if (!existingDonor) {
      await prisma.donorProfile.create({
        data: {
          profileId: profile.id,
          bloodGroup: bloodGroup as never,
          upazilaId: upazila.id,
          isAvailable: true,
          availabilityConfirmedAt: new Date(),
          visibility: 'LISTED' as never,
          verificationStatus: i < 4 ? 'VERIFIED' as never : 'UNVERIFIED' as never,
          contactPreference: 'IN_APP_ONLY' as never,
        },
      });
      console.log(`  ✓ Donor: ${name} (${bloodGroup}) — ${upazila.name}`);
    }
  }

  // Create a fictional blood request
  const requesterProfile = await prisma.profile.findUnique({
    where: { phone: FICTIONAL_PHONES[0] },
  });
  if (requesterProfile) {
    const existingReq = await prisma.bloodRequest.findFirst({
      where: { requesterId: requesterProfile.id },
    });
    if (!existingReq) {
      const upazila = upazilas[0]!;
      await prisma.bloodRequest.create({
        data: {
          requesterId: requesterProfile.id,
          patientDisplayName: 'Demo Patient',
          bloodGroup: 'O_POSITIVE' as never,
          unitsRequested: 2,
          upazilaId: upazila.id,
          hospitalName: 'Demo Hospital',
          requiredBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          urgency: 'URGENT' as never,
          contactMethod: 'IN_APP' as never,
          status: 'SEARCHING' as never,
          expiresAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        },
      });
      console.log('  ✓ Demo blood request created');
    }
  }

  // Create a fictional verified hospital
  const existingHospital = await prisma.hospital.findFirst({
    where: { name: 'Demo General Hospital' },
  });
  if (!existingHospital) {
    await prisma.hospital.create({
      data: {
        name: 'Demo General Hospital',
        upazilaId: upazilas[0]!.id,
        address: 'Demo Address, Jashore Sadar',
        phone: '+880421000000',
        email: 'demo@hospital.com',
        operatingHours: '24/7',
        servicesOffered: 'Emergency, Surgery, Blood Bank',
        verificationStatus: 'VERIFIED' as never,
      },
    });
    console.log('  ✓ Demo hospital created');
  }

  console.log('\n✅ Demo data seeded. All records are FICTIONAL — do not use in production.');
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
