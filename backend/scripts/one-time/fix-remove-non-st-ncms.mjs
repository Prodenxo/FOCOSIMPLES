import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ncms = [
  '61091000',
  '62034200',
  '64039990',
  '61103000',
  '84713012',
  '85171231',
  '84716053',
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const deleted = await client.query(
  `delete from public.tax_rules_state
   where origin_uf = 'RJ' and destination_uf = 'RJ' and ncm = any($1::text[])`,
  [ncms],
);
console.log('deleted rows:', deleted.rowCount);

const check = await client.query(
  `select ncm, has_st from public.tax_rules_state where ncm = '61091000'`,
);
console.log('61091000 remaining:', check.rows);

await client.end();
