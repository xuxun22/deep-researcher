import { NextRequest } from 'next/server';
import { config } from '@/lib/config/env';

export async function GET() {
  return Response.json({ models: config.models });
}
