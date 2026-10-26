/**
 * LocationsService — read-only access to the location reference data.
 *
 * Returns districts, upazilas, and (in a future phase) localities.
 * The data is seeded by `prisma/seeds/reference-data.ts` and is publicly
 * readable (no RLS on districts/upazilas).
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../lib/prisma';

export interface DistrictDto {
  id: string;
  name: string;
  country: string;
  code: string | null;
}

export interface UpazilaDto {
  id: string;
  name: string;
  districtId: string;
  code: string | null;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaClient) {}

  async listDistricts(): Promise<DistrictDto[]> {
    const districts = await this.prisma.district.findMany({
      orderBy: { name: 'asc' },
    });
    return districts.map((d) => ({
      id: d.id,
      name: d.name,
      country: d.country,
      code: d.code,
    }));
  }

  async listUpazilas(districtId?: string): Promise<UpazilaDto[]> {
    const upazilas = await this.prisma.upazila.findMany({
      where: districtId ? { districtId } : undefined,
      orderBy: { name: 'asc' },
    });
    return upazilas.map((u) => ({
      id: u.id,
      name: u.name,
      districtId: u.districtId,
      code: u.code,
    }));
  }
}
