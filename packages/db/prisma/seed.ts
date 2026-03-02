import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const platformPermissions = [
  'platform:users.read',
  'platform:users.invite',
  'platform:team.invite.create',
  'platform:team.invite.resend',
  'platform:team.invite.revoke',
  'platform:team.role.assign',
  'platform:sessions.invalidate',
  'platform:roles.manage',
  'platform:tenants.read',
  'platform:tenants.manage',
  'platform:modules.manage',
  'platform:modules.publish',
  'platform:settings.manage',
  'platform:i18n.manage',
  'platform:org.read',
  'platform:org.manage',
  'platform:logs.read'
];

const companyPermissions = [
  'company:team.read',
  'company:team.invite',
  'company:team.invite.create',
  'company:team.invite.resend',
  'company:team.invite.revoke',
  'company:team.role.assign',
  'company:roles.manage',
  'company:audit.read',
  'company:settings.manage',
  'company:modules.read',
  'company:modules.install',
  'module:finance-core.entry.create',
  'module:finance-core.entry.read',
  'module:finance-core.entry.delete',
  'module:finance-core.counterparty.manage',
  'module:finance-core.account.manage',
  'module:finance-core.recurring.manage',
  'module:finance-core.reports.read'
];

async function upsertPlatformRole() {
  const adminRole = await prisma.platformRole.upsert({
    where: { key: 'platform_admin' },
    create: { key: 'platform_admin', name: 'Platform Admin' },
    update: { name: 'Platform Admin' }
  });

  for (const key of platformPermissions) {
    const permission = await prisma.platformPermission.upsert({
      where: { key },
      create: { key },
      update: {}
    });

    await prisma.platformRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      create: { roleId: adminRole.id, permissionId: permission.id },
      update: {}
    });
  }

  return adminRole;
}

async function upsertCompanyDefaults(companyId: string) {
  const ownerRole = await prisma.companyRole.upsert({
    where: { companyId_key: { companyId, key: 'owner' } },
    create: { companyId, key: 'owner', name: 'Owner' },
    update: { name: 'Owner' }
  });

  const adminRole = await prisma.companyRole.upsert({
    where: { companyId_key: { companyId, key: 'admin' } },
    create: { companyId, key: 'admin', name: 'Admin' },
    update: { name: 'Admin' }
  });

  for (const key of companyPermissions) {
    const permission = await prisma.companyPermission.upsert({
      where: { key },
      create: { key },
      update: {}
    });

    await prisma.companyRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: permission.id
        }
      },
      create: { roleId: ownerRole.id, permissionId: permission.id },
      update: {}
    });

    await prisma.companyRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      create: { roleId: adminRole.id, permissionId: permission.id },
      update: {}
    });
  }

  return ownerRole;
}

async function main() {
  const adminEmail = (process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
  const adminPassword = process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2.hash(adminPassword);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: 'Monocore Admin',
      passwordHash,
      locale: 'en'
    },
    update: {
      passwordHash,
      fullName: 'Monocore Admin'
    }
  });

  const platformRole = await upsertPlatformRole();

  const platformMembership = await prisma.platformMembership.upsert({
    where: { userId: user.id },
    create: { userId: user.id, isActive: true },
    update: { isActive: true }
  });

  await prisma.platformUserRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: platformMembership.id,
        roleId: platformRole.id
      }
    },
    create: {
      membershipId: platformMembership.id,
      roleId: platformRole.id
    },
    update: {}
  });

  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Acme Corp',
      plan: 'starter'
    },
    update: {
      name: 'Acme Corp',
      plan: 'starter'
    }
  });

  const membership = await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    create: { companyId: company.id, userId: user.id, status: 'active' },
    update: { status: 'active' }
  });

  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const row of companies) {
    await upsertCompanyDefaults(row.id);
  }

  const ownerRole = await prisma.companyRole.findUniqueOrThrow({
    where: { companyId_key: { companyId: company.id, key: 'owner' } }
  });

  await prisma.companyMemberRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: ownerRole.id
      }
    },
    create: { membershipId: membership.id, roleId: ownerRole.id },
    update: {}
  });

  await prisma.module.upsert({
    where: { key: 'core' },
    create: {
      key: 'core',
      name: 'Core Foundation',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Core services and shell experience.'
    },
    update: {
      name: 'Core Foundation',
      version: '1.0.0',
      status: 'PUBLISHED'
    }
  });

  await prisma.module.upsert({
    where: { key: 'finance-core' },
    create: {
      key: 'finance-core',
      name: 'Finance Core Pro',
      version: '1.1.0',
      status: 'PUBLISHED',
      description: 'Daily finance operations with entries, counterparties, accounts, recurring rules and reports.',
      dependencies: { modules: ['core'] }
    },
    update: {
      name: 'Finance Core Pro',
      version: '1.1.0',
      status: 'PUBLISHED',
      description: 'Daily finance operations with entries, counterparties, accounts, recurring rules and reports.',
      dependencies: { modules: ['core'] }
    }
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'core',
      status: 'ACTIVE',
      installedAt: new Date()
    },
    update: {
      status: 'ACTIVE',
      installedAt: new Date()
    }
  });

  await prisma.companyEntitlement.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'core',
      limits: {}
    },
    update: {}
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'finance-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'finance-core',
      status: 'ACTIVE',
      installedAt: new Date()
    },
    update: {
      status: 'ACTIVE',
      installedAt: new Date()
    }
  });

  await prisma.companyEntitlement.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'finance-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'finance-core',
      limits: {}
    },
    update: {}
  });
  for (const item of [
    { locale: 'en', namespace: 'common', key: 'welcome', value: 'Welcome' },
    { locale: 'tr', namespace: 'common', key: 'welcome', value: 'Hos geldiniz' }
  ]) {
    await prisma.languagePack.upsert({
      where: {
        locale_namespace_key: {
          locale: item.locale,
          namespace: item.namespace,
          key: item.key
        }
      },
      create: item,
      update: { value: item.value }
    });
  }

  for (const setting of [
    { key: 'brand_name', value: 'Monocore' },
    { key: 'support_email', value: 'support@themonocore.com' },
    { key: 'default_locale', value: 'en' }
  ]) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: { value: setting.value }
    });
  }

  console.log('Seed completed');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
