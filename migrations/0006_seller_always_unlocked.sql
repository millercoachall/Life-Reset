-- 0006_seller_always_unlocked
-- The seller household (Miller Household) is always on the top tier, so the
-- owner never hits the paywall in her own app. Code also bypasses the paywall
-- for the seller household (see requirePaid / isFree), so this row is the
-- stored tier and the label the app shows, not the only thing keeping it unlocked.
UPDATE settings SET planTier = 'vip' WHERE isSeller = 1;
