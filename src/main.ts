import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { Application, NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import { CommonErrorCodes } from './common/errors/common-error-codes';
import { BusinessException } from './common/exceptions/business.exception';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

/** Boots the API with validated configuration, safe HTTP exposure, and shutdown hooks. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableShutdownHooks();
  const httpServer = app.getHttpAdapter().getInstance() as Application;
  httpServer.set(
    'trust proxy',
    configService.get<number>('TRUST_PROXY_HOPS', 0),
  );
  app.use((_request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  });

  const corsOrigins = configService.get<string[]>('CORS_ORIGINS', []);
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['healthz', 'health/(.*)'],
  });

  if (configService.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nexus Estate API')
      .setDescription('Nexus Estate API contract')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('swagger', app, swaggerDocument);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = errors.flatMap((error) =>
          Object.values(error.constraints ?? {}),
        );
        return new BusinessException(
          CommonErrorCodes.VALIDATION_ERROR,
          messages.join('; '),
        );
      },
    }),
  );

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);

  logger.log(`Application is running on http://localhost:${port}`);
  logger.log(`Environment: ${configService.get<string>('NODE_ENV')}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
