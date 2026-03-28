import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

export interface AuditLogJobData {
  user_id?: number;
  action: string;
  ip_address?: string;
  request_method?: string;
  endpoint?: string;
  user_agent?: string;
  payload?: Record<string, unknown>;
  response_status?: number;
  timestamp: number;
}

export interface AuditBatchJobData {
  logs: AuditLogJobData[];
  batchSize: number;
}
