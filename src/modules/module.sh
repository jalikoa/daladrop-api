#!/usr/bin/env bash

# ============================================================================
# HMS Modular Scaffold Generator
# ============================================================================
# Usage: ./scaffold-module.sh <domain-name>
# Example: ./scaffold-module.sh payment-sessions
#
# This script creates a fully-structured, ORM-agnostic NestJS module.
# ============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Input validation
# ----------------------------------------------------------------------------
if [ $# -eq 0 ]; then
    echo "[**] Error: Domain name is required."
    echo "Usage: $0 <domain-name>"
    echo "Example: $0 payment-sessions"
    exit 1
fi

DOMAIN_INPUT="$1"

# Normalize domain to lowercase kebab-case
DOMAIN=$(echo "$DOMAIN_INPUT" | tr '[:upper:]' '[:lower:]' | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g' | tr '_' '-')

# Singular form (naive: removes trailing 's', handles edge cases reasonably well)
SINGULAR=$(echo "$DOMAIN" | sed -E 's/s$//')

# Cross-platform PascalCase conversion (works on macOS/BSD and Linux)
PASCAL=$(echo "$DOMAIN" | awk -F- '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1' | tr -d ' ')
SINGULAR_PASCAL=$(echo "$SINGULAR" | awk -F- '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1' | tr -d ' ')

# UPPER_SNAKE for constants
UPPER_SNAKE=$(echo "$DOMAIN" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
SINGULAR_UPPER_SNAKE=$(echo "$SINGULAR" | tr '-' '_' | tr '[:lower:]' '[:upper:]')

# Target directory
TARGET_DIR="./${DOMAIN}"

echo "[**] Scaffolding module: ${DOMAIN}"
echo "   PascalCase:      ${PASCAL}"
echo "   Singular Pascal: ${SINGULAR_PASCAL}"
echo "   UPPER_SNAKE:     ${UPPER_SNAKE}"
echo "   Target:          ${TARGET_DIR}"
echo ""

# ----------------------------------------------------------------------------
# Check if target already exists
# ----------------------------------------------------------------------------
if [ -d "$TARGET_DIR" ]; then
    echo "[**] Error: Directory ${TARGET_DIR} already exists."
    echo "   Remove it first or choose a different domain name."
    exit 1
fi

# ----------------------------------------------------------------------------
# Create directory structure
# ----------------------------------------------------------------------------
DIRS=(
    "${TARGET_DIR}"
    "${TARGET_DIR}/adapters"
    "${TARGET_DIR}/constants"
    "${TARGET_DIR}/dto"
    "${TARGET_DIR}/dto/__tests__"
    "${TARGET_DIR}/entities"
    "${TARGET_DIR}/enums"
    "${TARGET_DIR}/events"
    "${TARGET_DIR}/guards"
    "${TARGET_DIR}/handlers"
    "${TARGET_DIR}/interceptors"
    "${TARGET_DIR}/interfaces"
    "${TARGET_DIR}/listeners"
    "${TARGET_DIR}/mappers"
    "${TARGET_DIR}/processors"
    "${TARGET_DIR}/queues"
    "${TARGET_DIR}/repositories"
    "${TARGET_DIR}/repositories/typeorm"
    "${TARGET_DIR}/repositories/prisma"
    "${TARGET_DIR}/use-cases"
    "${TARGET_DIR}/validators"
    "${TARGET_DIR}/value-objects"
    "${TARGET_DIR}/__tests__"
)

for dir in "${DIRS[@]}"; do
    mkdir -p "$dir"
done

echo "[**] Directories created."

# ----------------------------------------------------------------------------
# Helper: write a file with the standard block comment
# ----------------------------------------------------------------------------
write_file() {
    local path="$1"
    local description="$2"
    local content="$3"

    cat > "$path" <<EOF
/****
 * File: $(basename "$path")
 * Module: ${DOMAIN}
 * Purpose: ${description}
 *
 ****/

${content}
EOF
}

# ----------------------------------------------------------------------------
# Root files: controller, module, service
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/${DOMAIN}.controller.ts" \
    "HTTP entry point. Routes requests to use-cases with Swagger & Guard decorators." \
"import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ${PASCAL}Service } from './${DOMAIN}.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../../auth/guards/roles.guard';
// import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('${PASCAL}')
@Controller('${DOMAIN}')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('ADMIN')
// @ApiBearerAuth()
export class ${PASCAL}Controller {
  constructor(private readonly ${DOMAIN}Service: ${PASCAL}Service) {}

  @Get()
  @ApiOperation({ summary: 'Get all ${DOMAIN}' })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.${DOMAIN}Service.findAll(page, limit);
  }
}
"

write_file "${TARGET_DIR}/${DOMAIN}.module.ts" \
    "NestJS module definition. Wires controllers, services, repositories, and use-cases." \
"import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { ${SINGULAR_PASCAL} } from './entities/${SINGULAR}.entity';
import { ${PASCAL}Controller } from './${DOMAIN}.controller';
import { ${PASCAL}Service } from './${DOMAIN}.service';
import { ${PASCAL}RepositoryProvider } from './repositories/${DOMAIN}.repository';
// import { Create${SINGULAR_PASCAL}UseCase } from './use-cases/create-${SINGULAR}.usecase';

@Module({
  // imports: [TypeOrmModule.forFeature([${SINGULAR_PASCAL}])],
  controllers: [${PASCAL}Controller],
  providers: [
    ${PASCAL}Service,
    ${PASCAL}RepositoryProvider,
    // Create${SINGULAR_PASCAL}UseCase,
  ],
  exports: [${PASCAL}Service, ${UPPER_SNAKE}_REPOSITORY],
})
export class ${PASCAL}Module {}
"

write_file "${TARGET_DIR}/${DOMAIN}.service.ts" \
    "Application service facade. Orchestrates use-cases and enforces domain rules." \
"import { Injectable } from '@nestjs/common';
// import { Create${SINGULAR_PASCAL}UseCase } from './use-cases/create-${SINGULAR}.usecase';
// import { Find${SINGULAR_PASCAL}UseCase } from './use-cases/find-${SINGULAR}.usecase';

@Injectable()
export class ${PASCAL}Service {
  constructor(
    // private readonly createUseCase: Create${SINGULAR_PASCAL}UseCase,
    // private readonly findUseCase: Find${SINGULAR_PASCAL}UseCase,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    // return this.findUseCase.execute(page, limit);
    return { data: [], total: 0 };
  }
}
"

# ----------------------------------------------------------------------------
# constants/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/constants/${DOMAIN}.constants.ts" \
    "Domain-wide constants: provider tokens, queue names, event names." \
"/**** Provider token for dependency injection (ORM-agnostic) ****/
export const ${UPPER_SNAKE}_REPOSITORY = '${UPPER_SNAKE}_REPOSITORY';
export const ${UPPER_SNAKE}_SERVICE = '${UPPER_SNAKE}_SERVICE';

/**** Queue names for async processing ****/
export const ${UPPER_SNAKE}_QUEUE = {
  NAME: '${DOMAIN}-queue',
  PROCESSORS: {
    PROCESS: 'process-${DOMAIN}',
  }
};

/**** Domain events emitted by this module ****/
export const ${UPPER_SNAKE}_EVENTS = {
  CREATED: '${DOMAIN}.created',
  UPDATED: '${DOMAIN}.updated',
  DELETED: '${DOMAIN}.deleted',
} as const;
"

# ----------------------------------------------------------------------------
# dto/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/dto/create-${SINGULAR}.dto.ts" \
    "DTO for creating a new ${SINGULAR} entity. Validated via class-validator." \
"import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create${SINGULAR_PASCAL}Dto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
"

write_file "${TARGET_DIR}/dto/update-${SINGULAR}.dto.ts" \
    "DTO for updating an existing ${SINGULAR} entity. All fields optional." \
"import { PartialType } from '@nestjs/swagger';
import { Create${SINGULAR_PASCAL}Dto } from './create-${SINGULAR}.dto';

export class Update${SINGULAR_PASCAL}Dto extends PartialType(Create${SINGULAR_PASCAL}Dto) {}
"

write_file "${TARGET_DIR}/dto/${DOMAIN}-response.dto.ts" \
    "DTO for ${DOMAIN} API responses. Shapes the data returned to clients." \
"import { ApiProperty } from '@nestjs/swagger';

export class ${SINGULAR_PASCAL}ResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;
}
"

write_file "${TARGET_DIR}/dto/${DOMAIN}-query.dto.ts" \
    "DTO for query parameters (pagination, filters, sorting)." \
"import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ${PASCAL}QueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
"

write_file "${TARGET_DIR}/dto/index.ts" \
    "Barrel export for all DTOs in the ${DOMAIN} module." \
"export * from './create-${SINGULAR}.dto';
export * from './update-${SINGULAR}.dto';
export * from './${DOMAIN}-response.dto';
export * from './${DOMAIN}-query.dto';
"

# ----------------------------------------------------------------------------
# entities/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/entities/${SINGULAR}.entity.ts" \
    "TypeORM Entity definition. (Prisma uses schema.prisma, this is for TypeORM adapter)." \
"import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('${DOMAIN}', { schema: 'public' }) // Adjust schema as needed
export class ${SINGULAR_PASCAL} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
"

write_file "${TARGET_DIR}/entities/index.ts" \
    "Barrel export for entities." \
"export * from './${SINGULAR}.entity';
"

# ----------------------------------------------------------------------------
# enums/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/enums/${SINGULAR}-status.enum.ts" \
    "Status enum for ${SINGULAR} lifecycle states." \
"export enum ${SINGULAR_PASCAL}Status {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
"

# ----------------------------------------------------------------------------
# events/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/events/${DOMAIN}.events.ts" \
    "Event payload classes emitted by the ${DOMAIN} module." \
"export class ${SINGULAR_PASCAL}CreatedEvent {
  constructor(public readonly ${SINGULAR}Id: string, public readonly data: any) {}
}

export class ${SINGULAR_PASCAL}UpdatedEvent {
  constructor(public readonly ${SINGULAR}Id: string, public readonly data: any) {}
}
"

write_file "${TARGET_DIR}/events/index.ts" \
    "Barrel export for events." \
"export * from './${DOMAIN}.events';
"

# ----------------------------------------------------------------------------
# guards/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/guards/${SINGULAR}-owner.guard.ts" \
    "Guard that verifies the current user owns or has access to the ${SINGULAR}." \
"import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ${SINGULAR_PASCAL}OwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // TODO: Implement actual ownership check against request.params.id
    if (!user) throw new ForbiddenException('User not authenticated');
    
    return true; 
  }
}
"

# ----------------------------------------------------------------------------
# interfaces/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/interfaces/${SINGULAR}-repository.interface.ts" \
    "Repository contract. Both Prisma and TypeORM implementations must satisfy this." \
"import { Create${SINGULAR_PASCAL}Dto, Update${SINGULAR_PASCAL}Dto, ${PASCAL}QueryDto } from '../dto';
import { ${SINGULAR_PASCAL} } from '../entities/${SINGULAR}.entity';

export interface I${SINGULAR_PASCAL}Repository {
  create(dto: Create${SINGULAR_PASCAL}Dto): Promise<${SINGULAR_PASCAL}>;
  findById(id: string): Promise<${SINGULAR_PASCAL} | null>;
  findAll(query: ${PASCAL}QueryDto): Promise<{ data: ${SINGULAR_PASCAL}[]; total: number }>;
  update(id: string, dto: Update${SINGULAR_PASCAL}Dto): Promise<${SINGULAR_PASCAL}>;
  softDelete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
"

# ----------------------------------------------------------------------------
# listeners/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/listeners/${DOMAIN}.listener.ts" \
    "Event listener. Reacts to domain events (internal or cross-module)." \
"import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ${SINGULAR_PASCAL}CreatedEvent } from '../events';

@Injectable()
export class ${PASCAL}Listener {
  private readonly logger = new Logger(${PASCAL}Listener.name);

  @OnEvent('${DOMAIN}.created')
  handle${SINGULAR_PASCAL}Created(event: ${SINGULAR_PASCAL}CreatedEvent) {
    this.logger.log(\`Handling ${DOMAIN}.created event for ID: \${event.${SINGULAR}Id}\`);
    // TODO: Trigger side effects (e.g., notifications, audit logs)
  }
}
"

# ----------------------------------------------------------------------------
# mappers/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/mappers/${SINGULAR}.mapper.ts" \
    "Maps between entities, DTOs, and external representations." \
"import { ${SINGULAR_PASCAL} } from '../entities/${SINGULAR}.entity';
import { ${SINGULAR_PASCAL}ResponseDto } from '../dto';

export class ${SINGULAR_PASCAL}Mapper {
  static toResponse(entity: ${SINGULAR_PASCAL}): ${SINGULAR_PASCAL}ResponseDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
    };
  }
}
"

# ----------------------------------------------------------------------------
# repositories/ (Factory + Implementations)
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/repositories/${DOMAIN}.repository.ts" \
    "Factory provider. Selects Prisma or TypeORM implementation based on ORM_TYPE env." \
"import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ${UPPER_SNAKE}_REPOSITORY } from '../constants/${DOMAIN}.constants';
import { Prisma${SINGULAR_PASCAL}Repository } from './prisma/prisma-${SINGULAR}.repository';
import { TypeOrm${SINGULAR_PASCAL}Repository } from './typeorm/typeorm-${SINGULAR}.repository';

export const ${SINGULAR_PASCAL}RepositoryProvider: Provider = {
  provide: ${UPPER_SNAKE}_REPOSITORY,
  useFactory: (config: ConfigService) => {
    const orm = config.get<string>('ORM_TYPE', 'prisma');

    switch (orm) {
      case 'prisma':
        return new Prisma${SINGULAR_PASCAL}Repository();
      case 'typeorm':
        return new TypeOrm${SINGULAR_PASCAL}Repository();
      default:
        throw new Error(\`Unsupported ORM: \${orm}\`);
    }
  },
  inject: [ConfigService],
};
"

write_file "${TARGET_DIR}/repositories/prisma/prisma-${SINGULAR}.repository.ts" \
    "Prisma implementation of the ${SINGULAR} repository." \
"import { I${SINGULAR_PASCAL}Repository } from '../../interfaces/${SINGULAR}-repository.interface';
import { ${SINGULAR_PASCAL} } from '../../entities/${SINGULAR}.entity';
import { Create${SINGULAR_PASCAL}Dto, Update${SINGULAR_PASCAL}Dto, ${PASCAL}QueryDto } from '../../dto';

export class Prisma${SINGULAR_PASCAL}Repository implements I${SINGULAR_PASCAL}Repository {
  // TODO: Inject PrismaService here
  
  async create(dto: Create${SINGULAR_PASCAL}Dto): Promise<${SINGULAR_PASCAL}> {
    throw new Error('Method not implemented.');
  }
  
  async findById(id: string): Promise<${SINGULAR_PASCAL} | null> {
    throw new Error('Method not implemented.');
  }
        
  async findAll(query: ${PASCAL}QueryDto): Promise<{ data: ${SINGULAR_PASCAL}[]; total: number }> {
    throw new Error('Method not implemented.');
  }
  
  async update(id: string, dto: Update${SINGULAR_PASCAL}Dto): Promise<${SINGULAR_PASCAL}> {
    throw new Error('Method not implemented.');
  }
  
  async softDelete(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  
  async exists(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
"

write_file "${TARGET_DIR}/repositories/typeorm/typeorm-${SINGULAR}.repository.ts" \
    "TypeORM implementation of the ${SINGULAR} repository." \
"import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { I${SINGULAR_PASCAL}Repository } from '../../interfaces/${SINGULAR}-repository.interface';
import { ${SINGULAR_PASCAL} } from '../../entities/${SINGULAR}.entity';
import { Create${SINGULAR_PASCAL}Dto, Update${SINGULAR_PASCAL}Dto, ${PASCAL}QueryDto } from '../../dto';

@Injectable()
export class TypeOrm${SINGULAR_PASCAL}Repository implements I${SINGULAR_PASCAL}Repository {
  constructor(
    @InjectRepository(${SINGULAR_PASCAL})
    private readonly repo: Repository<${SINGULAR_PASCAL}>,
  ) {}

  async create(dto: Create${SINGULAR_PASCAL}Dto): Promise<${SINGULAR_PASCAL}> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<${SINGULAR_PASCAL} | null> {
    return this.repo.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async findAll(query: ${PASCAL}QueryDto): Promise<{ data: ${SINGULAR_PASCAL}[]; total: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { deletedAt: IsNull() },
      skip: ((query.page || 1) - 1) * (query.limit || 10),
      take: query.limit || 10,
    });
    return { data, total };
  }

  async update(id: string, dto: Update${SINGULAR_PASCAL}Dto): Promise<${SINGULAR_PASCAL}> {
    await this.repo.update(id, dto);
    return this.findById(id) as Promise<${SINGULAR_PASCAL}>;
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.repo.exists({ where: { id, deletedAt: IsNull() } });
  }
}
"

# ----------------------------------------------------------------------------
# use-cases/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/use-cases/create-${SINGULAR}.usecase.ts" \
    "Use-case for creating a ${SINGULAR}. Contains business logic." \
"import { Injectable, Inject } from '@nestjs/common';
import { ${UPPER_SNAKE}_REPOSITORY } from '../constants/${DOMAIN}.constants';
import type { I${SINGULAR_PASCAL}Repository } from '../interfaces/${SINGULAR}-repository.interface';
import { Create${SINGULAR_PASCAL}Dto } from '../dto';

@Injectable()
export class Create${SINGULAR_PASCAL}UseCase {
  constructor(
    @Inject(${UPPER_SNAKE}_REPOSITORY) 
    private readonly repository: I${SINGULAR_PASCAL}Repository
  ) {}

  async execute(dto: Create${SINGULAR_PASCAL}Dto) {
    // TODO: Add business validation rules here before calling repository
    return this.repository.create(dto);
  }
}
"

write_file "${TARGET_DIR}/use-cases/find-${SINGULAR}.usecase.ts" \
    "Use-case for retrieving ${SINGULAR} records." \
"import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ${UPPER_SNAKE}_REPOSITORY } from '../constants/${DOMAIN}.constants';
import type { I${SINGULAR_PASCAL}Repository } from '../interfaces/${SINGULAR}-repository.interface';

@Injectable()
export class Find${SINGULAR_PASCAL}UseCase {
  constructor(
    @Inject(${UPPER_SNAKE}_REPOSITORY) 
    private readonly repository: I${SINGULAR_PASCAL}Repository
  ) {}

  async byId(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(\`${SINGULAR_PASCAL} with ID \${id} not found\`);
    }
    return entity;
  }
}
"

write_file "${TARGET_DIR}/use-cases/index.ts" \
    "Barrel export for use-cases." \
"export * from './create-${SINGULAR}.usecase';
export * from './find-${SINGULAR}.usecase';
"

# ----------------------------------------------------------------------------
# adapters/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/adapters/${SINGULAR}.adapter.ts" \
    "External service adapter (e.g., Daraja, AWS, Stripe). Implements a strict interface." \
"import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface I${SINGULAR_PASCAL}Adapter {
  // Define adapter contract methods here
  connect(): Promise<void>;
}

@Injectable()
export class ${SINGULAR_PASCAL}Adapter implements I${SINGULAR_PASCAL}Adapter {
  private readonly logger = new Logger(${SINGULAR_PASCAL}Adapter.name);

  constructor(private readonly configService: ConfigService) {}

  async connect(): Promise<void> {
    this.logger.log('Connecting to external service...');
    // TODO: Implement external API connection logic
  }
}
"

# ----------------------------------------------------------------------------
# handlers/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/handlers/${SINGULAR}-webhook.handler.ts" \
    "Handles incoming webhooks for this domain." \
"import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ${SINGULAR_PASCAL}WebhookHandler {
  private readonly logger = new Logger(${SINGULAR_PASCAL}WebhookHandler.name);

  async handle(payload: any): Promise<void> {
    this.logger.log('Processing webhook payload', payload);
    // TODO: Implement webhook processing logic
  }
}
"

# ----------------------------------------------------------------------------
# processors/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/processors/${DOMAIN}.processor.ts" \
    "Background job processor (e.g., BullMQ) for this domain." \
"import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { ${UPPER_SNAKE}_QUEUE } from '../constants/${DOMAIN}.constants';

@Processor(${UPPER_SNAKE}_QUEUE.NAME)
export class ${PASCAL}Processor {
  private readonly logger = new Logger(${PASCAL}Processor.name);

  @Process(${UPPER_SNAKE}_QUEUE.PROCESSORS.PROCESS)
  async processJob(job: Job<any>) {
    this.logger.log(\`Processing job \${job.id} of type \${job.name}\`);
    // TODO: Implement background processing logic
  }
}
"

# ----------------------------------------------------------------------------
# queues/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/queues/${DOMAIN}.queue.ts" \
    "Queue management and buffering logic." \
"import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ${UPPER_SNAKE}_QUEUE } from '../constants/${DOMAIN}.constants';

@Injectable()
export class ${PASCAL}QueueManager implements OnModuleInit, OnModuleDestroy {
  private flushTimer: NodeJS.Timeout | null = null;
  private buffer: any[] = [];
  private isFlushing = false;

  constructor(
    @InjectQueue(${UPPER_SNAKE}_QUEUE.NAME) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    this.flushTimer = setInterval(() => this.flushBuffer(), 3000);
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flushBuffer();
  }

  async add(item: any): Promise<void> {
    this.buffer.push(item);
    if (this.buffer.length >= 50) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    try {
      const itemsToFlush = [...this.buffer];
      this.buffer = [];
      await this.queue.add('batch.process', { items: itemsToFlush });
    } catch (error) {
      this.buffer = [...this.buffer, ...this.buffer]; // Retry on failure
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }
}
"

# ----------------------------------------------------------------------------
# validators/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/validators/${SINGULAR}.validator.ts" \
    "Custom validation logic (e.g., signature verification, IP whitelisting)." \
"import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ${SINGULAR_PASCAL}Validator {
  private readonly logger = new Logger(${SINGULAR_PASCAL}Validator.name);
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('VALIDATION_SECRET_KEY') || '';
  }

  async verifySignature(payload: string, signature: string): Promise<boolean> {
    if (!signature) return false;
    
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(payload);
      verifier.end();
      return verifier.verify(this.secretKey, signature, 'base64');
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }
}
"

# ----------------------------------------------------------------------------
# interceptors/ (FIXED: Escaped ${PASCAL.toUpperCase()} to prevent bash substitution error)
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/interceptors/${DOMAIN}.interceptor.ts" \
    "Custom interceptor for logging, transformation, or metrics." \
"import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class ${PASCAL}LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        console.log(\`[\${PASCAL.toUpperCase()}] \${request.method} \${request.url} - \${response.statusCode} - \${responseTime}ms\`);
      }),
    );
  }
}
"

# ----------------------------------------------------------------------------
# value-objects/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/value-objects/${SINGULAR}.vo.ts" \
    "Value objects for ${DOMAIN} domain invariants (immutable, self-validating)." \
"export class ${SINGULAR_PASCAL}ValueObject {
  constructor(public readonly value: string) {
    // TODO: Add validation logic in constructor
    if (!value) throw new Error('Value is required');
  }

  // TODO: Add domain-specific methods
  equals(other: ${SINGULAR_PASCAL}ValueObject): boolean {
    return this.value === other.value;
  }
}
"

# ----------------------------------------------------------------------------
# __tests__/
# ----------------------------------------------------------------------------
write_file "${TARGET_DIR}/__tests__/${DOMAIN}.controller.spec.ts" \
    "Unit tests for ${PASCAL}Controller." \
"import { Test, TestingModule } from '@nestjs/testing';
import { ${PASCAL}Controller } from '../${DOMAIN}.controller';
import { ${PASCAL}Service } from '../${DOMAIN}.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
};

describe('${PASCAL}Controller', () => {
  let controller: ${PASCAL}Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [${PASCAL}Controller],
      providers: [{ provide: ${PASCAL}Service, useValue: mockService }],
    }).compile();

    controller = module.get<${PASCAL}Controller>(${PASCAL}Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await controller.findAll(1, 10);
      expect(result).toEqual({ data: [], total: 0 });
      expect(mockService.findAll).toHaveBeenCalledWith(1, 10);
    });
  });
});
"

write_file "${TARGET_DIR}/__tests__/${DOMAIN}.service.spec.ts" \
    "Unit tests for ${PASCAL}Service." \
"import { Test, TestingModule } from '@nestjs/testing';
import { ${PASCAL}Service } from '../${DOMAIN}.service';

describe('${PASCAL}Service', () => {
  let service: ${PASCAL}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [${PASCAL}Service],
    }).compile();

    service = module.get<${PASCAL}Service>(${PASCAL}Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
"

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
echo ""
echo "[**] Module '${DOMAIN}' scaffolded successfully at ${TARGET_DIR}"
echo ""
echo "[**] Next steps:"
echo "   1. Open ${TARGET_DIR}/${DOMAIN}.module.ts and register your providers/use-cases"
echo "   2. Implement repository methods in repositories/prisma/ and repositories/typeorm/"
echo "   3. Add the module to src/app.module.ts imports"
echo "   4. Run your tests: npm run test ${DOMAIN}"
echo ""