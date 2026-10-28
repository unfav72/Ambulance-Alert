import { prisma } from '../db/prisma.js';
import { AuthService } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { UserRole, UserStatus } from '@prisma/client';
import readline from 'readline';

function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  console.log('====================================================');
  console.log(' Emergency System Administrator Bootstrapper (CLI) ');
  console.log('====================================================');

  const setupToken = process.env.ADMIN_SETUP_TOKEN || (await promptInput('Enter ADMIN_SETUP_TOKEN from your server configuration: '));

  if (setupToken !== env.ADMIN_SETUP_TOKEN) {
    console.error('ERROR: Invalid setup token. Access denied.');
    process.exit(1);
  }

  // Check if an active administrator already exists
  const existingAdminCount = await prisma.user.count({
    where: { role: UserRole.SYSTEM_ADMIN },
  });

  if (existingAdminCount > 0) {
    console.log(`Notice: ${existingAdminCount} administrator(s) already exist in the database.`);
    const confirm = await promptInput('Do you want to provision an additional administrator? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborting bootstrap.');
      process.exit(0);
    }
  }

  const email = process.env.ADMIN_EMAIL || (await promptInput('Enter Administrator Email: '));
  const fullName = process.env.ADMIN_NAME || (await promptInput('Enter Administrator Full Name: '));
  const password = process.env.ADMIN_PASSWORD || (await promptInput('Enter Secure Administrator Password (min 12 chars): '));

  if (!email || !fullName || !password) {
    console.error('ERROR: Email, Full Name, and Password are all required.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('ERROR: Production administrator password must be at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = await AuthService.hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      fullName,
      passwordHash,
      role: UserRole.SYSTEM_ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    },
    update: {
      passwordHash,
      role: UserRole.SYSTEM_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('\n SUCCESS: System Administrator provisioned successfully!');
  console.log(` User ID: ${admin.id}`);
  console.log(` Email:   ${admin.email}`);
  console.log(` Role:    ${admin.role}\n`);

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Bootstrapping error:', err);
  process.exit(1);
});
