/**
 * Blood group compatibility rules.
 *
 * CRITICAL: These are SEARCH/MATCHING rules only. They do NOT determine
 * clinical compatibility. Final compatibility is determined by the blood
 * bank using cross-matching tests.
 *
 * The rules below are the standard ABO/Rh compatibility for WHOLE BLOOD
 * donation. For plasma and platelets, the compatibility is INVERTED
 * (plasma from AB can go to any; plasma from O can only go to O).
 *
 * Source: American Red Cross and WHO blood compatibility guidelines.
 */

import type { BloodGroup } from '@jbn/shared-types';

/**
 * Map of recipient blood group → compatible DONOR blood groups.
 * Used to find donors who can donate TO a recipient of the given group.
 */
const WHOLE_BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  O_POSITIVE: ['O_POSITIVE', 'O_NEGATIVE'],
  O_NEGATIVE: ['O_NEGATIVE'],
  A_POSITIVE: ['A_POSITIVE', 'A_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  A_NEGATIVE: ['A_NEGATIVE', 'O_NEGATIVE'],
  B_POSITIVE: ['B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  B_NEGATIVE: ['B_NEGATIVE', 'O_NEGATIVE'],
  AB_POSITIVE: ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  AB_NEGATIVE: ['AB_NEGATIVE', 'A_NEGATIVE', 'B_NEGATIVE', 'O_NEGATIVE'],
};

/**
 * Returns the list of donor blood groups that are compatible with the
 * given RECIPIENT blood group.
 *
 * @param recipientGroup The blood group of the patient who needs blood
 * @returns Array of donor blood groups that can donate to this recipient
 */
export function getCompatibleDonorGroups(recipientGroup: BloodGroup): BloodGroup[] {
  return WHOLE_BLOOD_COMPATIBILITY[recipientGroup] ?? [];
}

/**
 * Returns the list of recipient blood groups that a donor with the given
 * blood group can donate to.
 *
 * @param donorGroup The blood group of the donor
 * @returns Array of recipient blood groups this donor can donate to
 */
export function getCompatibleRecipientGroups(donorGroup: BloodGroup): BloodGroup[] {
  return (Object.entries(WHOLE_BLOOD_COMPATIBILITY) as Array<[BloodGroup, BloodGroup[]]>)
    .filter(([, donors]) => donors.includes(donorGroup))
    .map(([recipient]) => recipient);
}
