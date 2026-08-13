import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
export class RegisterDto {
  @Transform(email)
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(2) name!: string;
}
export class LoginDto {
  @Transform(email)
  @IsEmail() email!: string;
  @IsString() password!: string;
}
