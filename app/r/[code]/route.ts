import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { recordScan } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const clickId = randomUUID();

  let link;
  try {
    link = await recordScan({
      code,
      clickId,
      userAgent: request.headers.get('user-agent') ?? '',
      referrer: request.headers.get('referer') ?? '',
      // Set automatically by Vercel on deployed traffic; empty in local dev.
      country: request.headers.get('x-vercel-ip-country') ?? '',
    });
  } catch (error) {
    console.error('Failed to record scan', error);
    return new NextResponse('Something went wrong', { status: 500 });
  }

  if (!link) {
    return new NextResponse('Unknown QR code', { status: 404 });
  }

  // Hand the visitor a claim ticket: the destination site's tracking
  // snippet reads this and reports any later action back against it.
  const destination = new URL(link.destinationUrl);
  destination.searchParams.set('qr_cid', clickId);

  return NextResponse.redirect(destination.toString(), { status: 302 });
}
