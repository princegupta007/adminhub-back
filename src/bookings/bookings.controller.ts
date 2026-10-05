import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { BookingDetailResponseDto } from './dto/booking-detail-response.dto.js';
import {
  BookingSummaryDto,
  PaginatedBookingsResponseDto,
} from './dto/booking-response.dto.js';
import { BookingStatsDto } from './dto/booking-stats-response.dto.js';
import { BookingsQueryDto } from './dto/bookings-query.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';
import { BookingsService } from './bookings.service.js';

@ApiTags('Bookings')
@ApiBearerAuth('JWT-auth')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({
    summary: 'List service bookings with filters, search, and pagination',
    description:
      'Returns a paginated list of service bookings supporting multi-field search, status/category filters, temporal states (upcoming vs past), and sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated bookings retrieved successfully',
    type: PaginatedBookingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters or date range',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async findAll(
    @Query() query: BookingsQueryDto,
  ): Promise<PaginatedBookingsResponseDto> {
    return this.bookingsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get overview statistics for bookings directory cards',
    description:
      'Returns aggregate counts, active bookings, upcoming count, completed, cancelled, and gross revenue with MoM growth percentages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings statistics computed successfully',
    type: BookingStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getStats(): Promise<BookingStatsDto> {
    return this.bookingsService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get booking details with meeting logistics, customer overview, and lifecycle logs',
    description:
      'Resolves a booking by either its internal UUID or business code (e.g. BKG-0045).',
  })
  @ApiParam({
    name: 'id',
    description: 'Booking UUID or business code (e.g. BKG-0045)',
    example: 'BKG-0045',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking details retrieved successfully',
    type: BookingDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Booking appointment not found',
  })
  async findOne(@Param('id') id: string): Promise<BookingDetailResponseDto> {
    return this.bookingsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new service booking appointment',
    description:
      'Schedules a new booking appointment, allocates atomic BKG-XXXX and INV-XXXX codes, verifies time collisions, and records audit logs.',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    type: BookingSummaryDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or scheduling in the past',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Target customer user not found or deleted',
  })
  @ApiResponse({
    status: 409,
    description:
      'Time slot collision: Customer already has an active overlapping booking',
  })
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser('id') adminId: string,
  ): Promise<BookingSummaryDto> {
    return this.bookingsService.create(dto, adminId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update or reschedule a booking with lifecycle transitions',
    description:
      'Updates booking logistics, reschedules appointment time, adjusts status, and appends to the audit lifecycle log.',
  })
  @ApiParam({
    name: 'id',
    description: 'Booking UUID or business code (e.g. BKG-0045)',
    example: 'BKG-0045',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking updated successfully',
    type: BookingDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Disallowed lifecycle status transition or invalid payload',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Rescheduling conflict: Customer already has an active overlapping booking in the new time window',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser('id') adminId: string,
  ): Promise<BookingDetailResponseDto> {
    return this.bookingsService.update(id, dto, adminId);
  }
}
