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
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionDetailResponseDto } from './dto/transaction-detail-response.dto.js';
import {
  PaginatedTransactionsResponseDto,
  TransactionSummaryDto,
} from './dto/transaction-response.dto.js';
import { TransactionStatsDto } from './dto/transaction-stats-response.dto.js';
import { TransactionsQueryDto } from './dto/transactions-query.dto.js';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List financial transactions with search, filters, and pagination',
    description:
      'Returns a paginated list of financial ledger transactions supporting multi-field search, status/type filters, date ranges, and sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated transactions list retrieved successfully',
    type: PaginatedTransactionsResponseDto,
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
    @Query() query: TransactionsQueryDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.transactionsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get overview statistics for transactions header cards',
    description:
      'Returns aggregate counts, total revenue, average order value, pending count, and success rate for transactions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions statistics computed successfully',
    type: TransactionStatsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getStats(): Promise<TransactionStatsDto> {
    return this.transactionsService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get transaction details with customer info, status history, and ledger entries',
    description:
      'Resolves a transaction by either its internal UUID or business code (e.g. TXN-0017).',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction UUID or business code (e.g. TXN-0017)',
    example: 'TXN-0017',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully',
    type: TransactionDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<TransactionDetailResponseDto> {
    return this.transactionsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new financial transaction with atomic code generation',
    description:
      'Creates a new ledger transaction, allocates the next sequential TXN-XXXX code, and logs audit entries.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    type: TransactionSummaryDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed on request body',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Target customer user does not exist or is soft-deleted',
  })
  @ApiResponse({
    status: 409,
    description: 'Transaction reference collision',
  })
  async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser('id') adminId: string,
  ): Promise<TransactionSummaryDto> {
    return this.transactionsService.create(dto, adminId);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Update transaction status with lifecycle validation and history entry',
    description:
      'Updates the status of a transaction according to allowable state transitions, recording an audit note in status history.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction UUID or business code (e.g. TXN-0017)',
    example: 'TXN-0017',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction status updated successfully',
    type: TransactionDetailResponseDto,
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
    description: 'Transaction not found',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionStatusDto,
    @CurrentUser('id') adminId: string,
  ): Promise<TransactionDetailResponseDto> {
    return this.transactionsService.updateStatus(id, dto, adminId);
  }
}
