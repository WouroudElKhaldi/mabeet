-- A place its own owner archives: hidden from guests like a suspended one, but its team keeps the dashboard so the
-- owner can bring it back. Existing rows are untouched.
ALTER TYPE "BusinessStatus" ADD VALUE 'ARCHIVED';
