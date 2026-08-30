import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { SmsModule } from '../shared/sms/sms.module';

@Module({
  imports: [ConfigModule, SmsModule],
  controllers: [OtpController],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
