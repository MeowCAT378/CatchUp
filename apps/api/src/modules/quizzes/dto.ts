import { Transform, Type } from 'class-transformer';
import { ActivityType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ChoiceDto {
  @IsOptional() @IsString() @MaxLength(64) id?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) text!: string;
  @IsBoolean() isCorrect!: boolean;
}
export class CreateQuestionDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) text!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  choices?: ChoiceDto[];
}
export class CreateQuizDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(150) title!: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2_000)
  description?: string;
  @IsEnum(ActivityType) type!: ActivityType;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
export class UpdateQuizDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2_000)
  description?: string;
}
export class DuplicateQuizDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;
}
export class UpdateQuestionDto extends CreateQuestionDto {}
