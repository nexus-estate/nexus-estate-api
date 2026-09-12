import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const logger = new Logger('Bootstrap');

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

  // Global prefix for all API routes
  app.setGlobalPrefix('api/v1', {
    exclude: ['healthz'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nexus Estate API')
    .setDescription('Nexus Estate API contract')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT || '50001', 10);
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
