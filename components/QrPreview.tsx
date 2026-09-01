'use client';

import { useEffect, useRef } from 'react';
import QRCodeStyling, { type Options } from 'qr-code-styling';
import { DEFAULT_STYLE, type QrLogoSize, type QrStyleConfig } from '@/lib/qrStyles';

interface QrLogoOptions {
  image: string;
  imageSize: QrLogoSize;
}

interface QrPreviewProps {
  /** The exact data the QR encodes — a redirect URL, or a placeholder while composing a new one. */
  url: string;
  /** Null renders the plain default look (pre-feature links, or "no style chosen yet"). */
  style: QrStyleConfig | null;
  /**
   * Fire-and-forget logo overlay — never part of `style`, never persisted.
   * Only the create form's own live preview ever passes this.
   */
  logo?: QrLogoOptions | null;
  size?: number;
  /** Base filename (no extension) used for the download buttons. */
  downloadName?: string;
  showDownload?: boolean;
  className?: string;
}

function buildOptions(url: string, style: QrStyleConfig, size: number, logo: QrLogoOptions | null | undefined): Partial<Options> {
  return {
    type: 'svg',
    width: size,
    height: size,
    data: url,
    margin: Math.max(2, Math.round(size * 0.04)),
    qrOptions: { errorCorrectionLevel: logo ? 'H' : 'M' },
    dotsOptions: { type: style.dotsType, color: style.fgColor },
    cornersSquareOptions: { type: style.cornersSquareType, color: style.fgColor },
    cornersDotOptions: { type: style.cornersDotType, color: style.fgColor },
    backgroundOptions: { color: style.bgColor },
    // `image` is always present (even as undefined): QRCodeStyling.update()
    // deep-merges by iterating the incoming object's own keys, so an omitted
    // key leaves the previous value in place — an explicit `undefined` is
    // what clears a previously-set logo. `imageOptions` must NOT be set to
    // undefined, though — the library reads properties off it unconditionally
    // internally even with no image, so it always needs to be a real object.
    image: logo ? logo.image : undefined,
    imageOptions: { crossOrigin: 'anonymous', hideBackgroundDots: true, imageSize: logo?.imageSize ?? 0.32, margin: Math.round(size * 0.02) },
  };
}

export default function QrPreview({
  url,
  style,
  logo,
  size = 132,
  downloadName = 'qr-code',
  showDownload = false,
  className,
}: QrPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const resolvedStyle = style ?? DEFAULT_STYLE;
  const optionsKey = JSON.stringify(resolvedStyle) + (logo ? `|${logo.imageSize}|${logo.image.length}` : '');

  useEffect(() => {
    const options = buildOptions(url, resolvedStyle, size, logo);

    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options);
      if (containerRef.current) {
        qrRef.current.append(containerRef.current);
      }
    } else {
      qrRef.current.update(options);
    }
    // resolvedStyle/logo are derived fresh each render; optionsKey is their stable identity for the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, optionsKey, size]);

  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: size, height: size }} role="img" aria-label={`QR code for ${url}`} />
      {showDownload && (
        <div className="qr-download-row">
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => qrRef.current?.download({ name: downloadName, extension: 'png' })}
          >
            PNG
          </button>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => qrRef.current?.download({ name: downloadName, extension: 'svg' })}
          >
            SVG
          </button>
        </div>
      )}
    </div>
  );
}
