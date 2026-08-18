import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { humanizeBudidayaError } from './user-facing-errors';

@Catch(BadRequestException, ForbiddenException)
export class BudidayaUserFacingFilter implements ExceptionFilter {
  catch(exception: BadRequestException | ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const raw =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message?: string | string[] }).message
          : exception.message;
    const message = humanizeBudidayaError(raw);
    res.status(status).json({
      statusCode: status,
      message,
      error: status === 403 ? 'Forbidden' : 'Bad Request',
    });
  }
}
