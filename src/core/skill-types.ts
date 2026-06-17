import type { z } from 'zod';
import type { SandboxContext } from '@/lib/sandbox/manager';
import type { TavilyClient } from '@/lib/search/tavily-client';
import type { DomainRule } from '@/lib/authority/domain-rules';

export interface SkillMeta {
  name: string;
  description: string;
  license?: string;
  body: string;
  skillDir: string;
  hasReference: boolean;
  hasScripts: boolean;
  hasAgents: boolean;
}

export interface SkillEvent {
  type: string;
  data: unknown;
}

export interface SkillContext {
  sandbox: SandboxContext;
  model: string;
  tavilyClient: TavilyClient;
  domainRules: DomainRule[];
  signal: AbortSignal;
  sessionId?: string;
  userId?: string;
}

export interface SkillInput {
  [key: string]: unknown;
}

export interface SkillOutput {
  [key: string]: unknown;
}

export interface SkillDefinition {
  meta: SkillMeta;
  execute(input: SkillInput, ctx: SkillContext): AsyncIterable<SkillEvent>;
}

export interface PipelineDefinition {
  name: string;
  description: string;
  skills: string[];
}
