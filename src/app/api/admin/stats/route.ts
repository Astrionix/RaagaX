import { NextResponse } from 'next/server';

const GITHUB_REPO  = 'Astrionix/RaagaX';
// Token is server-only — never sent to browser
const GITHUB_TOKEN = process.env.GITHUB_ADMIN_TOKEN ?? '';

export async function GET() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const base = `https://api.github.com/repos/${GITHUB_REPO}`;

  const [releasesRes, runsRes, viewsRes, clonesRes] = await Promise.allSettled([
    fetch(`${base}/releases?per_page=10`, { headers, next: { revalidate: 60 } }),
    fetch(`${base}/actions/runs?per_page=6`, { headers, next: { revalidate: 30 } }),
    fetch(`${base}/traffic/views`, { headers, next: { revalidate: 300 } }),
    fetch(`${base}/traffic/clones`, { headers, next: { revalidate: 300 } }),
  ]);

  const releases = releasesRes.status === 'fulfilled' && releasesRes.value.ok
    ? await releasesRes.value.json() : [];
  const workflowRuns = runsRes.status === 'fulfilled' && runsRes.value.ok
    ? (await runsRes.value.json()).workflow_runs ?? [] : [];
  const views = viewsRes.status === 'fulfilled' && viewsRes.value.ok
    ? await viewsRes.value.json() : { count: 0, uniques: 0 };
  const clones = clonesRes.status === 'fulfilled' && clonesRes.value.ok
    ? await clonesRes.value.json() : { count: 0, uniques: 0 };

  return NextResponse.json(
    { releases, workflowRuns, views, clones },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
