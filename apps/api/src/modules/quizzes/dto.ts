import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  choices!: ChoiceDto[];
}
export class CreateQuizDto {
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
export class UpdateQuizDto extends CreateQuizDto {}
export class UpdateQuestionDto extends CreateQuestionDto {}
