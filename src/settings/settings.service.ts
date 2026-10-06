import { Injectable, Logger } from '@nestjs/common';
import type { WorkspaceSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { WorkspaceSettingDto } from './dto/settings-response.dto.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapSettings(settings: WorkspaceSetting): WorkspaceSettingDto {
    return {
      id: settings.id,
      workspaceName: settings.workspaceName,
      supportEmail: settings.supportEmail,
      currency: settings.currency,
      timezone: settings.timezone,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async getSettings(): Promise<WorkspaceSettingDto> {
    let settings = await this.prisma.workspaceSetting.findFirst();

    if (!settings) {
      this.logger.log('No workspace settings found, initializing defaults.');
      settings = await this.prisma.workspaceSetting.create({
        data: {
          workspaceName: 'AdminHub',
          supportEmail: 'support@adminhub.io',
          currency: 'USD',
          timezone: 'PST (UTC-08:00)',
        },
      });
    }

    return this.mapSettings(settings);
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<WorkspaceSettingDto> {
    let settings = await this.prisma.workspaceSetting.findFirst();

    if (!settings) {
      settings = await this.prisma.workspaceSetting.create({
        data: {
          workspaceName: dto.workspaceName ?? 'AdminHub',
          supportEmail: dto.supportEmail ?? 'support@adminhub.io',
          currency: dto.currency ?? 'USD',
          timezone: dto.timezone ?? 'PST (UTC-08:00)',
        },
      });
      return this.mapSettings(settings);
    }

    const updated = await this.prisma.workspaceSetting.update({
      where: { id: settings.id },
      data: {
        ...(dto.workspaceName !== undefined && {
          workspaceName: dto.workspaceName.trim(),
        }),
        ...(dto.supportEmail !== undefined && {
          supportEmail: dto.supportEmail.trim(),
        }),
        ...(dto.currency !== undefined && { currency: dto.currency.trim() }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone.trim() }),
      },
    });

    this.logger.log('Workspace settings updated successfully');
    return this.mapSettings(updated);
  }
}
