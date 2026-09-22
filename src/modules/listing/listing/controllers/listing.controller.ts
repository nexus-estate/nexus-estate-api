import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ProviderId } from '../../../../common/decorators/provider-id.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type { CustomerPrincipal } from '../../../../common/security/auth.types';
import { CustomerJwtAuthGuard } from '../../../customer/authentication/guards/customer-jwt-auth.guard';
import { CreateListingDto } from '../dto/create-listing.dto';
import { ListingPageResponse, ListingResponse } from '../dto/listing.response';
import { ListingQueryDto } from '../dto/listing-query.dto';
import { ListingService } from '../services/listing.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post()
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Provider-Id', required: false })
  @ApiOperation({ summary: 'Create a draft listing from an existing estate' })
  @ApiForbiddenResponse({
    description: 'Provider lifecycle or listing:create permission denied.',
  })
  create(
    @CurrentUser() user: CustomerPrincipal,
    @Body() dto: CreateListingDto,
    @ProviderId() providerId?: string,
  ): Promise<ListingResponse> {
    return this.listingService.create(user.id, dto, providerId);
  }

  @Get('mine')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Provider-Id', required: false })
  @ApiOperation({ summary: "List the current provider's listings" })
  @ApiForbiddenResponse({
    description: 'Provider lifecycle or listing:read permission denied.',
  })
  mine(
    @CurrentUser() user: CustomerPrincipal,
    @ProviderId() providerId?: string,
  ): Promise<ListingResponse[]> {
    return this.listingService.findMine(user.id, providerId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List published marketplace listings' })
  @ApiOkResponse({ type: ListingPageResponse })
  list(@Query() query: ListingQueryDto) {
    return this.listingService.findPublic(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a published marketplace listing' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<ListingResponse> {
    return this.listingService.findPublicById(id);
  }

  @Post(':id/publish')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Provider-Id', required: false })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Publish a provider listing' })
  @ApiForbiddenResponse({
    description: 'Provider lifecycle or listing:publish permission denied.',
  })
  publish(
    @CurrentUser() user: CustomerPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ProviderId() providerId?: string,
  ): Promise<ListingResponse> {
    return this.listingService.publish(user.id, id, providerId);
  }

  @Post(':id/unpublish')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Provider-Id', required: false })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Unpublish a provider listing' })
  @ApiForbiddenResponse({
    description: 'Provider lifecycle or listing:archive permission denied.',
  })
  unpublish(
    @CurrentUser() user: CustomerPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ProviderId() providerId?: string,
  ): Promise<ListingResponse> {
    return this.listingService.unpublish(user.id, id, providerId);
  }
}
