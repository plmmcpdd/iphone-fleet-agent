import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";

const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runFleetMigrations(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: migrationsDirectory,
    direction: "up",
    migrationsTable: "fleet_migrations",
    checkOrder: true,
    singleTransaction: true,
    advisoryLockMode: "wait",
    log: () => {},
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const databaseUrl = process.env.FLEET_DATABASE_URL;
  if (!databaseUrl) throw new Error("FLEET_DATABASE_URL is required");
  await runFleetMigrations(databaseUrl);
}
