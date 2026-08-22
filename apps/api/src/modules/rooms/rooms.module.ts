import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { RoomExportService } from './room-export.service';
import { RoomResultsService } from './room-results.service';
import { RoomsService } from './rooms.service';
import { RoomHistoryService } from './room-history.service';
@Module({
  imports: [AuthModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomResultsService,
    RoomExportService,
    RoomHistoryService,
    RoomsGateway,
  ],
  exports: [RoomsGateway],
})
export class RoomsModule {}
