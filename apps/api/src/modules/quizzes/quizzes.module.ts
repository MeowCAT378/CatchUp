import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
@Module({
  imports: [AuthModule, RoomsModule],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
