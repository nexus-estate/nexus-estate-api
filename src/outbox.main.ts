import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { OutboxRuntimeModule } from './modules/eventing/outbox-runtime/outbox-runtime.module';
import { OutboxDispatcherService } from './modules/eventing/outbox-runtime/services/outbox-dispatcher.service';

const logger = new Logger('OutboxBootstrap');

/** Starts the private outbox health server and independent delivery loop. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(OutboxRuntimeModule);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('OUTBOX_HEALTH_PORT');
  await app.listen(port, '0.0.0.0');
  await app.get(OutboxDispatcherService).start();
  logger.log(`Outbox runtime listening on internal port ${port}`);
}

bootstrap().catch((error: unknown) => {
  logger.error(
    error instanceof Error ? error.message : 'Outbox bootstrap failed',
  );
  process.exitCode = 1;
});
