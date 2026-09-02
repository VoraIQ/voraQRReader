'use client';

import { useEffect, useRef, useState } from 'react';
import QrPreview from './QrPreview';
import { PENDING_LOGO_KEY } from './CreateLinkCard';
import type { QrLogoSize, QrStyleConfig } from '@/lib/qrStyles';

interface PendingLogo {
  image: string;
  imageSize: QrLogoSize;
}

function isQrLogoSize(value: unknown): value is QrLogoSize {
  return value === 0.24 || value === 0.32 || value === 0.4;
}

/** Reads (and immediately clears) the create form's one-shot logo handoff — see PENDING_LOGO_KEY. */
function takePendingLogo(): PendingLogo | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_LOGO_KEY);
    window.sessionStorage.removeItem(PENDING_LOGO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.image !== 'string' || !isQrLogoSize(parsed.imageSize)) return null;
    return { image: parsed.image, imageSize: parsed.imageSize };
  } catch {
    return null;
  }
}

/**
 * Shown once, right after a code is created, when that creation used a
 * logo. The logo itself was never sent to the server — it only exists in
 * this tab's sessionStorage — so this is the one and only chance to get a
 * downloaded file with it embedded before it's gone for good.
 */
export default function CreatedLinkLogoDownload({
  redirectUrl,
  style,
}: {
  redirectUrl: string;
  style: QrStyleConfig | null;
}) {
  const [logo, setLogo] = useState<PendingLogo | null>(null);
  // Guards against Strict Mode's dev-only double-invoke of this effect: the
  // first run consumes (and clears) the sessionStorage entry correctly, and
  // without this ref, the second simulated run would find nothing left and
  // overwrite the already-set state back to null.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;
    setLogo(takePendingLogo());
  }, []);

  if (!logo) return null;

  return (
    <div className="success-banner-logo">
      <QrPreview url={redirectUrl} style={style} logo={logo} size={64} showDownload downloadName="qr-code-with-logo" />
      <span className="caption success-banner-logo-note">
        Your logo isn&rsquo;t saved with the code &mdash; this is the only chance to download it embedded. Grab it now.
      </span>
    </div>
  );
}
