'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createLinkAction } from '@/app/actions';
import QrPreview from './QrPreview';
import {
  CORNER_SHAPE_TYPES,
  DEFAULT_STYLE,
  DOT_SHAPE_TYPES,
  LOGO_SIZES,
  MAX_LOGO_BYTES,
  QR_PRESETS,
  SHAPE_LABELS,
  allHaveSafeContrast,
  enforceContrastSafety,
  sanitizeQrStyle,
  type QrCornerType,
  type QrGradient,
  type QrGradientType,
  type QrLogoSize,
  type QrShapeType,
  type QrStyleConfig,
} from '@/lib/qrStyles';

const STORAGE_KEY = 'qr-tracker:last-style';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
// Cosmetic-only placeholder — the real short code doesn't exist until the
// server action creates the link, so previews just need *some* data.
const PREVIEW_DATA = `${BASE_URL}/r/…`;

const FOREGROUND_SWATCHES = [
  { name: 'Ink', value: '#000000' },
  { name: 'Vora blue', value: '#019bd8' },
  { name: 'Deep', value: '#075985' },
  { name: 'Green', value: '#047857' },
  { name: 'Red', value: '#b91c1c' },
];

const BACKGROUND_SWATCHES = [
  { name: 'White', value: '#ffffff' },
  { name: 'Pale blue', value: '#f5f9fc' },
  { name: 'Brand tint', value: '#eaf7fd' },
];

const LOGO_SIZE_LABELS: Record<QrLogoSize, string> = { 0.24: 'Small', 0.32: 'Medium', 0.4: 'Large' };
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const DEFAULT_GRADIENT_END = '#019bd8';

/** Normalizes free-typed text into a `#rrggbb` hex color, expanding shorthand. Returns null if it isn't a valid hex color at all. */
function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/** Returns the destination's hostname if it's a well-formed http(s) URL, otherwise null. */
function parseDestinationHostname(value: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

// A single color-bearing part of the QR (foreground, eye frame, or eye
// ball) — either a flat color or a two-stop gradient. Hex inputs keep their
// own buffered string so a mid-typing value doesn't fight the committed one.
interface ColorSlot {
  mode: 'solid' | 'gradient';
  color: string;
  hexInput: string;
  gradientType: QrGradientType;
  gradientStart: string;
  gradientStartHex: string;
  gradientEnd: string;
  gradientEndHex: string;
}

function makeSolidSlot(color: string): ColorSlot {
  return {
    mode: 'solid',
    color,
    hexInput: color,
    gradientType: 'linear',
    gradientStart: color,
    gradientStartHex: color,
    gradientEnd: DEFAULT_GRADIENT_END,
    gradientEndHex: DEFAULT_GRADIENT_END,
  };
}

function slotFromStyle(color: string, gradient: QrGradient | undefined): ColorSlot {
  if (!gradient) return makeSolidSlot(color);
  return {
    mode: 'gradient',
    color,
    hexInput: color,
    gradientType: gradient.type,
    gradientStart: gradient.colorStops[0],
    gradientStartHex: gradient.colorStops[0],
    gradientEnd: gradient.colorStops[1],
    gradientEndHex: gradient.colorStops[1],
  };
}

function slotActiveColors(slot: ColorSlot): string[] {
  return slot.mode === 'solid' ? [slot.color] : [slot.gradientStart, slot.gradientEnd];
}

function slotToStyleFields(slot: ColorSlot): { color: string; gradient?: QrGradient } {
  if (slot.mode === 'gradient') {
    return { color: slot.gradientStart, gradient: { type: slot.gradientType, colorStops: [slot.gradientStart, slot.gradientEnd] } };
  }
  return { color: slot.color };
}

interface SlotHandlers {
  setMode: (mode: 'solid' | 'gradient') => void;
  selectSolid: (value: string) => void;
  setHexInput: (value: string) => void;
  commitHex: () => void;
  setGradientType: (type: QrGradientType) => void;
  selectGradientStart: (value: string) => void;
  setGradientStartHex: (value: string) => void;
  commitGradientStartHex: () => void;
  selectGradientEnd: (value: string) => void;
  setGradientEndHex: (value: string) => void;
  commitGradientEndHex: () => void;
}

function CreateQrSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={disabled || pending}>
      {pending ? 'Creating…' : 'Create QR'}
    </button>
  );
}

function ColorOrGradientField({
  label,
  swatches,
  slot,
  handlers,
  ariaPrefix,
}: {
  label: string;
  swatches: { name: string; value: string }[];
  slot: ColorSlot;
  handlers: SlotHandlers;
  ariaPrefix: string;
}) {
  return (
    <div className="swatch-group">
      <div className="fg-mode-row">
        <span className="overline">{label}</span>
        <div className="pill-toggle">
          <button type="button" className={slot.mode === 'solid' ? 'pill-toggle-active' : ''} onClick={() => handlers.setMode('solid')}>
            Solid
          </button>
          <button type="button" className={slot.mode === 'gradient' ? 'pill-toggle-active' : ''} onClick={() => handlers.setMode('gradient')}>
            Gradient
          </button>
        </div>
      </div>
      {slot.mode === 'solid' ? (
        <div className="swatch-row">
          {swatches.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.name}
              aria-label={`${ariaPrefix}: ${s.name}`}
              aria-pressed={s.value === slot.color}
              className={`swatch-btn${s.value === slot.color ? ' swatch-btn-active' : ''}`}
              style={{ background: s.value }}
              onClick={() => handlers.selectSolid(s.value)}
            />
          ))}
          <input
            type="color"
            value={slot.color}
            onChange={(e) => handlers.selectSolid(e.target.value)}
            title="Custom color"
            aria-label={`Custom ${ariaPrefix.toLowerCase()} color`}
            className={`swatch-btn swatch-color-input${!swatches.some((s) => s.value === slot.color) ? ' swatch-btn-active' : ''}`}
          />
          <input
            type="text"
            value={slot.hexInput}
            onChange={(e) => handlers.setHexInput(e.target.value)}
            onBlur={handlers.commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handlers.commitHex();
              }
            }}
            placeholder="#000000"
            maxLength={7}
            spellCheck={false}
            className="hex-input mono"
            aria-label={`${ariaPrefix} hex color`}
          />
        </div>
      ) : (
        <div className="gradient-editor">
          <div className="gradient-stop">
            <input
              type="color"
              value={slot.gradientStart}
              onChange={(e) => handlers.selectGradientStart(e.target.value)}
              aria-label={`${ariaPrefix} gradient start color`}
            />
            <input
              type="text"
              value={slot.gradientStartHex}
              onChange={(e) => handlers.setGradientStartHex(e.target.value)}
              onBlur={handlers.commitGradientStartHex}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlers.commitGradientStartHex();
                }
              }}
              placeholder="#000000"
              maxLength={7}
              spellCheck={false}
              className="hex-input mono"
              aria-label={`${ariaPrefix} gradient start hex color`}
            />
          </div>
          <div className="gradient-stop">
            <input
              type="color"
              value={slot.gradientEnd}
              onChange={(e) => handlers.selectGradientEnd(e.target.value)}
              aria-label={`${ariaPrefix} gradient end color`}
            />
            <input
              type="text"
              value={slot.gradientEndHex}
              onChange={(e) => handlers.setGradientEndHex(e.target.value)}
              onBlur={handlers.commitGradientEndHex}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlers.commitGradientEndHex();
                }
              }}
              placeholder="#000000"
              maxLength={7}
              spellCheck={false}
              className="hex-input mono"
              aria-label={`${ariaPrefix} gradient end hex color`}
            />
          </div>
          <div className="pill-toggle">
            <button type="button" className={slot.gradientType === 'linear' ? 'pill-toggle-active' : ''} onClick={() => handlers.setGradientType('linear')}>
              Linear
            </button>
            <button type="button" className={slot.gradientType === 'radial' ? 'pill-toggle-active' : ''} onClick={() => handlers.setGradientType('radial')}>
              Radial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShapeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: QrCornerType;
  options: readonly QrCornerType[];
  onChange: (value: QrCornerType) => void;
}) {
  return (
    <label className="field">
      <span className="overline">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as QrCornerType)} className="field-input shape-select">
        {options.map((t) => (
          <option key={t} value={t}>
            {SHAPE_LABELS[t]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CreateLinkCard() {
  const [destinationUrl, setDestinationUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [label, setLabel] = useState('');

  const [dotsType, setDotsType] = useState<QrShapeType>(QR_PRESETS[0].dotsType);
  const [cornersSquareType, setCornersSquareType] = useState<QrCornerType>(QR_PRESETS[0].cornersSquareType);
  const [cornersDotType, setCornersDotType] = useState<QrCornerType>(QR_PRESETS[0].cornersDotType);
  const [customizeShapes, setCustomizeShapes] = useState(false);

  const [fg, setFg] = useState<ColorSlot>(() => makeSolidSlot(DEFAULT_STYLE.fgColor));
  const [bgColor, setBgColor] = useState(DEFAULT_STYLE.bgColor);

  const [customizeEyeColor, setCustomizeEyeColor] = useState(false);
  const [eyeFrame, setEyeFrame] = useState<ColorSlot>(() => makeSolidSlot(DEFAULT_STYLE.fgColor));
  const [eyeBall, setEyeBall] = useState<ColorSlot>(() => makeSolidSlot(DEFAULT_STYLE.fgColor));

  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<QrLogoSize>(0.32);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [colorWarning, setColorWarning] = useState<string | null>(null);

  // State, not a ref, so the flip to `true` lands in the same render as the
  // restored values below — a ref would let the persist effect below see
  // "restored" flip true before styleKey (still closed over pre-restore
  // state) had actually updated, briefly clobbering localStorage with the
  // defaults right after loading the real saved style.
  const [hasRestored, setHasRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? sanitizeQrStyle(JSON.parse(raw)) : null;
      const restored = parsed ? enforceContrastSafety(parsed) : null;
      if (restored) {
        setDotsType(restored.dotsType);
        setCornersSquareType(restored.cornersSquareType);
        setCornersDotType(restored.cornersDotType);
        const matchesPreset = QR_PRESETS.some(
          (p) =>
            p.dotsType === restored.dotsType &&
            p.cornersSquareType === restored.cornersSquareType &&
            p.cornersDotType === restored.cornersDotType
        );
        if (!matchesPreset) setCustomizeShapes(true);
        setFg(slotFromStyle(restored.fgColor, restored.fgGradient));
        setBgColor(restored.bgColor);
        if (restored.eyeFrameColor || restored.eyeFrameGradient || restored.eyeBallColor || restored.eyeBallGradient) {
          setCustomizeEyeColor(true);
          setEyeFrame(slotFromStyle(restored.eyeFrameColor ?? restored.fgColor, restored.eyeFrameGradient));
          setEyeBall(slotFromStyle(restored.eyeBallColor ?? restored.fgColor, restored.eyeBallGradient));
        }
      }
    } catch {
      // Ignore malformed or inaccessible storage — default style is a fine fallback.
    } finally {
      setHasRestored(true);
    }
  }, []);

  function buildStyle(): QrStyleConfig {
    const fgFields = slotToStyleFields(fg);
    const eyeFrameFields = slotToStyleFields(eyeFrame);
    const eyeBallFields = slotToStyleFields(eyeBall);
    return {
      dotsType,
      cornersSquareType,
      cornersDotType,
      fgColor: fgFields.color,
      bgColor,
      ...(fgFields.gradient ? { fgGradient: fgFields.gradient } : {}),
      ...(customizeEyeColor
        ? {
            eyeFrameColor: eyeFrameFields.color,
            ...(eyeFrameFields.gradient ? { eyeFrameGradient: eyeFrameFields.gradient } : {}),
            eyeBallColor: eyeBallFields.color,
            ...(eyeBallFields.gradient ? { eyeBallGradient: eyeBallFields.gradient } : {}),
          }
        : {}),
    };
  }

  const style = buildStyle();
  const styleKey = JSON.stringify(style);

  // Persist whenever the composed style actually changes, but never before
  // the restore effect above has had a chance to run (or it would clobber
  // the saved value with these hooks' initial defaults).
  useEffect(() => {
    if (!hasRestored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, styleKey);
    } catch {
      // Best-effort only; not remembering the style for next time isn't fatal.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey, hasRestored]);

  function activeForegroundColors(): string[] {
    const colors = slotActiveColors(fg);
    return customizeEyeColor ? [...colors, ...slotActiveColors(eyeFrame), ...slotActiveColors(eyeBall)] : colors;
  }

  function selectPreset(id: string) {
    const next = QR_PRESETS.find((p) => p.id === id) ?? QR_PRESETS[0];
    setDotsType(next.dotsType);
    setCornersSquareType(next.cornersSquareType);
    setCornersDotType(next.cornersDotType);
    setCustomizeShapes(false);
  }

  function selectBgColor(value: string) {
    if (!allHaveSafeContrast(activeForegroundColors(), value)) {
      setColorWarning('That background would make the current colors too hard to scan.');
      return;
    }
    setColorWarning(null);
    setBgColor(value);
  }

  /** Builds the full set of solid/gradient handlers for one color slot. `markEyeCustomized` flips "Different eye colors" on the first time an eye slot is touched directly (e.g. restoring a saved eye-only style before the checkbox exists). */
  function createSlotHandlers(slot: ColorSlot, setSlot: React.Dispatch<React.SetStateAction<ColorSlot>>, markEyeCustomized?: boolean): SlotHandlers {
    function checkAndWarn(colors: string[]): boolean {
      if (!allHaveSafeContrast(colors, bgColor)) {
        setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
        return false;
      }
      setColorWarning(null);
      return true;
    }
    function markEye() {
      if (markEyeCustomized) setCustomizeEyeColor(true);
    }
    return {
      setMode(mode) {
        const colors = mode === 'solid' ? [slot.color] : [slot.gradientStart, slot.gradientEnd];
        if (!checkAndWarn(colors)) return;
        markEye();
        setSlot((prev) => ({ ...prev, mode }));
      },
      selectSolid(value) {
        if (!checkAndWarn([value])) return;
        markEye();
        setSlot((prev) => ({ ...prev, color: value, hexInput: value }));
      },
      setHexInput(value) {
        setSlot((prev) => ({ ...prev, hexInput: value }));
      },
      commitHex() {
        const normalized = normalizeHexColor(slot.hexInput);
        if (!normalized) {
          setColorWarning('Enter a valid hex color, like #3b82f6.');
          setSlot((prev) => ({ ...prev, hexInput: prev.color }));
          return;
        }
        if (!checkAndWarn([normalized])) {
          setSlot((prev) => ({ ...prev, hexInput: prev.color }));
          return;
        }
        markEye();
        setSlot((prev) => ({ ...prev, color: normalized, hexInput: normalized }));
      },
      setGradientType(type) {
        markEye();
        setSlot((prev) => ({ ...prev, gradientType: type }));
      },
      selectGradientStart(value) {
        if (!checkAndWarn([value])) return;
        markEye();
        setSlot((prev) => ({ ...prev, gradientStart: value, gradientStartHex: value }));
      },
      setGradientStartHex(value) {
        setSlot((prev) => ({ ...prev, gradientStartHex: value }));
      },
      commitGradientStartHex() {
        const normalized = normalizeHexColor(slot.gradientStartHex);
        if (!normalized) {
          setColorWarning('Enter a valid hex color, like #3b82f6.');
          setSlot((prev) => ({ ...prev, gradientStartHex: prev.gradientStart }));
          return;
        }
        if (!checkAndWarn([normalized])) {
          setSlot((prev) => ({ ...prev, gradientStartHex: prev.gradientStart }));
          return;
        }
        markEye();
        setSlot((prev) => ({ ...prev, gradientStart: normalized, gradientStartHex: normalized }));
      },
      selectGradientEnd(value) {
        if (!checkAndWarn([value])) return;
        markEye();
        setSlot((prev) => ({ ...prev, gradientEnd: value, gradientEndHex: value }));
      },
      setGradientEndHex(value) {
        setSlot((prev) => ({ ...prev, gradientEndHex: value }));
      },
      commitGradientEndHex() {
        const normalized = normalizeHexColor(slot.gradientEndHex);
        if (!normalized) {
          setColorWarning('Enter a valid hex color, like #3b82f6.');
          setSlot((prev) => ({ ...prev, gradientEndHex: prev.gradientEnd }));
          return;
        }
        if (!checkAndWarn([normalized])) {
          setSlot((prev) => ({ ...prev, gradientEndHex: prev.gradientEnd }));
          return;
        }
        markEye();
        setSlot((prev) => ({ ...prev, gradientEnd: normalized, gradientEndHex: normalized }));
      },
    };
  }

  const fgHandlers = createSlotHandlers(fg, setFg);
  const eyeFrameHandlers = createSlotHandlers(eyeFrame, setEyeFrame, true);
  const eyeBallHandlers = createSlotHandlers(eyeBall, setEyeBall, true);

  function handleLogoFile(file: File) {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Use a PNG, JPG or SVG file.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('That file is over 512 KB. Use a smaller PNG, JPG or SVG.');
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogo(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogo(null);
    setLogoSize(0.32);
    setLogoError(null);
  }

  const trimmedUrl = destinationUrl.trim();
  const destinationHostname = parseDestinationHostname(trimmedUrl);
  const isUrlValid = !!destinationHostname;
  const showUrlError = urlTouched && trimmedUrl.length > 0 && !isUrlValid;
  const logoOptions = logo ? { image: logo, imageSize: logoSize } : undefined;
  const activePreset =
    QR_PRESETS.find((p) => p.dotsType === dotsType && p.cornersSquareType === cornersSquareType && p.cornersDotType === cornersDotType) ?? null;

  return (
    <div className="create-card">
      <form action={createLinkAction} className="create-card-grid">
        <div className="create-left">
          <div className="create-title-group">
            <h2>New QR code</h2>
            <p className="type-body-sm" style={{ color: 'var(--color-label-secondary)' }}>
              Style is cosmetic. The code still encodes your redirect URL, so tracking is unaffected.
            </p>
          </div>

          <div className="field-row">
            <div className="field">
              <span className="overline">Destination URL</span>
              <input
                type="url"
                name="destinationUrl"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                onBlur={() => setUrlTouched(true)}
                placeholder="https://destination-site.com/page"
                required
                className={`field-input${showUrlError ? ' field-input-invalid' : ''}`}
              />
              {showUrlError && <span className="caption field-error">Enter a full URL, including https://</span>}
            </div>
            <div className="field">
              <span className="overline">Label</span>
              <input
                type="text"
                name="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Optional"
                className="field-input"
              />
            </div>
          </div>

          <div className="style-section">
            <span className="overline">Style preset</span>
            <div className="preset-grid">
              {QR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-card${activePreset?.id === p.id ? ' preset-card-active' : ''}`}
                  onClick={() => selectPreset(p.id)}
                  aria-pressed={activePreset?.id === p.id}
                >
                  <QrPreview
                    url={PREVIEW_DATA}
                    style={{ ...style, dotsType: p.dotsType, cornersSquareType: p.cornersSquareType, cornersDotType: p.cornersDotType }}
                    size={52}
                  />
                  <span className="preset-card-name">{p.name}</span>
                  <span className="mono preset-card-dots">{p.dotsType}</span>
                </button>
              ))}
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={customizeShapes} onChange={(e) => setCustomizeShapes(e.target.checked)} />
              Customize shapes individually
            </label>
            {customizeShapes && (
              <div className="shape-picker-row">
                <ShapeSelect label="Body" value={dotsType} options={DOT_SHAPE_TYPES} onChange={(v) => setDotsType(v as QrShapeType)} />
                <ShapeSelect label="Eye frame" value={cornersSquareType} options={CORNER_SHAPE_TYPES} onChange={setCornersSquareType} />
                <ShapeSelect label="Eye ball" value={cornersDotType} options={CORNER_SHAPE_TYPES} onChange={setCornersDotType} />
              </div>
            )}
          </div>

          <div className="swatch-group-row">
            <ColorOrGradientField label="Foreground" swatches={FOREGROUND_SWATCHES} slot={fg} handlers={fgHandlers} ariaPrefix="Foreground" />
            <div className="swatch-group">
              <span className="overline">Background</span>
              <div className="swatch-row">
                {BACKGROUND_SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    title={s.name}
                    aria-label={s.name}
                    aria-pressed={s.value === bgColor}
                    className={`swatch-btn${s.value === bgColor ? ' swatch-btn-active' : ''}`}
                    style={{ background: s.value }}
                    onClick={() => selectBgColor(s.value)}
                  />
                ))}
              </div>
            </div>
            <div className="logo-section">
              <span className="overline">Logo</span>
              <div className="logo-row">
                <label className="logo-upload">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoFile(file);
                      e.target.value = '';
                    }}
                    style={{ display: 'none' }}
                  />
                  {logo ? (
                    <div role="img" aria-label="Selected logo" className="logo-thumb" style={{ backgroundImage: `url("${logo}")` }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14"></path>
                      <path d="M12 5v14"></path>
                    </svg>
                  )}
                </label>
                <div className="logo-info">
                  <span className="type-body-sm logo-label">
                    {logo ? 'Logo added — centered, error correction raised to H' : 'Upload a logo'}
                  </span>
                  <span className={`caption${logoError ? ' logo-hint-error' : ''}`}>
                    {logoError || 'PNG, JPG or SVG · square works best'}
                  </span>
                </div>
              </div>
              <span className="caption">Shown here and in this preview's downloads only — not saved with the code</span>
              {logo && (
                <div className="logo-sizes">
                  {LOGO_SIZES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`size-pill${value === logoSize ? ' size-pill-active' : ''}`}
                      onClick={() => setLogoSize(value)}
                    >
                      {LOGO_SIZE_LABELS[value]}
                    </button>
                  ))}
                  <button type="button" className="btn-link" onClick={clearLogo}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="eye-color-section">
            <label className="checkbox-label">
              <input type="checkbox" checked={customizeEyeColor} onChange={(e) => setCustomizeEyeColor(e.target.checked)} />
              Different eye colors
            </label>
            {customizeEyeColor && (
              <div className="swatch-group-row">
                <ColorOrGradientField label="Eye frame" swatches={FOREGROUND_SWATCHES} slot={eyeFrame} handlers={eyeFrameHandlers} ariaPrefix="Eye frame" />
                <ColorOrGradientField label="Eye ball" swatches={FOREGROUND_SWATCHES} slot={eyeBall} handlers={eyeBallHandlers} ariaPrefix="Eye ball" />
              </div>
            )}
          </div>
          {colorWarning && <span className="caption field-error">{colorWarning}</span>}

          <input type="hidden" name="style" value={styleKey} />
        </div>

        <div className="preview-panel">
          <span className="overline">Preview</span>
          <div className="viq-glass viq-glass--static preview-glass">
            {/* No showDownload here: this preview's `url` is a placeholder
                (PREVIEW_DATA) until the code actually exists, so a download
                from this panel would encode a link that can never resolve. */}
            <QrPreview url={PREVIEW_DATA} style={style} logo={logoOptions} size={188} downloadName="qr-preview" />
          </div>
          <div className="preview-meta">
            {destinationHostname && <span className="preview-destination">→ {destinationHostname}</span>}
            <span className="caption">Short code and downloads are ready once you create the code</span>
          </div>
          <div className="preview-actions">
            <CreateQrSubmitButton disabled={!isUrlValid} />
          </div>
        </div>
      </form>
    </div>
  );
}
