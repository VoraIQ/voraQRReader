import { NextRequest, NextResponse } from 'next/server';
import { recordAction } from '@/lib/db';

// Called cross-origin from whatever site the QR code sends people to,
// so this needs permissive CORS - it's a write-only, low-stakes endpoint.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.clickId || !body?.actionType) {
    return NextResponse.json(
      { error: 'clickId and actionType are required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const success = await recordAction(body.clickId, body.actionType, body.metadata);
    return NextResponse.json({ success }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Failed to record action', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
