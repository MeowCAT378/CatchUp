import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    if (!(error instanceof HttpException))
      this.logger.error(
        error instanceof Error ? error.message : 'Unknown backend error',
        error instanceof Error ? error.stack : undefined,
      );
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      error instanceof HttpException
        ? error.getResponse()
        : 'Internal server error';
    const message =
      typeof body === 'string' ? body : (body as { message?: unknown }).message;
    const code =
      typeof body === 'object' && body !== null && 'code' in body
        ? (body as { code: string }).code
        : status === 400
          ? 'VALIDATION_ERROR'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 401
                ? 'UNAUTHORIZED'
                : 'INTERNAL_ERROR';
    response.status(status).json({
      success: false,
      error: {
        status,
        code,
        message: status === 500 ? 'Internal server error' : message,
      },
    });
  }
}
