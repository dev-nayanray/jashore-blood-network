import { describe, it, expect } from 'vitest';
import { JASHORE_UPAZILAS } from '@jbn/shared-types';

describe('shared-types sanity', () => {
  it('exports the 8 Jashore upazilas', () => {
    expect(JASHORE_UPAZILAS).toHaveLength(8);
    expect(JASHORE_UPAZILAS).toContain('Jashore Sadar');
    expect(JASHORE_UPAZILAS).toContain('Sharsha');
  });

  it('upazila list is frozen (immutable at runtime)', () => {
    expect(Object.isFrozen(JASHORE_UPAZILAS)).toBe(true);
  });
});
