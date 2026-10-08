import { randomUUID } from 'crypto';
import { after, NextRequest, NextResponse } from 'next/server';
import { findLinkByCode, logScan } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const clickId = randomUUID();

  let link;
  try {
    link = await findLinkByCode(code);
  } catch (error) {
    console.error('Failed to look up QR code', error);
    return new NextResponse('Something went wrong', { status: 500 });
  }

  if (!link) {
    return new NextResponse('Unknown QR code', { status: 404 });
  }

  // A malformed stored URL (only reachable via data that predates
  // createLinkAction's own validation, or a direct DB edit) must fail
  // gracefully here rather than throw uncaught.
  let destination: URL;
  try {
    destination = new URL(link.destinationUrl);
  } catch (error) {
    console.error('Stored destination URL is malformed', { code, destinationUrl: link.destinationUrl, error });
    return new NextResponse('This code is misconfigured.', { status: 500 });
  }

  // Write the scan log after the response is sent, so the visitor only
  // waits on the lookup above. A failed write loses that one scan from
  // analytics but never blocks the visitor from reaching the destination.
  const scan = {
    linkId: link.id,
    clickId,
    userAgent: request.headers.get('user-agent') ?? '',
    referrer: request.headers.get('referer') ?? '',
    // Set automatically by Vercel on deployed traffic; empty in local dev.
    country: request.headers.get('x-vercel-ip-country') ?? '',
  };
  after(async () => {
    try {
      await logScan(scan);
    } catch (error) {
      console.error('Failed to record scan', { code, clickId, error });
    }
  });

  // Hand the visitor a claim ticket: the destination site's tracking
  // snippet reads this and reports any later action back against it.
  destination.searchParams.set('qr_cid', clickId);

  return NextResponse.redirect(destination.toString(), { status: 302 });
}
