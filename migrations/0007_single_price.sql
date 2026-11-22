-- 0007: single price — $249 unlocks everything.
-- Retires the Complete ($997) and VIP ($1,997) tiers: the seller household's
-- stored buy links now point only at the one $249 link. Buyer unlock codes
-- are essentials-tier from here on; existing codes still redeem as before.
UPDATE settings
SET squareEssentialsUrl = 'https://square.link/u/OKktlhxo',
    squareCompleteUrl = NULL,
    squareVipUrl = NULL
WHERE id = 1;
