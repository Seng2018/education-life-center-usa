-- Founder fee ruling (2026-11-12): the Guided Withdrawal sitting fee is
-- now $199 flat per completed sitting (was $99). The 529 case pricing is
-- unchanged: $99 founding for the first 50 completed cases, then $149.
--
-- No table change is needed: startWithdrawalSitting always writes the
-- current WITHDRAWAL_FEE explicitly into fee_amount at booking, so the
-- column default is never relied on, and sittings already booked keep
-- the price they booked with. This statement is an intentional no-op
-- that records the ruling in the migration history.
UPDATE `withdrawal_sittings` SET `fee_amount` = `fee_amount` WHERE 0;
