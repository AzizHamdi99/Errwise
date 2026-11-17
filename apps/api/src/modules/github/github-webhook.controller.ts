import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { GithubWebhookService } from './github-webhook.service';

@Controller({ path: 'github', version: VERSION_NEUTRAL })
export class GithubWebhookController {
  constructor(private readonly webhook: GithubWebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
  ): Promise<{ ok: boolean; duplicate?: boolean; pong?: boolean }> {
    return this.webhook.handle({
      rawBody: req.rawBody,
      signature,
      event,
      deliveryId,
    });
  }
}
