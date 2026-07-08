import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstraps the NestJS application.
 *
 * Creates the NestJS application instance from the root AppModule,
 * sets global configuration, and starts listening on the configured port.
 * The port is read from the `PORT` environment variable, defaulting to 50001.
 *
 * @returns {Promise<void>} A promise that resolves once the server is listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development (configure origins properly in production)
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global prefix for all routes, e.g., /api/v1
  // app.setGlobalPrefix('api/v1');

  const port = parseInt(process.env.PORT || '50001', 10);
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();