import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { Listing, ListingStatus } from '../../../listing/listing/entities';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { LeadResponse } from '../dto/lead.response';
import { LeadStatus } from '../entities';
import { LeadRepo } from '../repositories/lead.repo';

@Injectable()
export class LeadService {
  constructor(
    private readonly leadRepository: LeadRepo,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async create(listingId: string, dto: CreateLeadDto): Promise<LeadResponse> {
    const listing = await this.listingRepository.findOne({
      where: { id: listingId, status: ListingStatus.PUBLISHED },
    });
    if (!listing)
      throw new BusinessException(
        CommonErrorCodes.RESOURCE_NOT_FOUND,
        listingId,
      );
    const lead = this.leadRepository.create({
      listingId,
      listing,
      status: LeadStatus.NEW,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      email: dto.email?.trim() || null,
      message: dto.message?.trim() || null,
    });
    const saved = await this.leadRepository.save(lead);
    return {
      id: saved.id,
      listingId: saved.listingId,
      status: saved.status,
      name: saved.name,
      phone: saved.phone,
      email: saved.email,
      message: saved.message,
      createdAt: saved.createdAt,
    };
  }
}
