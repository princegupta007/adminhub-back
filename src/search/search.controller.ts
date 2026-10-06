import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GlobalSearchResponseDto } from './dto/search-response.dto.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('Search')
@ApiBearerAuth('JWT-auth')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Cross-entity omni-search across users, transactions, and bookings',
    description:
      'Performs concurrent full-text search across customer profiles, ledger transactions, and service appointments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results aggregated across all domains',
    type: GlobalSearchResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(@Query() query: SearchQueryDto): Promise<GlobalSearchResponseDto> {
    return this.searchService.search(query);
  }
}
