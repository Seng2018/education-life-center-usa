CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
SELECT 1;
INSERT OR IGNORE INTO `site_settings` (`key`, `value`, `updated_at`) VALUES ('admin_code_hash', 'pbkdf2-sha256$600000$25234e90138d53360fd84b118b985b39$325bd6ae781f9b81c1c2edc0b73d71bbbbe4aef34d0004a94a864a741adb4388', 1794600000000);
UPDATE `site_settings` SET `value` = 'pbkdf2-sha256$600000$25234e90138d53360fd84b118b985b39$325bd6ae781f9b81c1c2edc0b73d71bbbbe4aef34d0004a94a864a741adb4388', `updated_at` = 1794600000000 WHERE `key` = 'admin_code_hash';
