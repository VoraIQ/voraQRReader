// Shared QR style types, curated presets, and validation. Kept separate from
// `qr-code-styling`'s own (much larger) option surface so the app only ever
// deals with the handful of fields it actually exposes to users.

export type QrShapeType = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type QrCornerType = QrShapeType | 'dot';

export interface QrStyleConfig {
  dotsType: QrShapeType;
  cornersSquareType: QrCornerType;
  cornersDotType: QrCornerType;
  fgColor: string;
  bgColor: string;
}

export interface QrPreset {
  id: string;
  name: string;
  dotsType: QrShapeType;
  cornersSquareType: QrCornerType;
  cornersDotType: QrCornerType;
}

// Curated combinations that read as coherent shapes together, not raw
// independent dropdowns. `qr-code-styling` (v1.9.2) actually accepts the
// full 6-value shape set for both corner options, but the wider matrix
// mostly produces mismatched-looking codes, so the MVP sticks to these four.
export const QR_PRESETS: QrPreset[] = [
  { id: 'classic', name: 'Classic', dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'square' },
  { id: 'rounded', name: 'Rounded', dotsType: 'rounded', cornersSquareType: 'extra-rounded', cornersDotType: 'dot' },
  { id: 'dots', name: 'Dots', dotsType: 'dots', cornersSquareType: 'dot', cornersDotType: 'dot' },
  { id: 'classy', name: 'Classy', dotsType: 'classy', cornersSquareType: 'square', cornersDotType: 'square' },
];

// Pure black/white by default: this is the one place the app should NOT
// reach for an off-black brand tint, since it's the actual scanned data
// and pure black/white maximizes contrast for scanners.
export const DEFAULT_FG_COLOR = '#000000';
export const DEFAULT_BG_COLOR = '#ffffff';

export const DEFAULT_STYLE: QrStyleConfig = {
  dotsType: QR_PRESETS[0].dotsType,
  cornersSquareType: QR_PRESETS[0].cornersSquareType,
  cornersDotType: QR_PRESETS[0].cornersDotType,
  fgColor: DEFAULT_FG_COLOR,
  bgColor: DEFAULT_BG_COLOR,
};

/** Finds the preset matching a style's shapes, defaulting to the first preset. */
export function findPresetForStyle(style: QrStyleConfig | null): QrPreset {
  if (!style) return QR_PRESETS[0];
  return (
    QR_PRESETS.find(
      (p) =>
        p.dotsType === style.dotsType &&
        p.cornersSquareType === style.cornersSquareType &&
        p.cornersDotType === style.cornersDotType
    ) ?? QR_PRESETS[0]
  );
}

// Logo embedding is fire-and-forget: it lives only in the create form's
// client state (for the live preview + immediate download) and is never
// added to QrStyleConfig or persisted — so it never grows the `style` JSONB
// column and needs no server-side validation.
export type QrLogoSize = 0.24 | 0.32 | 0.4;
export const LOGO_SIZES: QrLogoSize[] = [0.24, 0.32, 0.4];
export const MAX_LOGO_BYTES = 512 * 1024;

const SHAPE_TYPES: ReadonlySet<string> = new Set<QrShapeType>([
  'square',
  'dots',
  'rounded',
  'classy',
  'classy-rounded',
  'extra-rounded',
]);
const CORNER_TYPES: ReadonlySet<string> = new Set<string>([...SHAPE_TYPES, 'dot']);
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Validates an arbitrary value (e.g. parsed from client-supplied form data)
 * against the known shape/color vocabulary before it's persisted. Returns
 * null rather than throwing, since an invalid style should just fall back
 * to the default look, not fail link creation.
 */
export function sanitizeQrStyle(input: unknown): QrStyleConfig | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  const dotsType = obj.dotsType;
  const cornersSquareType = obj.cornersSquareType;
  const cornersDotType = obj.cornersDotType;
  const fgColor = obj.fgColor;
  const bgColor = obj.bgColor;

  if (
    typeof dotsType !== 'string' ||
    !SHAPE_TYPES.has(dotsType) ||
    typeof cornersSquareType !== 'string' ||
    !CORNER_TYPES.has(cornersSquareType) ||
    typeof cornersDotType !== 'string' ||
    !CORNER_TYPES.has(cornersDotType) ||
    typeof fgColor !== 'string' ||
    !HEX_COLOR_RE.test(fgColor) ||
    typeof bgColor !== 'string' ||
    !HEX_COLOR_RE.test(bgColor)
  ) {
    return null;
  }

  return {
    dotsType: dotsType as QrShapeType,
    cornersSquareType: cornersSquareType as QrCornerType,
    cornersDotType: cornersDotType as QrCornerType,
    fgColor,
    bgColor,
  };
}
