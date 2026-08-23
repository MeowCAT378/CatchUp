import { Logger } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs unexpected failures without exposing details to the client', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const error = new Error('database detail must stay server-side');

    new ApiExceptionFilter().catch(error, {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });
});
