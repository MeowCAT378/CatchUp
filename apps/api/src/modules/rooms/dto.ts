import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CreateRoomDto {
  @IsString() quizId!: string;
}
export class JoinRoomDto {
  @IsString() @Matches(/^\d{6}$/) code!: string;
  @IsString() @MinLength(2) displayName!: string;
}
export class SubmitAnswerDto {
  @IsString() participantId!: string;
  @IsString() participantToken!: string;
  @IsString() choiceId!: string;
}
export class SubmitWordDto {
  @IsString() participantId!: string;
  @IsString() participantToken!: string;
  @IsString() @MinLength(1) @MaxLength(30) text!: string;
}
export class VoteWordDto {
  @IsString() participantId!: string;
  @IsString() participantToken!: string;
  @IsString() entryId!: string;
}
