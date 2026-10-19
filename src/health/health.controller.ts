import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({
    summary: 'Liveness probe: application process is running',
  })
  @Get('live')
  live() {
    return this.healthService.liveness();
  }

  @ApiOperation({
    summary:
      'Readiness probe: database is reachable and the app can serve requests',
  })
  @Get('ready')
  ready() {
    return this.healthService.readiness();
  }
}
