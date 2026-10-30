-- Seats waiting for the guest's online payment stay taken, like held and confirmed ones.
-- A separate migration from the one adding AWAITING_PAYMENT: Postgres can't use a new enum value in the
-- transaction that adds it.

CREATE OR REPLACE FUNCTION session_seats_guard() RETURNS trigger AS $$
DECLARE
  session_capacity INT;
  taken INT;
BEGIN
  IF NEW.status NOT IN ('HELD', 'AWAITING_PAYMENT', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;
  SELECT capacity INTO session_capacity FROM "OfferingSession" WHERE id = NEW."sessionId" FOR UPDATE;
  SELECT COALESCE(SUM(seats), 0) INTO taken
    FROM "SessionBooking"
    WHERE "sessionId" = NEW."sessionId" AND status IN ('HELD', 'AWAITING_PAYMENT', 'CONFIRMED') AND id <> NEW.id;
  IF taken + NEW.seats > session_capacity THEN
    RAISE EXCEPTION 'session % has % of % seats taken; % more do not fit', NEW."sessionId", taken, session_capacity, NEW.seats
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION session_capacity_guard() RETURNS trigger AS $$
DECLARE
  taken INT;
BEGIN
  SELECT COALESCE(SUM(seats), 0) INTO taken
    FROM "SessionBooking" WHERE "sessionId" = NEW.id AND status IN ('HELD', 'AWAITING_PAYMENT', 'CONFIRMED');
  IF taken > NEW.capacity THEN
    RAISE EXCEPTION 'session % already has % seats taken', NEW.id, taken USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
