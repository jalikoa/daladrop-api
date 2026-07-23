import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma Module
 * 
 * Global module that provides PrismaService across the entire application.
 * This module is only imported when ORM_TYPE=prisma is set in the environment.
 * 
 * The @Global() decorator ensures that PrismaService can be injected into 
 * any provider without needing to import PrismaModule in every feature module.
 * 
 * Usage in feature modules:
 * ```typescript
 * @Injectable()
 * export class PatientService {
 *   constructor(private prisma: PrismaService) {}
 *   
 *   async findAll() {
 *     return this.prisma.patient.findMany();
 *   }
 * }
 * ```
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}