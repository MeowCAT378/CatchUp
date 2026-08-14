import { HttpException, HttpStatus } from '@nestjs/common';
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    status: HttpStatus,
    message = code,
  ) {
    super({ code, message }, status);
  }
}
