import { apiApp } from '@/api-app';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return apiApp.fetch(req);
}

export async function POST(req: Request) {
  return apiApp.fetch(req);
}

export async function PUT(req: Request) {
  return apiApp.fetch(req);
}

export async function DELETE(req: Request) {
  return apiApp.fetch(req);
}

export async function OPTIONS(req: Request) {
  return apiApp.fetch(req);
}
