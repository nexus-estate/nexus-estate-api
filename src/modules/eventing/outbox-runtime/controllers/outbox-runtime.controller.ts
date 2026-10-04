import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxDeliveryRepo } from '../../outbox/repositories/outbox-delivery.repo';
import { KafkaEventPublisher } from '../services/kafka-event-publisher.service';
import { OutboxDispatcherService } from '../services/outbox-dispatcher.service';
import { OutboxMetricsService } from '../services/outbox-metrics.service';

/** Internal-only probes for the isolated publisher process. */
@Controller()
export class OutboxRuntimeController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: KafkaEventPublisher,
    private readonly dispatcher: OutboxDispatcherService,
    private readonly deliveryRepo: OutboxDeliveryRepo,
    private readonly metrics: OutboxMetricsService,
  ) {}

  @Get('health/live')
  live(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  async ready(): Promise<{ status: 'ready' }> {
    try {
      await this.dataSource.query('SELECT 1 FROM tbl_outbox_delivery LIMIT 0');
    } catch {
      throw new ServiceUnavailableException('Outbox database is not ready');
    }
    if (!this.dispatcher.isInitialized() || !this.publisher.isConnected()) {
      throw new ServiceUnavailableException('Outbox publisher is not ready');
    }
    return { status: 'ready' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metricsText(): Promise<string> {
    return this.metrics.render(() => this.deliveryRepo.getBacklogStats());
  }
}
