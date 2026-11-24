import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class StartWorkoutDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  planId!: number;
}

export class CreateSetDto {
  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  exerciseId!: number;

  @ApiProperty({ example: 1, description: '组号 1-10（与 exercise_id 组成幂等键）' })
  @IsInt()
  @Min(1)
  @Max(10)
  setNo!: number;

  @ApiProperty({ example: 40, description: '重量 kg（0-9999.99）' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  weight!: number;

  @ApiProperty({ example: 10, description: '次数 0-50' })
  @IsInt()
  @Min(0)
  @Max(50)
  reps!: number;

  @ApiProperty({ example: true, description: '是否已完成（容量只算 true 的组）' })
  @IsBoolean()
  done!: boolean;
}

export class UpdateSetDto {
  @ApiPropertyOptional({ example: 42.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  weight?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  reps?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
