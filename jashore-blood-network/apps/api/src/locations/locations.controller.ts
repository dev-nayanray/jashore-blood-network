/**
 * LocationsController — public read-only location reference data.
 *
 * Routes:
 *   GET /api/v1/locations/districts           — list all districts
 *   GET /api/v1/locations/upazilas            — list all upazilas (optional ?districtId=)
 *
 * Both routes are @Public() — location reference data is needed for the
 * donor registration form and the search filter UI before authentication.
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { LocationsService } from './locations.service';
import type { DistrictDto, UpazilaDto } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Public()
  @Get('districts')
  async listDistricts(): Promise<DistrictDto[]> {
    return this.locationsService.listDistricts();
  }

  @Public()
  @Get('upazilas')
  async listUpazilas(
    @Query('districtId') districtId?: string,
  ): Promise<UpazilaDto[]> {
    return this.locationsService.listUpazilas(districtId);
  }
}
