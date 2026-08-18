import { Controller, Post, Get, Body, Query, UseInterceptors } from '@nestjs/common';
import { SyncService } from './sync.service';
import { IdempotencyInterceptor } from '../../common/idempotency.interceptor';
import { SyncPushRequest, SyncPullRequest } from '@tumbu/core';

@Controller('v1/sync')
@UseInterceptors(IdempotencyInterceptor)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  async push(@Body() req: any) {
    return this.syncService.processPush(req);
  }

  @Get('pull')
  async pull(@Query() req: any) {
    return this.syncService.processPull(req);
  }
}
