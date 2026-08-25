import { NextRequest, NextResponse } from 'next/server';
import { HomeFeedGenerator } from '@/lib/home/HomeFeedGenerator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const sections = HomeFeedGenerator.getHomeSectionsForLanguage(lang);
    return NextResponse.json({
      success: true,
      cycleDays: 3,
      sections: sections.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type || 'carousel',
        status: 'ready',
        total: s.items?.length || 0,
        hasMore: false,
        items: s.items || []
      }))
    });
  } catch (err) {
    console.error('[BROWSE API] Error:', err);
    return NextResponse.json({ success: false, sections: [] }, { status: 500 });
  }
}
