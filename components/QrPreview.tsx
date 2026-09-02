'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCodeStyling, { type Gradient, type Options } from 'qr-code-styling';
import { DEFAULT_STYLE, type QrGradient, type QrLogoSize, type QrStyleConfig } from '@/lib/qrStyles';

// Downloads are generated at a dedicated resolution regardless of the
// on-screen preview size (52-188px), adjustable via the quality slider.
// The top end covers large-format raster printing (posters, t-shirt
// transfers) at a real print DPI — PNG is still a fixed raster no matter
// how large, though, so for anything bigger (banners, billboards) the SVG
// download is the right choice: it's vector, so it scales losslessly to
// any size regardless of where the slider sits.
const MIN_DOWNLOAD_SIZE = 200;
const MAX_DOWNLOAD_SIZE = 4000;
const DOWNLOAD_SIZE_STEP = 100;
const DEFAULT_DOWNLOAD_SIZE = MAX_DOWNLOAD_SIZE;

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

function toLibraryGradient(gradient: QrGradient): Gradient {
  return {
    type: gradient.type,
    rotation: gradient.rotation,
    colorStops: [
      { offset: 0, color: gradient.colorStops[0] },
      { offset: 1, color: gradient.colorStops[1] },
    ],
  };
}

/** Cheap non-cryptographic string hash — just needs to distinguish different logo images, not resist collisions. */
function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

interface ColorFill {
  color: string;
  gradient?: QrGradient;
}

/** An explicit gradient/color wins outright; otherwise falls back to the given fallback gradient/color — this is how eye frame/ball inherit the foreground's gradient, not just its solid color, when left uncustomized. */
function resolveColorFill(
  color: string | undefined,
  gradient: QrGradient | undefined,
  fallbackColor: string,
  fallbackGradient: QrGradient | undefined
): ColorFill {
  if (gradient) return { color: gradient.colorStops[0], gradient };
  if (color) return { color };
  if (fallbackGradient) return { color: fallbackGradient.colorStops[0], gradient: fallbackGradient };
  return { color: fallbackColor };
}

// `color`/`gradient` are always both present below (one real, one undefined
// — see the `image`/`imageOptions` note further down): the library's solid
// color and gradient are mutually exclusive, and `.update()`'s merge only
// clears a previously-set one when the key is explicitly present.
function toDrawOptions(fill: ColorFill): { color: string | undefined; gradient: Gradient | undefined } {
  return fill.gradient ? { color: undefined, gradient: toLibraryGradient(fill.gradient) } : { color: fill.color, gradient: undefined };
}

function buildOptions(url: string, style: QrStyleConfig, size: number, logo: QrLogoOptions | null | undefined): Partial<Options> {
  const fgFill = resolveColorFill(style.fgColor, style.fgGradient, style.fgColor, undefined);
  const eyeFrameFill = resolveColorFill(style.eyeFrameColor, style.eyeFrameGradient, style.fgColor, style.fgGradient);
  const eyeBallFill = resolveColorFill(style.eyeBallColor, style.eyeBallGradient, style.fgColor, style.fgGradient);
  return {
    type: 'svg',
    width: size,
    height: size,
    data: url,
    margin: Math.max(2, Math.round(size * 0.04)),
    qrOptions: { errorCorrectionLevel: logo ? 'H' : 'M' },
    dotsOptions: { type: style.dotsType, ...toDrawOptions(fgFill) },
    cornersSquareOptions: { type: style.cornersSquareType, ...toDrawOptions(eyeFrameFill) },
    cornersDotOptions: { type: style.cornersDotType, ...toDrawOptions(eyeBallFill) },
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

/** Builds a dedicated instance for downloads at the chosen quality — never the on-screen preview instance, which may be tiny (a 52px preset thumbnail). */
function downloadAt(
  url: string,
  style: QrStyleConfig,
  logo: QrLogoOptions | null | undefined,
  downloadSize: number,
  name: string,
  extension: 'png' | 'svg'
) {
  const instance = new QRCodeStyling(buildOptions(url, style, downloadSize, logo));
  instance.download({ name, extension });
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
  // Hashed (not just `.length`) so two different logos that happen to encode
  // to the same string length are still treated as distinct — memoized on
  // the image's own reference so it isn't rehashed on every unrelated
  // re-render (a data URL can be hundreds of KB).
  const logoImage = logo?.image;
  const logoHash = useMemo(() => (logoImage ? hashString(logoImage) : ''), [logoImage]);
  const optionsKey = JSON.stringify(resolvedStyle) + (logo ? `|${logo.imageSize}|${logoHash}` : '');
  const [downloadSize, setDownloadSize] = useState(DEFAULT_DOWNLOAD_SIZE);
  const qualityPercent = ((downloadSize - MIN_DOWNLOAD_SIZE) / (MAX_DOWNLOAD_SIZE - MIN_DOWNLOAD_SIZE)) * 100;

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
        <>
          <div className="qr-quality">
            <span className="qr-quality-value">
              {downloadSize} × {downloadSize} px
            </span>
            <input
              type="range"
              min={MIN_DOWNLOAD_SIZE}
              max={MAX_DOWNLOAD_SIZE}
              step={DOWNLOAD_SIZE_STEP}
              value={downloadSize}
              onChange={(e) => setDownloadSize(Number(e.target.value))}
              className="qr-quality-slider"
              style={{ background: `linear-gradient(to right, var(--color-brand-primary) ${qualityPercent}%, var(--color-separator-opaque) ${qualityPercent}%)` }}
              aria-label="Download quality"
            />
            <div className="qr-quality-labels">
              <span>Low quality</span>
              <span>High quality</span>
            </div>
          </div>
          <div className="qr-download-row">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => downloadAt(url, resolvedStyle, logo, downloadSize, downloadName, 'png')}
            >
              PNG
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => downloadAt(url, resolvedStyle, logo, downloadSize, downloadName, 'svg')}
            >
              SVG
            </button>
          </div>
        </>
      )}
    </div>
  );
}
