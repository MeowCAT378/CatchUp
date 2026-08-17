import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
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
