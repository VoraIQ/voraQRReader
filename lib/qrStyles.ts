// Shared QR style types, curated presets, and validation. Kept separate from
// `qr-code-styling`'s own (much larger) option surface so the app only ever
// deals with the handful of fields it actually exposes to users.

export type QrShapeType = 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type QrCornerType = QrShapeType | 'dot';

export type QrGradientType = 'linear' | 'radial';

export interface QrGradient {
  type: QrGradientType;
  colorStops: [string, string];
  /** Degrees, linear gradients only. */
  rotation?: number;
}

export interface QrStyleConfig {
  dotsType: QrShapeType;
  cornersSquareType: QrCornerType;
  cornersDotType: QrCornerType;
  fgColor: string;
  bgColor: string;
  /** Linear/radial gradient for the body dots — takes precedence over fgColor when set. */
  fgGradient?: QrGradient;
  /** Eye frame color (the outer corner squares). Falls back to fgColor/fgGradient when unset. */
  eyeFrameColor?: string;
  /** Eye ball color (the inner corner dots). Falls back to fgColor/fgGradient when unset. */
  eyeBallColor?: string;
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
// (Independent per-part shape pickers are also available in the UI for
// anyone who wants to go beyond these.)
export const QR_PRESETS: QrPreset[] = [
  { id: 'classic', name: 'Classic', dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'square' },
  { id: 'rounded', name: 'Rounded', dotsType: 'rounded', cornersSquareType: 'extra-rounded', cornersDotType: 'dot' },
  { id: 'dots', name: 'Dots', dotsType: 'dots', cornersSquareType: 'dot', cornersDotType: 'dot' },
  { id: 'classy', name: 'Classy', dotsType: 'classy', cornersSquareType: 'square', cornersDotType: 'square' },
];

// All shape values the library actually supports for each field (confirmed
// against the installed package's type definitions), used for the
// independent shape pickers.
export const DOT_SHAPE_TYPES: QrShapeType[] = ['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'];
export const CORNER_SHAPE_TYPES: QrCornerType[] = [...DOT_SHAPE_TYPES, 'dot'];

export const SHAPE_LABELS: Record<QrCornerType, string> = {
  square: 'Square',
  dots: 'Dots',
  rounded: 'Rounded',
  classy: 'Classy',
  'classy-rounded': 'Classy rounded',
  'extra-rounded': 'Extra rounded',
  dot: 'Dot',
};

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

/** Finds the preset matching a style's shapes, defaulting to the first preset. Returns null if it doesn't match any curated preset (a custom per-part combination). */
export function findPresetForStyle(style: QrStyleConfig | null): QrPreset | null {
  if (!style) return QR_PRESETS[0];
  return (
    QR_PRESETS.find(
      (p) =>
        p.dotsType === style.dotsType &&
        p.cornersSquareType === style.cornersSquareType &&
        p.cornersDotType === style.cornersDotType
    ) ?? null
  );
}

// Logo embedding is fire-and-forget: it lives only in the create form's
// client state (for the live preview + immediate download) and is never
// added to QrStyleConfig or persisted — so it never grows the `style` JSONB
// column and needs no server-side validation.
export type QrLogoSize = 0.24 | 0.32 | 0.4;
export const LOGO_SIZES: QrLogoSize[] = [0.24, 0.32, 0.4];
export const MAX_LOGO_BYTES = 512 * 1024;

// Scan reliability is non-negotiable: a QR scanner needs a strong light/dark
// split between modules, so any color choice (curated swatch or custom pick)
// must clear a minimum contrast ratio against the current background before
// it's applied. Calibrated, not guessed: the lightest existing preset pairing
// (Vora blue foreground on white/pale-blue/brand-tint backgrounds) sits at a
// WCAG contrast ratio of ~3.1, so 2.5 gives it headroom without opening the
// door to genuinely low-contrast combinations (e.g. a pale custom color on a
// light background lands well under 2).
export const MIN_CONTRAST_RATIO = 2.5;

function srgbChannelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hexColor: string): number {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

/** WCAG-style contrast ratio between two `#rrggbb` colors, from 1 (identical) to 21 (black/white). */
export function contrastRatio(hexColorA: string, hexColorB: string): number {
  const luminanceA = relativeLuminance(hexColorA);
  const luminanceB = relativeLuminance(hexColorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Whether a foreground/background pair has enough contrast to scan reliably. */
export function hasSafeContrast(fgColor: string, bgColor: string): boolean {
  return contrastRatio(fgColor, bgColor) >= MIN_CONTRAST_RATIO;
}

/** Whether every color in a set (e.g. both gradient stops) has enough contrast against a background. */
export function allHaveSafeContrast(colors: string[], bgColor: string): boolean {
  return colors.every((c) => hasSafeContrast(c, bgColor));
}

const SHAPE_TYPES: ReadonlySet<string> = new Set<QrShapeType>(DOT_SHAPE_TYPES);
const CORNER_TYPES: ReadonlySet<string> = new Set<string>(CORNER_SHAPE_TYPES);
const GRADIENT_TYPES: ReadonlySet<string> = new Set<QrGradientType>(['linear', 'radial']);
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

function sanitizeGradient(input: unknown): QrGradient | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const type = obj.type;
  const colorStops = obj.colorStops;
  const rotation = obj.rotation;

  if (typeof type !== 'string' || !GRADIENT_TYPES.has(type)) return null;
  if (!Array.isArray(colorStops) || colorStops.length !== 2 || !isValidHexColor(colorStops[0]) || !isValidHexColor(colorStops[1])) {
    return null;
  }
  if (rotation !== undefined && typeof rotation !== 'number') return null;

  return {
    type: type as QrGradientType,
    colorStops: [colorStops[0], colorStops[1]],
    ...(typeof rotation === 'number' ? { rotation } : {}),
  };
}

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
  const eyeFrameColor = obj.eyeFrameColor;
  const eyeBallColor = obj.eyeBallColor;

  if (
    typeof dotsType !== 'string' ||
    !SHAPE_TYPES.has(dotsType) ||
    typeof cornersSquareType !== 'string' ||
    !CORNER_TYPES.has(cornersSquareType) ||
    typeof cornersDotType !== 'string' ||
    !CORNER_TYPES.has(cornersDotType) ||
    !isValidHexColor(fgColor) ||
    !isValidHexColor(bgColor) ||
    (eyeFrameColor !== undefined && !isValidHexColor(eyeFrameColor)) ||
    (eyeBallColor !== undefined && !isValidHexColor(eyeBallColor))
  ) {
    return null;
  }

  const fgGradient = obj.fgGradient !== undefined ? sanitizeGradient(obj.fgGradient) : null;

  return {
    dotsType: dotsType as QrShapeType,
    cornersSquareType: cornersSquareType as QrCornerType,
    cornersDotType: cornersDotType as QrCornerType,
    fgColor,
    bgColor,
    ...(fgGradient ? { fgGradient } : {}),
    ...(typeof eyeFrameColor === 'string' ? { eyeFrameColor } : {}),
    ...(typeof eyeBallColor === 'string' ? { eyeBallColor } : {}),
  };
}
