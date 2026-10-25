# Database seed scripts will live here in Phase 3.

This directory is reserved for Prisma seed scripts. Phase 2 leaves it empty.

## Seed Data Policy (Phase 1 architecture plan, Chapter 7)

The seed data set will be deliberately minimal and contain ONLY legitimate
reference data:

- The country record for Bangladesh
- The district record for Jashore
- The eight upazila records (Jashore Sadar, Abhaynagar, Bagherpara,
  Chaugachha, Jhikargachha, Keshabpur, Manirampur, Sharsha)

The seed data will NOT contain:

- Any donor records
- Any hospital records
- Any blood bank records
- Any blood request records
- Any user accounts

A separate `seed-fictional.ts` script may be maintained for development and
demo purposes, but its output is clearly labelled as fictional via an
`is_fictional` boolean column and it is never run against the production
database.
