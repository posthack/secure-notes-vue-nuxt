CREATE TABLE `share` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`iv` text NOT NULL,
	`ct` text NOT NULL,
	`wrapped_key` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_key` (
	`user_id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
