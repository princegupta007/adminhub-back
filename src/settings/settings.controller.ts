import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { WorkspaceSettingResponseDto } from './dto/settings-response.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get workspace settings',
    description:
      'Retrieves organization settings including workspace name, support email, currency, and timezone.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace settings retrieved successfully',
    type: WorkspaceSettingResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSettings(): Promise<WorkspaceSettingResponseDto> {
    const data = await this.settingsService.getSettings();
    return { data };
  }

  @Patch()
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update workspace settings',
    description:
      'Updates organization settings such as workspace name, support email, currency, and timezone. Restricted to SUPER_ADMIN.',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Workspace settings updated successfully',
    type: WorkspaceSettingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires SUPER_ADMIN)' })
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
  ): Promise<WorkspaceSettingResponseDto> {
    const data = await this.settingsService.updateSettings(dto);
    return { data };
  }
}
