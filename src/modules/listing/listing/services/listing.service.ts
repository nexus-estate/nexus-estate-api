import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import {
  ProviderContextResolver,
  type ProviderContext,
} from '../../../provider/account/services/provider-context.resolver';
import { ProviderSupplyAccessPolicy } from '../../../provider/authorization/helpers/provider-supply-access.policy';
import { EstateRepo } from '../../../estate/property/repositories/estate.repo';
import { CreateListingDto } from '../dto/create-listing.dto';
import { ListingQueryDto } from '../dto/listing-query.dto';
import { ListingResponse } from '../dto/listing.response';
import { Listing, ListingStatus } from '../entities';
import { ListingRepo } from '../repositories/listing.repo';

@Injectable()
export class ListingService {
  constructor(
    private readonly listingRepository: ListingRepo,
    private readonly estateRepository: EstateRepo,
    private readonly providerContextResolver: ProviderContextResolver,
    private readonly supplyAccessPolicy: ProviderSupplyAccessPolicy,
  ) {}

  async create(
    customerId: string,
    dto: CreateListingDto,
    providerId?: string,
  ): Promise<ListingResponse> {
    const context = await this.requireProviderContext(customerId, providerId);
    const estate = await this.estateRepository.findById(dto.estateId);
    if (!estate)
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        dto.estateId,
      );
    this.assertEstateOwnership(estate, customerId, context.providerId);
    await this.supplyAccessPolicy.requireWriteAccess(context);
    if (await this.listingRepository.findByEstateId(dto.estateId)) {
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_CONFLICT,
        dto.estateId,
      );
    }
    const listing = this.listingRepository.create({
      estateId: estate.id,
      estate,
      providerId: context.providerId,
      status: ListingStatus.DRAFT,
      publishedAt: null,
    });
    return this.toResponse(await this.listingRepository.save(listing));
  }

  async findMine(
    customerId: string,
    providerId?: string,
  ): Promise<ListingResponse[]> {
    const context = await this.requireProviderContext(customerId, providerId);
    return (await this.listingRepository.findMine(context.providerId)).map(
      (listing) => this.toResponse(listing),
    );
  }

  async findPublicById(id: string): Promise<ListingResponse> {
    const listing = await this.listingRepository.findById(id, true);
    if (!listing)
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, id);
    return this.toResponse(listing);
  }

  async findPublic(query: ListingQueryDto) {
    const result = await this.listingRepository.findPublic(query);
    const totalPages = Math.ceil(result.total / query.limit);
    return {
      items: result.items.map((listing) => this.toResponse(listing)),
      meta: {
        total: result.total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async publish(
    customerId: string,
    id: string,
    providerId?: string,
  ): Promise<ListingResponse> {
    const listing = await this.getOwnedListing(customerId, id, providerId);
    listing.status = ListingStatus.PUBLISHED;
    listing.publishedAt = listing.publishedAt ?? new Date();
    return this.toResponse(await this.listingRepository.save(listing));
  }

  async unpublish(
    customerId: string,
    id: string,
    providerId?: string,
  ): Promise<ListingResponse> {
    const listing = await this.getOwnedListing(customerId, id, providerId);
    listing.status = ListingStatus.DRAFT;
    listing.publishedAt = null;
    return this.toResponse(await this.listingRepository.save(listing));
  }

  private async getOwnedListing(
    customerId: string,
    id: string,
    providerId?: string,
  ) {
    const context = await this.requireProviderContext(customerId, providerId);
    const listing = await this.listingRepository.findById(id);
    if (!listing)
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, id);
    if (listing.providerId !== context.providerId)
      throw new BusinessException(
        CommonErrorCodes.FORBIDDEN,
        context.providerId,
      );
    await this.supplyAccessPolicy.requireWriteAccess(context);
    return listing;
  }

  /** Resolves provider context and enforces supply read access. */
  private async requireProviderContext(
    customerId: string,
    providerId?: string,
  ): Promise<ProviderContext> {
    const context = await this.providerContextResolver.resolve(
      customerId,
      providerId,
    );
    this.supplyAccessPolicy.requireReadAccess(context);
    return context;
  }

  private assertEstateOwnership(
    estate: { customerId: string; providerId: string | null },
    customerId: string,
    providerId: string,
  ): void {
    if (estate.customerId !== customerId || estate.providerId !== providerId) {
      throw new BusinessException(CommonErrorCodes.FORBIDDEN, providerId);
    }
  }

  private toResponse(listing: Listing): ListingResponse {
    const estate = listing.estate;
    return {
      id: listing.id,
      estateId: listing.estateId,
      providerId: listing.providerId,
      status: listing.status,
      publishedAt: listing.publishedAt,
      estate: {
        id: estate.id,
        title: estate.title,
        description: estate.description,
        type: estate.type,
        purpose: estate.purpose,
        price: Number(estate.price),
        area: estate.area === null ? null : Number(estate.area),
        bedrooms: estate.bedrooms,
        bathrooms: estate.bathrooms,
        floors: estate.floors,
        addressLine: estate.addressLine,
        provinceId: estate.provinceId,
        wardId: estate.wardId,
        latitude: estate.latitude === null ? null : Number(estate.latitude),
        longitude: estate.longitude === null ? null : Number(estate.longitude),
        province: {
          id: estate.province.id,
          code: estate.province.code,
          name: estate.province.name,
        },
        ward: {
          id: estate.ward.id,
          code: estate.ward.code,
          name: estate.ward.name,
        },
      },
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }
}
