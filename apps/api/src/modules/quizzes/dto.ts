import { Type } from 'class-transformer';
import { ActivityType } from '@prisma/client';
import {
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class ChoiceDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) text!: string;
  @IsBoolean() isCorrect!: boolean;
}
export class CreateQuestionDto {
  @IsString() @MinLength(1) text!: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  choices?: ChoiceDto[];
}
export class CreateQuizDto {
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(ActivityType) type!: ActivityType;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
export class UpdateQuizDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsString() description?: string;
}
export class DuplicateQuizDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
}
export class UpdateQuestionDto extends CreateQuestionDto {}
