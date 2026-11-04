import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { CustomerJwtAuthGuard } from '../../src/modules/customer/authentication/guards/customer-jwt-auth.guard';
import { ListingPromotionController } from '../../src/modules/promotion/listing_promotion/controllers/listing_promotion_controller';
import { ListingPromotionService } from '../../src/modules/promotion/listing_promotion/services/listingPromotion.service';
import { ListingPromotionRepo } from '../../src/modules/promotion/listing_promotion/repositories/listingPromotion.repo';
import { PromotionRepo } from '../../src/modules/promotion/promotion/repositories/promotion_repository';
import { ListingRepo } from '../../src/modules/listing/listing/repositories/listing.repo';
import { ProviderContextResolver } from '../../src/modules/provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../src/modules/provider/authorization/helpers/provider-supply-access.policy';

// HTTP contract regression: real validation/controller/service; identity and persistence are isolated.
describe('Listing promotion duration HTTP contract', () => {
  let app: INestApplication<Server>;
  const listingId = '45fc66da-58b9-4d34-982e-6d941c798dd2';
  const promotionId = 'e8a8f6fb-c7aa-4879-81e6-3fc931d29ac3';
  const save = jest.fn((value: unknown) => Promise.resolve(value));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ListingPromotionController],
      providers: [
        ListingPromotionService,
        {
          provide: ListingRepo,
          useValue: {
            findById: () => ({ id: listingId, providerId: 'provider' }),
          },
        },
        {
          provide: PromotionRepo,
          useValue: {
            findById: () => ({
              id: promotionId,
              isActive: true,
              valueType: 'MONEY',
              moneyValue: 100000,
            }),
          },
        },
        {
          provide: ListingPromotionRepo,
          useValue: {
            findOverlappingByListingAndPromotion: () => null,
            create: (value: unknown) => value,
            save,
          },
        },
        {
          provide: ProviderContextResolver,
          useValue: { resolve: () => ({ providerId: 'provider' }) },
        },
        {
          provide: ProviderSupplyAccessPolicy,
          useValue: { requirePermission: () => undefined },
        },
      ],
    })
      .overrideGuard(CustomerJwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<{ user: unknown }>().user = {
            id: 'customer',
            realm: 'customer',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => save.mockClear());

  it('accepts only duration and derives timestamps and price on the server', async () => {
    const before = Date.now();
    const result = await request(app.getHttpServer())
      .post(`/listings/${listingId}/promotions/${promotionId}`)
      .send({ durationDays: 7 })
      .expect(201);
    const body = result.body as {
      startAt: string;
      endAt: string;
      priceSnapshot: number;
    };
    const start = Date.parse(body.startAt);
    expect(start).toBeGreaterThanOrEqual(before);
    expect(start).toBeLessThanOrEqual(Date.now());
    expect(Date.parse(body.endAt) - start).toBe(7 * 86400000);
    expect(body.priceSnapshot).toBe(700000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    { durationDays: 0 },
    { durationDays: -1 },
    { durationDays: 1.5 },
    { durationDays: 366 },
    { durationDays: '7' },
    { durationDays: 7, startAt: '2000-01-01' },
    { durationDays: 7, endAt: '2100-01-01' },
  ])('rejects invalid or client-controlled scheduling %j', async (body) => {
    await request(app.getHttpServer())
      .post(`/listings/${listingId}/promotions/${promotionId}`)
      .send(body)
      .expect(400);
    expect(save).not.toHaveBeenCalled();
  });
});
