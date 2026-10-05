import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Safely advances and fetches the next integer value from an atomic PostgreSQL sequence.
   * Whitelists sequence names to prevent any SQL injection.
   */
  async getNextSequenceValue(
    sequenceName: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const validSequences = [
      'user_code_seq',
      'txn_code_seq',
      'booking_code_seq',
      'invoice_code_seq',
    ];
    if (!validSequences.includes(sequenceName)) {
      throw new Error(`Invalid sequence name: ${sequenceName}`);
    }

    const client = tx || this;
    const result = await client.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('${sequenceName}') AS nextval;`,
    );

    return Number(result[0].nextval);
  }
}
