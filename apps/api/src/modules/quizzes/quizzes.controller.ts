import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import type { AuthUser } from '../../common/auth/auth-user';
import {
  CreateQuestionDto,
  CreateQuizDto,
  UpdateQuestionDto,
  UpdateQuizDto,
} from './dto';
import { QuizzesService } from './quizzes.service';
import { RoomsGateway } from '../rooms/rooms.gateway';
@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HOST, Role.ADMIN)
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly roomsGateway: RoomsGateway,
  ) {}
  @Get() list(@CurrentUser() u: AuthUser) {
    return this.quizzes.list(u.sub);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(u.sub, dto);
  }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.quizzes.one(id, u.sub);
  }
  @Patch(':id') update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.update(id, u.sub, dto);
  }
  @Delete(':id') async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const deleted = await this.quizzes.remove(id, u.sub);
    this.roomsGateway.activityDeleted(deleted.rooms);
    return { id: deleted.id };
  }
  @Post(':id/questions') addQuestion(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.quizzes.addQuestion(id, u.sub, dto);
  }
  @Patch('questions/:id') updateQuestion(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.quizzes.updateQuestion(id, u.sub, dto);
  }
  @Delete('questions/:id') removeQuestion(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.quizzes.removeQuestion(id, u.sub);
  }
}
