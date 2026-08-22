import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AdminService } from './admin.service';
import {
  TeacherQueryDto,
  UpdateTeacherDto,
  UpdateTeacherStatusDto,
} from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview') overview() {
    return this.admin.overview();
  }
  @Get('teachers') teachers(@Query() query: TeacherQueryDto) {
    return this.admin.teachers(query);
  }
  @Get('teachers/:id') teacher(@Param('id') id: string) {
    return this.admin.teacher(id);
  }
  @Patch('teachers/:id') updateTeacher(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.admin.updateTeacher(user.sub, id, dto);
  }
  @Patch('teachers/:id/status') updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherStatusDto,
  ) {
    return this.admin.updateStatus(user.sub, id, dto);
  }
}
