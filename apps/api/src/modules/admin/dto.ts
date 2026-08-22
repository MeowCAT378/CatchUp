import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class TeacherQueryDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: 'ACTIVE' | 'DISABLED';
  @IsOptional()
  @IsIn(['name', 'email', 'createdAt', 'updatedAt'])
  sortBy: 'name' | 'email' | 'createdAt' | 'updatedAt' = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class UpdateTeacherDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
  @IsOptional() @Transform(email) @IsEmail() @MaxLength(254) email?: string;
}

export class UpdateTeacherStatusDto {
  @IsBoolean() isDisabled!: boolean;
}
