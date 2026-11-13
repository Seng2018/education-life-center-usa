-- Visitor counter (2026-11-13): the site's own visit log for the footer
-- visitors line — one row per tracked page visit, country from
-- Cloudflare's request.cf ("XX" when unknown). Counts and countries
-- only; no visitor identity is stored.
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text,
	`country` text,
	`created_at` text NOT NULL
);
