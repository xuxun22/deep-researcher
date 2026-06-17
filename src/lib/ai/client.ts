import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config/env';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  const baseUrl = config.anthropic.baseUrl();

  client = new Anthropic({
    apiKey: config.anthropic.apiKey(),
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  return client;
}
