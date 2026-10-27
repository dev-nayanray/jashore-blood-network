/**
 * Shared demo-data seeder.
 *
 * Used by:
 *   - main.ts (seed-on-boot when the database is empty and DEMO_SEED != false)
 *   - prisma/seeds/demo-data.ts (manual CLI run)
 *
 * All data is clearly fictional (test phone range +880 1700 000000-15,
 * "Demo" names). Idempotent: safe to run repeatedly — every record is
 * created with an upsert/find-first guard.
 */

import { PrismaClient } from '../lib/prisma';

/** Demo admin — log in with this phone to access the admin panel. */
export const DEMO_ADMIN_PHONE = '+8801700000000';

const DEMO_DONORS: Array<{
  phone: string;
  name: string;
  bloodGroup: string;
  verified: boolean;
  available: boolean;
}> = [
  { phone: '+8801700000001', name: 'Demo Donor One', bloodGroup: 'O_POSITIVE', verified: true, available: true },
  { phone: '+8801700000002', name: 'Demo Donor Two', bloodGroup: 'A_POSITIVE', verified: true, available: true },
  { phone: '+8801700000003', name: 'Demo Donor Three', bloodGroup: 'B_POSITIVE', verified: true, available: true },
  { phone: '+8801700000004', name: 'Demo Donor Four', bloodGroup: 'AB_POSITIVE', verified: true, available: false },
  { phone: '+8801700000005', name: 'Demo Donor Five', bloodGroup: 'O_NEGATIVE', verified: true, available: true },
  { phone: '+8801700000006', name: 'Demo Donor Six', bloodGroup: 'A_NEGATIVE', verified: false, available: true },
  { phone: '+8801700000007', name: 'Demo Donor Seven', bloodGroup: 'B_NEGATIVE', verified: false, available: true },
  { phone: '+8801700000008', name: 'Demo Donor Eight', bloodGroup: 'O_POSITIVE', verified: true, available: true },
  { phone: '+8801700000009', name: 'Demo Donor Nine', bloodGroup: 'A_POSITIVE', verified: false, available: true },
  { phone: '+8801700000010', name: 'Demo Donor Ten', bloodGroup: 'AB_NEGATIVE', verified: true, available: false },
  { phone: '+8801700000011', name: 'Demo Donor Eleven', bloodGroup: 'B_POSITIVE', verified: true, available: true },
  { phone: '+8801700000012', name: 'Demo Donor Twelve', bloodGroup: 'O_POSITIVE', verified: false, available: true },
];

const DEMO_HOSPITALS: Array<{
  name: string;
  address: string;
  phone: string;
  services: string;
}> = [
  {
    name: 'Jashore General Hospital',
    address: 'Hospital Road, Jashore Sadar',
    phone: '+880421000001',
    services: 'Emergency, Surgery, Blood Bank',
  },
  {
    name: 'Jashore 250 Bed Hospital',
    address: 'Benapole Road, Jashore Sadar',
    phone: '+880421000002',
    services: 'Emergency, ICU, Blood Transfusion',
  },
  {
    name: 'Upashahar Health Complex',
    address: 'Upashahar, Jashore Sadar',
    phone: '+880421000003',
    services: 'Outpatient, Emergency',
  },
];

export interface SeedResult {
  adminPhone: string;
  donors: number;
  requests: number;
  hospitals: number;
}

export async function seedDemoData(prisma: PrismaClient): Promise<SeedResult> {
  // The district has historically been written as both 'Jashore' and
  // 'Jessore' — accept any spelling, then fall back to any district
  // that has upazilas so the seed never aborts on naming.
  const district =
    (await prisma.district.findFirst({ where: { name: 'Jashore' }, include: { upazilas: true } })) ??
    (await prisma.district.findFirst({
      where: { name: { equals: 'Jessore', mode: 'insensitive' } },
      include: { upazilas: true },
    })) ??
    (await prisma.district.findFirst({
      where: { upazilas: { some: {} } },
      include: { upazilas: true },
    }));
  if (!district || district.upazilas.length === 0) {
    throw new Error('No district with upazilas found — run the reference-data seed first.');
  }
  const upazilas = district.upazilas;

  // ---- Admin account (SUPER_ADMINISTRATOR unlocks the admin panel) ----
  const admin = await prisma.profile.upsert({
    where: { phone: DEMO_ADMIN_PHONE },
    update: {},
    create: {
      phone: DEMO_ADMIN_PHONE,
      fullName: 'Demo Admin',
      isActive: true,
    },
  });
  for (const role of ['SUPER_ADMINISTRATOR', 'MODERATOR'] as const) {
    await prisma.userRole.upsert({
      where: { profileId_role: { profileId: admin.id, role: role as never } },
      update: {},
      create: { profileId: admin.id, role: role as never },
    });
  }

  // ---- Donor profiles (each guarded: one bad record never aborts the rest) ----
  let donorsCreated = 0;
  for (let i = 0; i < DEMO_DONORS.length; i++) {
   try {
    const d = DEMO_DONORS[i]!;
    const upazila = upazilas[i % upazilas.length]!;
    const profile = await prisma.profile.upsert({
      where: { phone: d.phone },
      update: {},
      create: {
        phone: d.phone,
        fullName: d.name,
        isActive: true,
      },
    });
    for (const role of ['REGISTERED_USER', 'DONOR'] as const) {
      await prisma.userRole.upsert({
        where: { profileId_role: { profileId: profile.id, role: role as never } },
        update: {},
        create: { profileId: profile.id, role: role as never },
      });
    }
    const existing = await prisma.donorProfile.findUnique({
      where: { profileId: profile.id },
    });
    if (!existing) {
      await prisma.donorProfile.create({
        data: {
          profileId: profile.id,
          bloodGroup: d.bloodGroup as never,
          upazilaId: upazila.id,
          isAvailable: d.available,
          availabilityConfirmedAt: new Date(),
          visibility: 'LISTED' as never,
          verificationStatus: (d.verified ? 'VERIFIED' : 'UNVERIFIED') as never,
          contactPreference: 'IN_APP_ONLY' as never,
        },
      });
    }
    donorsCreated++;
   } catch {
    // skip this donor record and continue
   }
  }

  // ---- Blood requests (requesters are demo donors) ----
  const requesters = await prisma.profile.findMany({
    where: { phone: { in: DEMO_DONORS.slice(0, 3).map((d) => d.phone) } },
  });
  const requestSpecs = [
    {
      requesterIdx: 0,
      patientDisplayName: 'Demo Patient (Surgery)',
      bloodGroup: 'O_POSITIVE',
      unitsRequested: 2,
      urgency: 'URGENT',
      hospitalName: DEMO_HOSPITALS[0]!.name,
      status: 'SEARCHING',
      daysFromNow: 7,
    },
    {
      requesterIdx: 1,
      patientDisplayName: 'Demo Patient (Thalassemia)',
      bloodGroup: 'B_POSITIVE',
      unitsRequested: 1,
      urgency: 'NORMAL',
      hospitalName: DEMO_HOSPITALS[1]!.name,
      status: 'SEARCHING',
      daysFromNow: 14,
    },
    {
      requesterIdx: 2,
      patientDisplayName: 'Demo Patient (Maternity)',
      bloodGroup: 'A_NEGATIVE',
      unitsRequested: 3,
      urgency: 'URGENT',
      hospitalName: DEMO_HOSPITALS[0]!.name,
      status: 'SEARCHING',
      daysFromNow: 2,
    },
  ];
  let requestsCreated = 0;
  for (const spec of requestSpecs) {
    const requester = requesters[spec.requesterIdx];
    if (!requester) continue;
    const existing = await prisma.bloodRequest.findFirst({
      where: { requesterId: requester.id, patientDisplayName: spec.patientDisplayName },
    });
    if (existing) continue;
    await prisma.bloodRequest.create({
      data: {
        requesterId: requester.id,
        patientDisplayName: spec.patientDisplayName,
        bloodGroup: spec.bloodGroup as never,
        unitsRequested: spec.unitsRequested,
        upazilaId: upazilas[0]!.id,
        hospitalName: spec.hospitalName,
        requiredBy: new Date(Date.now() + spec.daysFromNow * 24 * 60 * 60 * 1000),
        urgency: spec.urgency as never,
        contactMethod: 'IN_APP' as never,
        status: spec.status as never,
        expiresAt: new Date(Date.now() + (spec.daysFromNow + 1) * 24 * 60 * 60 * 1000),
      },
    });
    requestsCreated++;
  }

  // ---- Hospitals ----
  let hospitalsCreated = 0;
  for (const h of DEMO_HOSPITALS) {
    const existing = await prisma.hospital.findFirst({ where: { name: h.name } });
    if (existing) continue;
    await prisma.hospital.create({
      data: {
        name: h.name,
        upazilaId: upazilas[0]!.id,
        address: h.address,
        phone: h.phone,
        email: `${h.phone.slice(-6)}@demo.hospital`,
        operatingHours: '24/7',
        servicesOffered: h.services,
        verificationStatus: 'VERIFIED' as never,
      },
    });
    hospitalsCreated++;
  }

  return {
    adminPhone: DEMO_ADMIN_PHONE,
    donors: donorsCreated,
    requests: requestsCreated,
    hospitals: hospitalsCreated,
  };
}
