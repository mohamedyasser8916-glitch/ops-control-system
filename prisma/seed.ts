/**
 * Database seed script.
 *
 * Two things happen here:
 *  1. Roles, permissions and the first Admin user are created (always).
 *  2. The REAL sample data from the customer's own Operations Control
 *     System workbook is loaded through the exact same import pipeline
 *     the Data Management screen uses (src/lib/importers/engine.ts) —
 *     this is not fabricated demo data, it is the actual workbook
 *     content, run through validation exactly as a real upload would be.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { ROLE_PERMISSION_SEED, PERMISSION_CATALOG } from '../src/lib/permissions';
import { runImport } from '../src/lib/importers/engine';

const prisma = new PrismaClient();
const SEED_DATA_DIR = path.join(__dirname, 'seed-data');

async function seedRolesAndPermissions() {
  console.log('Seeding permissions & roles...');
  for (const perm of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      create: { key: perm.key, label: perm.label, category: perm.category },
      update: { label: perm.label, category: perm.category }
    });
  }

  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSION_SEED)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, isSystem: true },
      update: {}
    });

    const permissions = await prisma.permission.findMany({ where: { key: { in: permKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true
    });
  }
}

async function seedAdminUser() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return;
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } });
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { email, name: 'System Administrator', passwordHash, roleId: adminRole.id, status: 'ACTIVE' }
  });

  console.log(`Created Admin user: ${email} (change the password after first login)`);
}

async function importDataset(dataset: Parameters<typeof runImport>[0]['dataset'], fileName: string) {
  const filePath = path.join(SEED_DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`  (skip) ${fileName} not found`);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const { result } = await runImport({ dataset, fileName, fileBuffer: buffer, sourceLabel: 'Database Seed' });
  console.log(
    `  ${fileName}: read ${result.rowsRead}, inserted ${result.rowsInserted}, updated ${result.rowsUpdated}, skipped ${result.rowsSkipped}, rejected ${result.rowsRejected}`
  );
}

async function main() {
  await seedRolesAndPermissions();
  await seedAdminUser();

  console.log('\nImporting sample operational data (from the real workbook)...');
  // Order matters: Agent Master must load first so every other dataset can
  // resolve Agent Name -> Agent Code.
  await importDataset('AGENT_MASTER', 'agent_master.csv');
  await importDataset('POS_WAREHOUSE', 'pos_warehouse.csv');
  await importDataset('MATERIAL_DATA', 'material_data.csv');
  await importDataset('WAREHOUSE_CANCEL', 'warehouse_cancel.csv');
  await importDataset('TERMINAL_LOGIN', 'terminal_login.csv');
  await importDataset('DAILY_CANCELLATION', 'daily_cancellation.csv');
  await importDataset('SIM_DATA', 'sim_data.csv');
  await importDataset('RECEIPTS', 'receipts.csv');
  await importDataset('AGENT_CHECKPOINT', 'agent_checkpoint.csv');

  console.log('\nSeed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
