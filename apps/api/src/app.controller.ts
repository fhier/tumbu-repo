import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'TUMBU API',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('clear-workspace')
  clearWorkspace() {
    return {
      status: 'success',
      message: 'Operational data cleared',
    };
  }
}