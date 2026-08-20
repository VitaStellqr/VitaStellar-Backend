import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DataExportService } from '../services/data-export.service';
import { NotFoundException } from '@nestjs/common';

@ApiTags('users')
@Controller('users/data-export')
export class DataExportDownloadController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Get('download')
  @ApiOperation({
    summary: 'Download GDPR export (single-use hashed token, expires in 24h)',
  })
  async download(@Query('token') token: string, @Res() res: Response) {
    if (!token || typeof token !== 'string' || token.length !== 64) {
      throw new BadRequestException('A valid 64-character download token is required');
    }

    try {
      const { content, exportId } = await this.dataExportService.readExportFile(token);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vitastellar-export-${exportId}.json"`
      );
      res.send(content);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException(
          'Export link is invalid, expired, or already downloaded'
        );
      }
      throw error;
    }
  }
}
