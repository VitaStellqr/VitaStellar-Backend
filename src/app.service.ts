import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  getWelcome() {
    return {
      name: 'VitaStellar Backend API',
      version: '1.0.0',
      description: 'Decentralized Health & Wellness Powered by Stellar',
      docs: '/api/docs',
    };
  }
}
