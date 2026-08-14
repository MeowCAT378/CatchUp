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
        : status === HttpStatus.BAD_REQUEST
          ? 'VALIDATION_ERROR'
          : status === HttpStatus.FORBIDDEN
            ? 'FORBIDDEN'
            : status === HttpStatus.NOT_FOUND
              ? 'NOT_FOUND'
              : status === HttpStatus.UNAUTHORIZED
                ? 'UNAUTHORIZED'
                : 'INTERNAL_ERROR';
    response.status(status).json({
      success: false,
      error: {
        status,
        code,
        message:
          status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Internal server error'
            : message,
      },
    });
  }
}
