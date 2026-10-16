import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Get()
  health() {
    return { status: 'ok' };
  }
}
