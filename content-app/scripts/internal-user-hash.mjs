#!/usr/bin/env node
/**
 * Mint a password hash for INTERNAL_USERS.
 *
 *   node scripts/internal-user-hash.mjs 'the password'
 *
 * Prints a `scrypt:salt:key` string. Put it in INTERNAL_USERS, which is a
 * JSON map of username to hash:
 *
 *   INTERNAL_USERS='{"edward":"scrypt:...","yuehan":"scrypt:..."}'
 *
 * Colon separated, not the conventional `$`: Next.js expands `$name` in .env
 * files, which would silently truncate every hash to "scrypt".
 *
 * Two accounts, because commission attribution depends on knowing who worked
 * a lead. The plaintext never leaves this terminal.
 */
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/internal-user-hash.mjs '<password>'");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await derive(password, salt, 64);
console.log(`scrypt:${salt.toString("hex")}:${key.toString("hex")}`);
