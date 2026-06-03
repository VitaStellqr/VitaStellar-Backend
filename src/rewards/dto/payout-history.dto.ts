import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RewardStatus } from '../enums/reward-status.enum';

export class PayoutHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Start date for filtering payouts (ISO 8601 format)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering payouts (ISO 8601 format)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by payout status',
    enum: RewardStatus,
  })
  @IsOptional()
  @IsEnum(RewardStatus)
  status?: RewardStatus;
}

export class PayoutHistoryItemDto {
  @ApiProperty({
    description: 'Unique identifier for the payout transaction',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Amount of XLM paid out',
    type: Number,
  })
  amount: number;

  @ApiProperty({
    description: 'Status of the payout transaction',
    enum: RewardStatus,
  })
  status: RewardStatus;

  @ApiPropertyOptional({
    description: 'Stellar transaction hash for completed payouts',
    type: String,
  })
  stellarTxHash?: string;

  @ApiProperty({
    description: 'When the payout transaction was created',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;
}

export class PayoutHistoryResponseDto {
  @ApiProperty({
    description: 'Array of payout transactions',
    type: [PayoutHistoryItemDto],
  })
  data: PayoutHistoryItemDto[];

  @ApiProperty({
    description: 'Current page number',
    type: Number,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    type: Number,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    type: Number,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    type: Number,
  })
  totalPages: number;
}
