import {
  type PipeTransform,
  Injectable,
  type ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

/**
 * Generic Zod validation pipe.
 *
 * Usage in a controller:
 *
 *   @Post()
 *   @UsePipes(new ZodValidationPipe(createBloodRequestSchema))
 *   create(@Body() body: CreateBloodRequest) { ... }
 *
 * Phase 2 contains the pipe; domain schemas will be added in Phase 3+.
 */

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          error: 'Validation failed',
          message: err.issues.map((i) => ({
            field: i.path.join('.'),
            code: i.code,
            message: i.message,
          })),
        });
      }
      throw err;
    }
  }
}
