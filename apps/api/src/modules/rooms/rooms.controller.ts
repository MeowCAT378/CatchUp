import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateRoomDto, JoinRoomDto, SubmitAnswerDto } from './dto';
import { RoomExportService } from './room-export.service';
import { RoomResultsService } from './room-results.service';
import { RoomsService } from './rooms.service';
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly results: RoomResultsService,
    private readonly exports: RoomExportService,
  ) {}
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HOST, Role.ADMIN)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(dto.quizId, u.sub);
  }
  @Post('join') join(@Body() dto: JoinRoomDto) {
    return this.rooms.join(dto.code, dto.displayName);
  }
  @Get(':code/results/export.csv') @UseGuards(JwtAuthGuard) async exportCsv(
    @Param('code') code: string,
    @CurrentUser() u: AuthUser,
    @Res() response: Response,
  ) {
    response
      .type('text/csv; charset=utf-8')
      .attachment(`catchup-${code}-results.csv`)
      .send(await this.exports.csv(code, u.sub));
  }
  @Get(':code/results/export.xlsx') @UseGuards(JwtAuthGuard) async exportXlsx(
    @Param('code') code: string,
    @CurrentUser() u: AuthUser,
    @Res() response: Response,
  ) {
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment(`catchup-${code}-results.xlsx`)
      .send(await this.exports.xlsx(code, u.sub));
  }
  @Get(':code/results') @UseGuards(JwtAuthGuard) resultsForHost(
    @Param('code') code: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.results.results(code, u.sub);
  }
  @Get(':code/dashboard') @UseGuards(JwtAuthGuard) dashboard(
    @Param('code') code: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.rooms.dashboard(code, u.sub);
  }
  @Get(':code') state(
    @Param('code') code: string,
    @Query('participantId') participantId?: string,
    @Query('participantToken') participantToken?: string,
  ) {
    return this.rooms.state(code, participantId, participantToken);
  }
  @Post(':code/start') @UseGuards(JwtAuthGuard) start(
    @Param('code') code: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.rooms.start(code, u.sub);
  }
  @Post(':code/next') @UseGuards(JwtAuthGuard) next(
    @Param('code') code: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.rooms.next(code, u.sub);
  }
  @Post(':code/answers') answer(
    @Param('code') code: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.rooms.submit(
      code,
      dto.participantId,
      dto.participantToken,
      dto.choiceId,
    );
  }
  @Get(':code/result') result(
    @Param('code') code: string,
    @Query('participantId') participantId?: string,
  ) {
    return this.rooms.result(code, participantId);
  }
}
