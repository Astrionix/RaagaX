import { apiApp } from '@/api-app';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return apiApp.fetch(req);
}

export async function POST(req: Request) {
  return apiApp.fetch(req);
}
