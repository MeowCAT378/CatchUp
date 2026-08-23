import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class RegisterDto {
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72)
  password!: string;
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
export class LoginDto {
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString()
  @IsByteLength(0, 72)
  password!: string;
}
