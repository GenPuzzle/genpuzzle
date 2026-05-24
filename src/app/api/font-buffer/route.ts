import { NextRequest, NextResponse } from 'next/server';
import { getFontBuffer } from '@/lib/font-loader';

export async function GET(request: NextRequest) {
  const family = request.nextUrl.searchParams.get('family');
  const bold = request.nextUrl.searchParams.get('bold') === 'true';

  if (!family) {
    return NextResponse.json({ error: 'Missing family parameter' }, { status: 400 });
  }

  const buffer = await getFontBuffer(family, bold);
  if (!buffer) {
    return NextResponse.json({ error: 'Font not found' }, { status: 404 });
  }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'font/ttf',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
