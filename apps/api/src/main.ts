import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseTrustProxyHops } from './common/network/trusted-client-address';
import { webOrigin } from './common/network/web-origin';

async function bootstrap() {
  const trustedProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);
  app.enableCors({ origin: webOrigin() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
