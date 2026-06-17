import { config } from '@/lib/config/env';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  raw_content?: string;
}

export interface TavilySearchResponse {
  query: string;
  follow_up_questions: string[] | null;
  answer: string | null;
  images: string[];
  results: TavilySearchResult[];
  response_time: number;
}

export interface TavilySearchParams {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  topic?: 'general' | 'news' | 'finance';
}

export class TavilyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? config.tavily.apiKey();
    this.baseUrl = config.tavily.baseUrl;
  }

  async search(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const body = {
      query: params.query,
      api_key: this.apiKey,
      search_depth: params.searchDepth ?? 'basic',
      max_results: params.maxResults ?? config.tavily.maxResults,
      include_answer: params.includeAnswer ?? true,
      include_raw_content: params.includeRawContent ?? false,
      include_domains: params.includeDomains,
      exclude_domains: params.excludeDomains,
      topic: params.topic ?? 'general',
    };

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily search failed (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<TavilySearchResponse>;
  }

  async extract(urls: string[]): Promise<{ results: Array<{ url: string; raw_content: string }> }> {
    const response = await fetch(`${this.baseUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        api_key: this.apiKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily extract failed (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<{ results: Array<{ url: string; raw_content: string }> }>;
  }
}

let defaultClient: TavilyClient | null = null;

export function getTavilyClient(): TavilyClient {
  if (!defaultClient) {
    defaultClient = new TavilyClient();
  }
  return defaultClient;
}
