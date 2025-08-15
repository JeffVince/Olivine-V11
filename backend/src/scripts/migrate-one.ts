import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { PostgresService } from '../services/PostgresService';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('file', { type: 'string', demandOption: true, desc: 'Migration filename in src/migrations/postgres' })
    .parse();

  const file = argv.file as string;
  const migrationsDir = path.join(__dirname, '../migrations/postgres');
  const migrationPath = path.join(migrationsDir, file);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  const pg = new PostgresService();

  console.log(`Applying migration ${file}...`);
  await pg.executeQuery(sql);
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error running migrate-one:', err);
  process.exit(1);
});
