import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Listing, ListingStatus } from '../entities';
import { ListingQueryDto, ListingSort } from '../dto/listing-query.dto';

@Injectable()
export class ListingRepo {
  private readonly repository: Repository<Listing>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Listing);
  }

  async findById(id: string, publicOnly = false): Promise<Listing | null> {
    const query = this.baseQuery()
      .andWhere('listing.id = :id', { id })
      .andWhere('listing.deletedAt IS NULL');
    if (publicOnly)
      query.andWhere('listing.status = :status', {
        status: ListingStatus.PUBLISHED,
      });
    return query.getOne();
  }

  findByEstateId(estateId: string): Promise<Listing | null> {
    return this.baseQuery()
      .andWhere('listing.estateId = :estateId', { estateId })
      .andWhere('listing.deletedAt IS NULL')
      .getOne();
  }

  findMine(providerId: string): Promise<Listing[]> {
    return this.baseQuery()
      .andWhere('listing.providerId = :providerId', { providerId })
      .andWhere('listing.deletedAt IS NULL')
      .orderBy('listing.createdAt', 'DESC')
      .getMany();
  }

  async findPublic(queryDto: ListingQueryDto) {
    const query = this.baseQuery()
      .andWhere('listing.status = :status', { status: ListingStatus.PUBLISHED })
      .andWhere('listing.deletedAt IS NULL');
    if (queryDto.q) {
      query.andWhere(
        "(LOWER(estate.title) LIKE LOWER(:q) OR LOWER(COALESCE(estate.description, '')) LIKE LOWER(:q) OR LOWER(estate.addressLine) LIKE LOWER(:q) OR LOWER(province.name) LIKE LOWER(:q) OR LOWER(ward.name) LIKE LOWER(:q))",
        { q: `%${queryDto.q}%` },
      );
    }
    if (queryDto.type)
      query.andWhere('estate.type = :type', { type: queryDto.type });
    if (queryDto.purpose)
      query.andWhere('estate.purpose = :purpose', {
        purpose: queryDto.purpose,
      });
    if (queryDto.provinceId)
      query.andWhere('estate.provinceId = :provinceId', {
        provinceId: queryDto.provinceId,
      });
    if (queryDto.wardId)
      query.andWhere('estate.wardId = :wardId', { wardId: queryDto.wardId });
    if (queryDto.minPrice !== undefined)
      query.andWhere('estate.price >= :minPrice', {
        minPrice: queryDto.minPrice,
      });
    if (queryDto.maxPrice !== undefined)
      query.andWhere('estate.price <= :maxPrice', {
        maxPrice: queryDto.maxPrice,
      });
    if (queryDto.minArea !== undefined)
      query.andWhere('estate.area >= :minArea', { minArea: queryDto.minArea });
    if (queryDto.maxArea !== undefined)
      query.andWhere('estate.area <= :maxArea', { maxArea: queryDto.maxArea });
    if (queryDto.bedrooms !== undefined)
      query.andWhere('estate.bedrooms >= :bedrooms', {
        bedrooms: queryDto.bedrooms,
      });
    switch (queryDto.sort) {
      case ListingSort.PRICE_ASC:
        query.orderBy('estate.price', 'ASC');
        break;
      case ListingSort.PRICE_DESC:
        query.orderBy('estate.price', 'DESC');
        break;
      default:
        query.orderBy('listing.publishedAt', 'DESC');
    }
    const [items, total] = await query
      .skip((queryDto.page - 1) * queryDto.limit)
      .take(queryDto.limit)
      .getManyAndCount();
    return { items, total };
  }

  create(data: Partial<Listing>): Listing {
    return this.repository.create(data);
  }

  save(listing: Listing): Promise<Listing> {
    return this.repository.save(listing);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return (result.affected ?? 0) > 0;
  }

  private baseQuery() {
    return this.repository
      .createQueryBuilder('listing')
      .innerJoinAndSelect('listing.estate', 'estate')
      .innerJoinAndSelect('estate.province', 'province')
      .innerJoinAndSelect('estate.ward', 'ward')
      .innerJoinAndSelect('listing.provider', 'provider');
  }
}
