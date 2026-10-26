import { Module } from '@nestjs/common';
import { DonorVerificationController } from './donor-verification.controller';
import { DonorVerificationService } from './donor-verification.service';

@Module({
  controllers: [DonorVerificationController],
  providers: [DonorVerificationService],
  exports: [DonorVerificationService],
})
export class DonorVerificationModule {}
