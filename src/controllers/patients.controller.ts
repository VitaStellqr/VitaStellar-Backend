import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/role.guard';
import { Role } from '../auth/role.enum';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('patients')
export class PatientsController {
  @Get('profile')
  @Roles(Role.Patient)
  getProfile() {
    return { msg: 'patient profile' };
  }

  @Get('medical-records')
  @Roles(Role.Doctor, Role.Admin)
  getMedicalRecords() {
    return { msg: 'records list' };
  }

  @Get('admin-dashboard')
  @Roles(Role.Admin)
  adminDashboard() {
    return { msg: 'admin-only data' };
  }
}
