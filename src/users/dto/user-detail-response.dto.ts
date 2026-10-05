import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class UserRecentTransactionDto {
  @ApiProperty({ example: 'e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'TXN-0017' })
  txnCode!: string;

  @ApiProperty({ example: '2026-10-04T14:20:00.000Z' })
  date!: string;

  @ApiProperty({ example: 1250.0 })
  amount!: number;

  @ApiProperty({ example: 'PAYMENT' })
  type!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ example: 'Credit Card (Visa ending in 4582)' })
  paymentMethod!: string;
}

export class UserRecentBookingDto {
  @ApiProperty({ example: 'b5f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'BKG-0045' })
  bookingCode!: string;

  @ApiProperty({ example: 'Home Deep Cleaning' })
  service!: string;

  @ApiProperty({ example: '2026-10-12T10:00:00.000Z' })
  scheduledAt!: string;

  @ApiProperty({ example: 149.0 })
  amount!: number;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;
}

export class UserRecentActivityDto {
  @ApiProperty({ example: 'a6f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'Password Changed' })
  title!: string;

  @ApiProperty({ example: 'Security credential refreshed via self-service' })
  desc!: string;

  @ApiProperty({ example: '2026-10-04T11:15:00.000Z' })
  time!: string;
}

export class UserDetailDto {
  @ApiProperty({ example: 'd4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b' })
  id!: string;

  @ApiProperty({ example: 'USR-0001' })
  userCode!: string;

  @ApiProperty({ example: 'Sarah Jenkins' })
  name!: string;

  @ApiProperty({ example: 'Sarah' })
  firstName!: string;

  @ApiProperty({ example: 'Jenkins' })
  lastName!: string;

  @ApiProperty({ example: 'sarah.jenkins@example.com' })
  email!: string;

  @ApiProperty({ example: '+1 (555) 014-2210' })
  phone!: string;

  @ApiPropertyOptional({ example: '1992-05-18', nullable: true })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: '742 Evergreen Terrace', nullable: true })
  addressLine?: string | null;

  @ApiPropertyOptional({ example: 'Springfield', nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ example: 'OR', nullable: true })
  state?: string | null;

  @ApiPropertyOptional({ example: 'USA', nullable: true })
  country?: string | null;

  @ApiPropertyOptional({
    example: 'https://i.pravatar.cc/150?u=1',
    nullable: true,
  })
  avatarUrl?: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: true })
  twoFactorEnabled!: boolean;

  @ApiProperty({ example: '2024-03-15T00:00:00.000Z' })
  joinedAt!: string;

  @ApiPropertyOptional({ example: '2026-10-05T19:30:00.000Z', nullable: true })
  lastLoginAt?: string | null;

  @ApiProperty({ example: '2024-03-15T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-05T19:30:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: [UserRecentTransactionDto] })
  recentTransactions!: UserRecentTransactionDto[];

  @ApiProperty({ type: [UserRecentBookingDto] })
  recentBookings!: UserRecentBookingDto[];

  @ApiProperty({ type: [UserRecentActivityDto] })
  recentActivity!: UserRecentActivityDto[];
}

export class UserDetailResponseDto {
  @ApiProperty({ type: UserDetailDto })
  data!: UserDetailDto;
}
