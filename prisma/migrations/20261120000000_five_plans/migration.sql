-- Five plans instead of three: Starter between Free and Pro, Premium above Business. The order of the values is the
-- order of the plans, from the smallest. Existing rows keep their plan.
ALTER TYPE "Plan" ADD VALUE 'STARTER' BEFORE 'PRO';
ALTER TYPE "Plan" ADD VALUE 'PREMIUM' AFTER 'BUSINESS';
