import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { LeadResponse } from '../dto/lead.response';
import { LeadService } from '../services/lead.service';

@ApiTags('Leads')
@Controller('listings/:listingId/leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit a contact lead for a published listing' })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  create(
    @Param('listingId', new ParseUUIDPipe()) listingId: string,
    @Body() dto: CreateLeadDto,
  ): Promise<LeadResponse> {
    return this.leadService.create(listingId, dto);
  }
}
