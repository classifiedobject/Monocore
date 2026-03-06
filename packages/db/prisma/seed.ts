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
  'company:org.read',
  'company:org.manage',
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
  'module:finance-core.reports.read',
  'module:finance-core.profit-center.manage',
  'module:finance-core.profit-center.read',
  'module:finance-core.reports.profit-center.read',
  'module:finance-core.allocation.manage',
  'module:finance-core.allocation.apply',
  'module:finance-core.allocation.read',
  'module:finance-core.invoice.manage',
  'module:finance-core.invoice.read',
  'module:finance-core.payment.manage',
  'module:finance-core.payment.read',
  'module:finance-core.reports.aging.read',
  'module:finance-core.budget.manage',
  'module:finance-core.budget.read',
  'module:finance-core.reports.budget.read',
  'module:finance-core.reports.cashflow.read',
  'module:finance-core.cashflow-forecast.manage',
  'module:inventory-core.item.manage',
  'module:inventory-core.item.cost.manage',
  'module:inventory-core.items.manage',
  'module:inventory-core.items.read',
  'module:inventory-core.warehouse.manage',
  'module:inventory-core.movement.manage',
  'module:inventory-core.movement.read',
  'module:inventory-core.suppliers.manage',
  'module:inventory-core.suppliers.read',
  'module:inventory-core.brands.manage',
  'module:inventory-core.brands.read',
  'module:inventory-core.stock-count.manage',
  'module:inventory-core.stock-count.read',
  'module:recipe-core.product.manage',
  'module:recipe-core.recipe.manage',
  'module:recipe-core.recipe.read',
  'module:sales-core.order.manage',
  'module:sales-core.order.read',
  'module:sales-core.order.post',
  'module:task-core.template.manage',
  'module:task-core.task.manage',
  'module:task-core.task.read',
  'module:task-core.task.complete',
  'module:task-core.reports.read',
  'module:reservation-core.customer.manage',
  'module:reservation-core.reservation.manage',
  'module:reservation-core.reservation.read',
  'module:reservation-core.reports.read',
  'module:executive-core.dashboard.read',
  'module:executive-core.alerts.read',
  'module:payroll-core.employee.manage',
  'module:payroll-core.payroll.manage',
  'module:payroll-core.payroll.post',
  'module:payroll-core.tip.manage',
  'module:tip-core.manage'
];

const roleTemplates: Array<{
  key: string;
  name: string;
  description: string;
  permissionKeys: string[];
}> = [
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    description: 'Finance, payroll and executive reporting authority.',
    permissionKeys: [
      'company:team.read',
      'company:audit.read',
      'company:modules.read',
      'company:org.read',
      'module:finance-core.entry.create',
      'module:finance-core.entry.read',
      'module:finance-core.entry.delete',
      'module:finance-core.counterparty.manage',
      'module:finance-core.account.manage',
      'module:finance-core.recurring.manage',
      'module:finance-core.reports.read',
      'module:finance-core.profit-center.read',
      'module:finance-core.allocation.read',
      'module:finance-core.invoice.manage',
      'module:finance-core.invoice.read',
      'module:finance-core.payment.manage',
      'module:finance-core.payment.read',
      'module:finance-core.reports.aging.read',
      'module:finance-core.budget.manage',
      'module:finance-core.budget.read',
      'module:finance-core.reports.budget.read',
      'module:finance-core.reports.cashflow.read',
      'module:finance-core.cashflow-forecast.manage',
      'module:payroll-core.employee.manage',
      'module:payroll-core.payroll.manage',
      'module:payroll-core.payroll.post',
      'module:tip-core.manage',
      'module:executive-core.dashboard.read',
      'module:executive-core.alerts.read'
    ]
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    description: 'Inventory, sales, reservation and task operations manager.',
    permissionKeys: [
      'company:team.read',
      'company:modules.read',
      'company:org.read',
      'company:org.manage',
      'module:inventory-core.item.manage',
      'module:inventory-core.item.cost.manage',
      'module:inventory-core.items.manage',
      'module:inventory-core.items.read',
      'module:inventory-core.warehouse.manage',
      'module:inventory-core.movement.manage',
      'module:inventory-core.movement.read',
      'module:inventory-core.suppliers.manage',
      'module:inventory-core.suppliers.read',
      'module:inventory-core.brands.manage',
      'module:inventory-core.brands.read',
      'module:inventory-core.stock-count.manage',
      'module:inventory-core.stock-count.read',
      'module:recipe-core.product.manage',
      'module:recipe-core.recipe.manage',
      'module:recipe-core.recipe.read',
      'module:sales-core.order.manage',
      'module:sales-core.order.read',
      'module:sales-core.order.post',
      'module:reservation-core.customer.manage',
      'module:reservation-core.reservation.manage',
      'module:reservation-core.reservation.read',
      'module:reservation-core.reports.read',
      'module:task-core.template.manage',
      'module:task-core.task.manage',
      'module:task-core.task.read',
      'module:task-core.task.complete',
      'module:task-core.reports.read'
    ]
  },
  {
    key: 'floor_manager',
    name: 'Floor Manager',
    description: 'Floor-level reservation, service and task execution.',
    permissionKeys: [
      'company:team.read',
      'company:org.read',
      'module:reservation-core.customer.manage',
      'module:reservation-core.reservation.manage',
      'module:reservation-core.reservation.read',
      'module:reservation-core.reports.read',
      'module:task-core.task.manage',
      'module:task-core.task.read',
      'module:task-core.task.complete',
      'module:sales-core.order.read'
    ]
  },
  {
    key: 'staff',
    name: 'Staff',
    description: 'Daily execution access for assigned tasks and reservations.',
    permissionKeys: [
      'module:task-core.task.read',
      'module:task-core.task.complete',
      'module:reservation-core.reservation.read',
      'module:sales-core.order.read',
      'module:inventory-core.movement.read',
      'company:org.read'
    ]
  }
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

  const permissionByKey = new Map(
    (await prisma.companyPermission.findMany({ select: { id: true, key: true } })).map((row) => [row.key, row.id])
  );

  for (const template of roleTemplates) {
    const role = await prisma.companyRole.upsert({
      where: { companyId_key: { companyId, key: template.key } },
      create: {
        companyId,
        key: template.key,
        name: template.name,
        description: template.description
      },
      update: {
        name: template.name,
        description: template.description
      }
    });

    for (const permissionKey of template.permissionKeys) {
      const permissionId = permissionByKey.get(permissionKey);
      if (!permissionId) continue;
      await prisma.companyRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {}
      });
    }
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
      plan: 'starter',
      onboardingCompleted: true,
      onboardingStep: 6
    },
    update: {
      name: 'Acme Corp',
      plan: 'starter',
      onboardingCompleted: true,
      onboardingStep: 6
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

  await prisma.module.upsert({
    where: { key: 'inventory-core' },
    create: {
      key: 'inventory-core',
      name: 'Inventory Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Warehouse, item and stock movement management with transfer and stock balance reports.',
      dependencies: { modules: ['core'] }
    },
    update: {
      name: 'Inventory Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Warehouse, item and stock movement management with transfer and stock balance reports.',
      dependencies: { modules: ['core'] }
    }
  });

  await prisma.module.upsert({
    where: { key: 'recipe-core' },
    create: {
      key: 'recipe-core',
      name: 'Recipe Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Bill of materials and recipe definitions for products.',
      dependencies: { modules: ['core', 'inventory-core'] }
    },
    update: {
      name: 'Recipe Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Bill of materials and recipe definitions for products.',
      dependencies: { modules: ['core', 'inventory-core'] }
    }
  });

  await prisma.module.upsert({
    where: { key: 'sales-core' },
    create: {
      key: 'sales-core',
      name: 'Sales Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Sales ledger with posting workflow, stock consumption and COGS integration.',
      dependencies: { modules: ['core', 'inventory-core', 'finance-core', 'recipe-core'] }
    },
    update: {
      name: 'Sales Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Sales ledger with posting workflow, stock consumption and COGS integration.',
      dependencies: { modules: ['core', 'inventory-core', 'finance-core', 'recipe-core'] }
    }
  });

  await prisma.module.upsert({
    where: { key: 'task-core' },
    create: {
      key: 'task-core',
      name: 'Task & Workforce Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Operational tasks with templates, assignees, recurring generation and completion reporting.',
      dependencies: { modules: ['core'] }
    },
    update: {
      name: 'Task & Workforce Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Operational tasks with templates, assignees, recurring generation and completion reporting.',
      dependencies: { modules: ['core'] }
    }
  });
  await prisma.module.upsert({
    where: { key: 'reservation-core' },
    create: {
      key: 'reservation-core',
      name: 'Reservation & CRM Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Customer profiles, reservations lifecycle and reservation analytics foundation.',
      dependencies: { modules: ['core'] }
    },
    update: {
      name: 'Reservation & CRM Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Customer profiles, reservations lifecycle and reservation analytics foundation.',
      dependencies: { modules: ['core'] }
    }
  });
  await prisma.module.upsert({
    where: { key: 'executive-core' },
    create: {
      key: 'executive-core',
      name: 'Executive Intelligence',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Cross-module executive KPIs, trends and smart alerts.',
      dependencies: { modules: ['core', 'finance-core', 'inventory-core', 'sales-core', 'reservation-core', 'task-core'] }
    },
    update: {
      name: 'Executive Intelligence',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Cross-module executive KPIs, trends and smart alerts.',
      dependencies: { modules: ['core', 'finance-core', 'inventory-core', 'sales-core', 'reservation-core', 'task-core'] }
    }
  });
  await prisma.module.upsert({
    where: { key: 'payroll-core' },
    create: {
      key: 'payroll-core',
      name: 'Payroll Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Employee payroll periods, worklogs and tip distribution with finance posting.',
      dependencies: { modules: ['core', 'finance-core'] }
    },
    update: {
      name: 'Payroll Core',
      version: '1.0.0',
      status: 'PUBLISHED',
      description: 'Employee payroll periods, worklogs and tip distribution with finance posting.',
      dependencies: { modules: ['core', 'finance-core'] }
    }
  });
  await prisma.module.upsert({
    where: { key: 'tip-core' },
    create: {
      key: 'tip-core',
      name: 'Tip Core',
      version: '2.0.0',
      status: 'PUBLISHED',
      description: 'Advanced tip engine with weekly pools, overrides and advance tracking.',
      dependencies: { modules: ['core'] }
    },
    update: {
      name: 'Tip Core',
      version: '2.0.0',
      status: 'PUBLISHED',
      description: 'Advanced tip engine with weekly pools, overrides and advance tracking.',
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

  const serviceDepartment =
    (await prisma.companyDepartment.findFirst({ where: { companyId: company.id, name: 'Service' } })) ??
    (await prisma.companyDepartment.create({
      data: {
        companyId: company.id,
        name: 'Service',
        tipDepartment: 'SERVICE'
      }
    }));

  const kitchenDepartment =
    (await prisma.companyDepartment.findFirst({ where: { companyId: company.id, name: 'Kitchen' } })) ??
    (await prisma.companyDepartment.create({
      data: {
        companyId: company.id,
        name: 'Kitchen',
        tipDepartment: 'KITCHEN'
      }
    }));

  const waiterTitle =
    (await prisma.companyTitle.findFirst({ where: { companyId: company.id, name: 'Waiter' } })) ??
    (await prisma.companyTitle.create({
      data: {
        companyId: company.id,
        departmentId: serviceDepartment.id,
        name: 'Waiter',
        tipWeight: 1.2,
        isTipEligible: true
      }
    }));

  const kitchenAggregateTitle =
    (await prisma.companyTitle.findFirst({ where: { companyId: company.id, name: 'Kitchen Aggregate' } })) ??
    (await prisma.companyTitle.create({
      data: {
        companyId: company.id,
        departmentId: kitchenDepartment.id,
        name: 'Kitchen Aggregate',
        tipWeight: 12,
        departmentAggregate: true,
        isTipEligible: true
      }
    }));

  const demoEmployee = await prisma.companyEmployeeDirectory.findFirst({
    where: { companyId: company.id, firstName: 'Semih', lastName: 'Alper' }
  });
  if (!demoEmployee) {
    await prisma.companyEmployeeDirectory.create({
      data: {
        companyId: company.id,
        firstName: 'Semih',
        lastName: 'Alper',
        userId: user.id,
        titleId: waiterTitle.id,
        isActive: true
      }
    });
  }
  const demoKitchen = await prisma.companyEmployeeDirectory.findFirst({
    where: { companyId: company.id, firstName: 'Kitchen', lastName: 'Pool' }
  });
  if (!demoKitchen) {
    await prisma.companyEmployeeDirectory.create({
      data: {
        companyId: company.id,
        firstName: 'Kitchen',
        lastName: 'Pool',
        titleId: kitchenAggregateTitle.id,
        isActive: true
      }
    });
  }
  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'payroll-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'payroll-core',
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
        moduleKey: 'payroll-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'payroll-core',
      limits: {}
    },
    update: {}
  });
  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'tip-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'tip-core',
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
        moduleKey: 'tip-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'tip-core',
      limits: {}
    },
    update: {}
  });
  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'executive-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'executive-core',
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
        moduleKey: 'executive-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'executive-core',
      limits: {}
    },
    update: {}
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'task-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'task-core',
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
        moduleKey: 'task-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'task-core',
      limits: {}
    },
    update: {}
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'reservation-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'reservation-core',
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
        moduleKey: 'reservation-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'reservation-core',
      limits: {}
    },
    update: {}
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'recipe-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'recipe-core',
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
        moduleKey: 'recipe-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'recipe-core',
      limits: {}
    },
    update: {}
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'sales-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'sales-core',
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
        moduleKey: 'sales-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'sales-core',
      limits: {}
    },
    update: {}
  });

  await prisma.moduleInstallation.upsert({
    where: {
      companyId_moduleKey: {
        companyId: company.id,
        moduleKey: 'inventory-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'inventory-core',
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
        moduleKey: 'inventory-core'
      }
    },
    create: {
      companyId: company.id,
      moduleKey: 'inventory-core',
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
