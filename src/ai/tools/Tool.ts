/**
 * Mintu Tool System Types & Interface
 */

export type ToolRisk = 'low' | 'open' | 'modify';

export interface ToolParamProperty {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolParamProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  risk: ToolRisk;
  parameters: ToolSchema;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  summary: string;
  error?: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, any>): Promise<ToolExecutionResult>;
}

export interface PendingToolApproval {
  id: string;
  toolName: string;
  risk: ToolRisk;
  params: Record<string, any>;
  paramsSummary: string;
  token: string;
  resolve: (decision: 'allow_once' | 'always_allow' | 'deny') => void;
}

export interface ToolAuditRecord {
  id: number;
  timestamp: number;
  tool_name: string;
  params_summary: string;
  status: 'executed' | 'denied' | 'failed';
  error?: string;
}

export interface ReminderRecord {
  id: number;
  text: string;
  due_time: number;
  status: 'pending' | 'triggered' | 'dismissed';
  created_at: number;
}
