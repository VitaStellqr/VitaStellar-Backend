import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageService } from './storage.service';
import { DataExportToken } from '../../database/entities/data-export-token.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DataExportToken])],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
