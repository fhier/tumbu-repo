import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() { return { status: 'ok', service: 'tumbu-api', version: '2.0.0', timestamp: new Date().toISOString() }; }
}
