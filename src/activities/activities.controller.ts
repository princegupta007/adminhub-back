import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ActivitiesService } from './activities.service.js';
import { ActivitiesQueryDto } from './dto/activities-query.dto.js';
import { ActivityListResponseDto } from './dto/activity-response.dto.js';

@ApiTags('Activities')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve paginated system activity and audit logs',
    description:
      'Fetches historical activity stream with filtering by target user ID, action tag, search keyword, and date window.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity stream retrieved successfully',
    type: ActivityListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() query: ActivitiesQueryDto,
  ): Promise<ActivityListResponseDto> {
    return this.activitiesService.findAll(query);
  }
}
