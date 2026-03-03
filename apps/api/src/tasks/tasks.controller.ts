import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CompanyRbacGuard } from '../common/guards/company-rbac.guard.js';
import { ModuleInstalledGuard } from '../common/guards/module-installed.guard.js';
import { RequireInstalledModules } from '../common/decorators/module-installation.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { TasksService } from './tasks.service.js';

@Controller('app-api/tasks')
@UseGuards(AuthGuard, CompanyRbacGuard, ModuleInstalledGuard)
@RequireInstalledModules('task-core')
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get('capabilities')
  @RequirePermissions('module:task-core.task.read')
  capabilities(@Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.capabilities(req.user.id, req.companyId);
  }

  @Get('boards')
  @RequirePermissions('module:task-core.task.read')
  listBoards(@Req() req: Request & { companyId: string }) {
    return this.tasks.listBoards(req.companyId);
  }

  @Post('boards')
  @RequirePermissions('module:task-core.template.manage')
  createBoard(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.createBoard(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('boards/:id')
  @RequirePermissions('module:task-core.template.manage')
  updateBoard(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.updateBoard(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Get('templates')
  @RequirePermissions('module:task-core.task.read')
  listTemplates(@Req() req: Request & { companyId: string }) {
    return this.tasks.listTemplates(req.companyId);
  }

  @Post('templates')
  @RequirePermissions('module:task-core.template.manage')
  createTemplate(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.createTemplate(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Patch('templates/:id')
  @RequirePermissions('module:task-core.template.manage')
  updateTemplate(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.updateTemplate(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Delete('templates/:id')
  @RequirePermissions('module:task-core.template.manage')
  deactivateTemplate(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.deactivateTemplate(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get()
  @RequirePermissions('module:task-core.task.read')
  listTasks(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.tasks.listTasks(req.companyId, query);
  }

  @Post()
  @RequirePermissions('module:task-core.task.manage')
  createTask(@Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.createTask(req.user.id, req.companyId, body, req.ip, req.get('user-agent'));
  }

  @Post('generate')
  @RequirePermissions('module:task-core.task.manage')
  generate(@Req() req: Request & { user: { id: string }; companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.tasks.generate(req.user.id, req.companyId, query, req.ip, req.get('user-agent'));
  }

  @Get('reports/summary')
  @RequirePermissions('module:task-core.reports.read')
  summary(@Req() req: Request & { companyId: string }, @Query() query: Record<string, string | undefined>) {
    return this.tasks.summaryReport(req.companyId, query);
  }

  @Get('reports/overdue-by-assignee')
  @RequirePermissions('module:task-core.reports.read')
  overdueByAssignee(@Req() req: Request & { companyId: string }) {
    return this.tasks.overdueByAssignee(req.companyId);
  }

  @Get(':id')
  @RequirePermissions('module:task-core.task.read')
  getTask(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.tasks.getTask(req.companyId, id);
  }

  @Patch(':id')
  @RequirePermissions('module:task-core.task.manage')
  updateTask(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.updateTask(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

  @Post(':id/complete')
  @RequirePermissions('module:task-core.task.complete')
  completeTask(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.completeTask(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Post(':id/reopen')
  @RequirePermissions('module:task-core.task.complete')
  reopenTask(@Param('id') id: string, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.reopenTask(req.user.id, req.companyId, id, req.ip, req.get('user-agent'));
  }

  @Get(':id/comments')
  @RequirePermissions('module:task-core.task.read')
  listComments(@Param('id') id: string, @Req() req: Request & { companyId: string }) {
    return this.tasks.listComments(req.companyId, id);
  }

  @Post(':id/comments')
  @RequirePermissions('module:task-core.task.manage')
  createComment(@Param('id') id: string, @Body() body: unknown, @Req() req: Request & { user: { id: string }; companyId: string }) {
    return this.tasks.createComment(req.user.id, req.companyId, id, body, req.ip, req.get('user-agent'));
  }

}
