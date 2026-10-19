import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AuditLogsService } from './audit-logs.service';

@ApiTags('Audit Logs')
@ApiBearerAuth('bearer')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditLogsController {
  constructor(
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @ApiOperation({ summary: 'List audit logs' })
  @Get()
  getAuditLogs() {
    return this.auditLogsService.getAuditLogs();
  }

  @ApiOperation({ summary: 'Get audit log by ID' })
  @Get(':id')
  getAuditLogById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.auditLogsService.getAuditLogById(id);
  }
}