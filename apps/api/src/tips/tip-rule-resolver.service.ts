import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service.js';

type TipRuleMaps = {
  departmentRuleByDepartmentId: Map<string, { id: string; defaultTipWeight: number; isActive: boolean }>;
  titleRuleByTitleId: Map<string, { id: string; tipWeight: number; isActive: boolean; departmentId: string }>;
};

@Injectable()
export class TipRuleResolverService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadCompanyRuleMaps(companyId: string): Promise<TipRuleMaps> {
    let departmentRules: Array<{ id: string; departmentId: string; defaultTipWeight: Prisma.Decimal; isActive: boolean }> = [];
    let titleRules: Array<{
      id: string;
      titleId: string;
      departmentId: string;
      tipWeight: Prisma.Decimal;
      isActive: boolean;
    }> = [];

    try {
      [departmentRules, titleRules] = await Promise.all([
        this.prisma.tipDepartmentRule.findMany({
          where: { companyId, isActive: true },
          select: { id: true, departmentId: true, defaultTipWeight: true, isActive: true }
        }),
        this.prisma.tipTitleRule.findMany({
          where: { companyId, isActive: true },
          select: { id: true, titleId: true, departmentId: true, tipWeight: true, isActive: true }
        })
      ]);
    } catch (error) {
      if (!this.isMissingTipRuleTable(error)) throw error;
    }

    return {
      departmentRuleByDepartmentId: new Map(
        departmentRules.map((row) => [
          row.departmentId,
          { id: row.id, defaultTipWeight: Number(row.defaultTipWeight), isActive: row.isActive }
        ])
      ),
      titleRuleByTitleId: new Map(
        titleRules.map((row) => [
          row.titleId,
          { id: row.id, tipWeight: Number(row.tipWeight), isActive: row.isActive, departmentId: row.departmentId }
        ])
      )
    };
  }

  resolveWeight(
    departmentId: string,
    titleId: string,
    maps: TipRuleMaps
  ): {
    effectiveTipWeight: number;
    source: 'title' | 'department' | 'none';
    departmentRuleId: string | null;
    titleRuleId: string | null;
  } {
    const titleRule = maps.titleRuleByTitleId.get(titleId);
    if (titleRule) {
      return {
        effectiveTipWeight: titleRule.tipWeight,
        source: 'title',
        departmentRuleId: null,
        titleRuleId: titleRule.id
      };
    }

    const departmentRule = maps.departmentRuleByDepartmentId.get(departmentId);
    if (departmentRule) {
      return {
        effectiveTipWeight: departmentRule.defaultTipWeight,
        source: 'department',
        departmentRuleId: departmentRule.id,
        titleRuleId: null
      };
    }

    return {
      effectiveTipWeight: 0,
      source: 'none',
      departmentRuleId: null,
      titleRuleId: null
    };
  }

  async resolveWeightFor(companyId: string, departmentId: string, titleId: string) {
    const maps = await this.loadCompanyRuleMaps(companyId);
    return this.resolveWeight(departmentId, titleId, maps);
  }

  private isMissingTipRuleTable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021' &&
      /TipDepartmentRule|TipTitleRule/.test(error.message)
    );
  }
}
