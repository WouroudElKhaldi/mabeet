-- A recorded deposit or card payment is always a positive amount. The API already refuses zero or less;
-- this makes the database refuse it too. Checked by tests/integration/occupancy-constraint.test.ts.
ALTER TABLE "Payment"
  ADD CONSTRAINT payment_positive_amount CHECK ("amountCents" > 0);
