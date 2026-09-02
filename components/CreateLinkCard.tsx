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
  sanitizeQrStyle,
  type QrCornerType,
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

function CreateQrSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={disabled || pending}>
      {pending ? 'Creating…' : 'Create QR'}
    </button>
  );
}

/** A labeled hex-color swatch row: curated swatches + a native color picker + a hex text field, all wired to the same setter. */
function ColorField({
  label,
  swatches,
  value,
  hexInput,
  onHexInputChange,
  onCommitHex,
  onSelect,
  ariaPrefix,
}: {
  label: string;
  swatches: { name: string; value: string }[];
  value: string;
  hexInput: string;
  onHexInputChange: (value: string) => void;
  onCommitHex: () => void;
  onSelect: (value: string) => void;
  ariaPrefix: string;
}) {
  const isCustom = !swatches.some((s) => s.value === value);
  return (
    <div className="swatch-group">
      <span className="overline">{label}</span>
      <div className="swatch-row">
        {swatches.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.name}
            aria-label={`${ariaPrefix}: ${s.name}`}
            aria-pressed={s.value === value}
            className={`swatch-btn${s.value === value ? ' swatch-btn-active' : ''}`}
            style={{ background: s.value }}
            onClick={() => onSelect(s.value)}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onSelect(e.target.value)}
          title="Custom color"
          aria-label={`Custom ${ariaPrefix.toLowerCase()} color`}
          className={`swatch-btn swatch-color-input${isCustom ? ' swatch-btn-active' : ''}`}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => onHexInputChange(e.target.value)}
          onBlur={onCommitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommitHex();
            }
          }}
          placeholder="#000000"
          maxLength={7}
          spellCheck={false}
          className="hex-input mono"
          aria-label={`${ariaPrefix} hex color`}
        />
      </div>
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

  // Shapes — independent per-part state; a matching curated preset (if any)
  // is derived below rather than stored, so the picker and the individual
  // dropdowns can never disagree with each other.
  const [dotsType, setDotsType] = useState<QrShapeType>(QR_PRESETS[0].dotsType);
  const [cornersSquareType, setCornersSquareType] = useState<QrCornerType>(QR_PRESETS[0].cornersSquareType);
  const [cornersDotType, setCornersDotType] = useState<QrCornerType>(QR_PRESETS[0].cornersDotType);
  const [customizeShapes, setCustomizeShapes] = useState(false);

  // Foreground: a flat color, or a two-stop gradient.
  const [fgMode, setFgMode] = useState<'solid' | 'gradient'>('solid');
  const [fgColor, setFgColor] = useState(DEFAULT_STYLE.fgColor);
  const [fgHexInput, setFgHexInput] = useState(DEFAULT_STYLE.fgColor);
  const [gradientType, setGradientType] = useState<QrGradientType>('linear');
  const [gradientStart, setGradientStart] = useState(DEFAULT_STYLE.fgColor);
  const [gradientStartHex, setGradientStartHex] = useState(DEFAULT_STYLE.fgColor);
  const [gradientEnd, setGradientEnd] = useState(DEFAULT_GRADIENT_END);
  const [gradientEndHex, setGradientEndHex] = useState(DEFAULT_GRADIENT_END);

  const [bgColor, setBgColor] = useState(DEFAULT_STYLE.bgColor);

  // Eyes: optional independent frame/ball colors, off by default (both fall back to fgColor).
  const [customizeEyeColor, setCustomizeEyeColor] = useState(false);
  const [eyeFrameColor, setEyeFrameColor] = useState(DEFAULT_STYLE.fgColor);
  const [eyeFrameHexInput, setEyeFrameHexInput] = useState(DEFAULT_STYLE.fgColor);
  const [eyeBallColor, setEyeBallColor] = useState(DEFAULT_STYLE.fgColor);
  const [eyeBallHexInput, setEyeBallHexInput] = useState(DEFAULT_STYLE.fgColor);

  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<QrLogoSize>(0.32);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [colorWarning, setColorWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const restored = sanitizeQrStyle(JSON.parse(raw));
      if (!restored) return;

      setDotsType(restored.dotsType);
      setCornersSquareType(restored.cornersSquareType);
      setCornersDotType(restored.cornersDotType);

      if (restored.fgGradient) {
        setFgMode('gradient');
        setGradientType(restored.fgGradient.type);
        setGradientStart(restored.fgGradient.colorStops[0]);
        setGradientStartHex(restored.fgGradient.colorStops[0]);
        setGradientEnd(restored.fgGradient.colorStops[1]);
        setGradientEndHex(restored.fgGradient.colorStops[1]);
      } else {
        setFgColor(restored.fgColor);
        setFgHexInput(restored.fgColor);
      }

      setBgColor(restored.bgColor);

      if (restored.eyeFrameColor || restored.eyeBallColor) {
        setCustomizeEyeColor(true);
        if (restored.eyeFrameColor) {
          setEyeFrameColor(restored.eyeFrameColor);
          setEyeFrameHexInput(restored.eyeFrameColor);
        }
        if (restored.eyeBallColor) {
          setEyeBallColor(restored.eyeBallColor);
          setEyeBallHexInput(restored.eyeBallColor);
        }
      }
    } catch {
      // Ignore malformed or inaccessible storage — default style is a fine fallback.
    }
  }, []);

  const activePreset =
    QR_PRESETS.find((p) => p.dotsType === dotsType && p.cornersSquareType === cornersSquareType && p.cornersDotType === cornersDotType) ?? null;

  /** Builds the full style from current state, with optional field overrides — the single source of truth for both rendering and persisting. */
  function buildStyle(overrides: Partial<{
    dotsType: QrShapeType;
    cornersSquareType: QrCornerType;
    cornersDotType: QrCornerType;
    fgMode: 'solid' | 'gradient';
    fgColor: string;
    gradientType: QrGradientType;
    gradientStart: string;
    gradientEnd: string;
    bgColor: string;
    customizeEyeColor: boolean;
    eyeFrameColor: string;
    eyeBallColor: string;
  }> = {}): QrStyleConfig {
    const _fgMode = overrides.fgMode ?? fgMode;
    const _fgColor = overrides.fgColor ?? fgColor;
    const _gradientType = overrides.gradientType ?? gradientType;
    const _gradientStart = overrides.gradientStart ?? gradientStart;
    const _gradientEnd = overrides.gradientEnd ?? gradientEnd;
    const _customizeEyeColor = overrides.customizeEyeColor ?? customizeEyeColor;
    const _eyeFrameColor = overrides.eyeFrameColor ?? eyeFrameColor;
    const _eyeBallColor = overrides.eyeBallColor ?? eyeBallColor;

    return {
      dotsType: overrides.dotsType ?? dotsType,
      cornersSquareType: overrides.cornersSquareType ?? cornersSquareType,
      cornersDotType: overrides.cornersDotType ?? cornersDotType,
      fgColor: _fgMode === 'solid' ? _fgColor : _gradientStart,
      bgColor: overrides.bgColor ?? bgColor,
      ...(_fgMode === 'gradient' ? { fgGradient: { type: _gradientType, colorStops: [_gradientStart, _gradientEnd] as [string, string] } } : {}),
      ...(_customizeEyeColor ? { eyeFrameColor: _eyeFrameColor, eyeBallColor: _eyeBallColor } : {}),
    };
  }

  const style = buildStyle();

  /** Every foreground-ish color currently in play, for validating a background change against all of them at once. */
  function activeForegroundColors(): string[] {
    const colors = fgMode === 'solid' ? [fgColor] : [gradientStart, gradientEnd];
    return customizeEyeColor ? [...colors, eyeFrameColor, eyeBallColor] : colors;
  }

  function persistStyle(next: QrStyleConfig) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort only; not remembering the style for next time isn't fatal.
    }
  }

  function selectPreset(id: string) {
    const next = QR_PRESETS.find((p) => p.id === id) ?? QR_PRESETS[0];
    setDotsType(next.dotsType);
    setCornersSquareType(next.cornersSquareType);
    setCornersDotType(next.cornersDotType);
    setCustomizeShapes(false);
    persistStyle(buildStyle({ dotsType: next.dotsType, cornersSquareType: next.cornersSquareType, cornersDotType: next.cornersDotType }));
  }

  function selectDotsType(value: QrShapeType) {
    setDotsType(value);
    persistStyle(buildStyle({ dotsType: value }));
  }
  function selectCornersSquareType(value: QrCornerType) {
    setCornersSquareType(value);
    persistStyle(buildStyle({ cornersSquareType: value }));
  }
  function selectCornersDotType(value: QrCornerType) {
    setCornersDotType(value);
    persistStyle(buildStyle({ cornersDotType: value }));
  }

  function selectFgColor(value: string): boolean {
    if (!allHaveSafeContrast([value], bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setFgColor(value);
    setFgHexInput(value);
    persistStyle(buildStyle({ fgMode: 'solid', fgColor: value }));
    return true;
  }

  function commitFgHexInput() {
    const normalized = normalizeHexColor(fgHexInput);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setFgHexInput(fgColor);
      return;
    }
    if (!selectFgColor(normalized)) setFgHexInput(fgColor);
  }

  function setForegroundMode(mode: 'solid' | 'gradient') {
    const colorsToCheck = mode === 'solid' ? [fgColor] : [gradientStart, gradientEnd];
    if (!allHaveSafeContrast(colorsToCheck, bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return;
    }
    setColorWarning(null);
    setFgMode(mode);
    persistStyle(buildStyle({ fgMode: mode }));
  }

  function selectGradientType(value: QrGradientType) {
    setGradientType(value);
    persistStyle(buildStyle({ gradientType: value }));
  }

  function selectGradientStart(value: string): boolean {
    if (!allHaveSafeContrast([value], bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setGradientStart(value);
    setGradientStartHex(value);
    persistStyle(buildStyle({ gradientStart: value }));
    return true;
  }

  function commitGradientStartHex() {
    const normalized = normalizeHexColor(gradientStartHex);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setGradientStartHex(gradientStart);
      return;
    }
    if (!selectGradientStart(normalized)) setGradientStartHex(gradientStart);
  }

  function selectGradientEnd(value: string): boolean {
    if (!allHaveSafeContrast([value], bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setGradientEnd(value);
    setGradientEndHex(value);
    persistStyle(buildStyle({ gradientEnd: value }));
    return true;
  }

  function commitGradientEndHex() {
    const normalized = normalizeHexColor(gradientEndHex);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setGradientEndHex(gradientEnd);
      return;
    }
    if (!selectGradientEnd(normalized)) setGradientEndHex(gradientEnd);
  }

  function selectBgColor(value: string) {
    if (!allHaveSafeContrast(activeForegroundColors(), value)) {
      setColorWarning('That background would make the current colors too hard to scan.');
      return;
    }
    setColorWarning(null);
    setBgColor(value);
    persistStyle(buildStyle({ bgColor: value }));
  }

  function selectEyeFrameColor(value: string): boolean {
    if (!allHaveSafeContrast([value], bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setEyeFrameColor(value);
    setEyeFrameHexInput(value);
    persistStyle(buildStyle({ customizeEyeColor: true, eyeFrameColor: value }));
    return true;
  }

  function commitEyeFrameHexInput() {
    const normalized = normalizeHexColor(eyeFrameHexInput);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setEyeFrameHexInput(eyeFrameColor);
      return;
    }
    if (!selectEyeFrameColor(normalized)) setEyeFrameHexInput(eyeFrameColor);
  }

  function selectEyeBallColor(value: string): boolean {
    if (!allHaveSafeContrast([value], bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setEyeBallColor(value);
    setEyeBallHexInput(value);
    persistStyle(buildStyle({ customizeEyeColor: true, eyeBallColor: value }));
    return true;
  }

  function commitEyeBallHexInput() {
    const normalized = normalizeHexColor(eyeBallHexInput);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setEyeBallHexInput(eyeBallColor);
      return;
    }
    if (!selectEyeBallColor(normalized)) setEyeBallHexInput(eyeBallColor);
  }

  function toggleCustomizeEyeColor(checked: boolean) {
    setCustomizeEyeColor(checked);
    persistStyle(buildStyle({ customizeEyeColor: checked }));
  }

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
                <ShapeSelect label="Body" value={dotsType} options={DOT_SHAPE_TYPES} onChange={(v) => selectDotsType(v as QrShapeType)} />
                <ShapeSelect label="Eye frame" value={cornersSquareType} options={CORNER_SHAPE_TYPES} onChange={selectCornersSquareType} />
                <ShapeSelect label="Eye ball" value={cornersDotType} options={CORNER_SHAPE_TYPES} onChange={selectCornersDotType} />
              </div>
            )}
          </div>

          <div className="swatch-group-row">
            <div className="swatch-group">
              <div className="fg-mode-row">
                <span className="overline">Foreground</span>
                <div className="pill-toggle">
                  <button type="button" className={fgMode === 'solid' ? 'pill-toggle-active' : ''} onClick={() => setForegroundMode('solid')}>
                    Solid
                  </button>
                  <button type="button" className={fgMode === 'gradient' ? 'pill-toggle-active' : ''} onClick={() => setForegroundMode('gradient')}>
                    Gradient
                  </button>
                </div>
              </div>
              {fgMode === 'solid' ? (
                <div className="swatch-row">
                  {FOREGROUND_SWATCHES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      title={s.name}
                      aria-label={s.name}
                      aria-pressed={s.value === fgColor}
                      className={`swatch-btn${s.value === fgColor ? ' swatch-btn-active' : ''}`}
                      style={{ background: s.value }}
                      onClick={() => selectFgColor(s.value)}
                    />
                  ))}
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => selectFgColor(e.target.value)}
                    title="Custom color"
                    aria-label="Custom foreground color"
                    className={`swatch-btn swatch-color-input${!FOREGROUND_SWATCHES.some((s) => s.value === fgColor) ? ' swatch-btn-active' : ''}`}
                  />
                  <input
                    type="text"
                    value={fgHexInput}
                    onChange={(e) => setFgHexInput(e.target.value)}
                    onBlur={commitFgHexInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitFgHexInput();
                      }
                    }}
                    placeholder="#000000"
                    maxLength={7}
                    spellCheck={false}
                    className="hex-input mono"
                    aria-label="Foreground hex color"
                  />
                </div>
              ) : (
                <div className="gradient-editor">
                  <div className="gradient-stop">
                    <input type="color" value={gradientStart} onChange={(e) => selectGradientStart(e.target.value)} aria-label="Gradient start color" />
                    <input
                      type="text"
                      value={gradientStartHex}
                      onChange={(e) => setGradientStartHex(e.target.value)}
                      onBlur={commitGradientStartHex}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitGradientStartHex();
                        }
                      }}
                      placeholder="#000000"
                      maxLength={7}
                      spellCheck={false}
                      className="hex-input mono"
                      aria-label="Gradient start hex color"
                    />
                  </div>
                  <div className="gradient-stop">
                    <input type="color" value={gradientEnd} onChange={(e) => selectGradientEnd(e.target.value)} aria-label="Gradient end color" />
                    <input
                      type="text"
                      value={gradientEndHex}
                      onChange={(e) => setGradientEndHex(e.target.value)}
                      onBlur={commitGradientEndHex}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitGradientEndHex();
                        }
                      }}
                      placeholder="#000000"
                      maxLength={7}
                      spellCheck={false}
                      className="hex-input mono"
                      aria-label="Gradient end hex color"
                    />
                  </div>
                  <div className="pill-toggle">
                    <button type="button" className={gradientType === 'linear' ? 'pill-toggle-active' : ''} onClick={() => selectGradientType('linear')}>
                      Linear
                    </button>
                    <button type="button" className={gradientType === 'radial' ? 'pill-toggle-active' : ''} onClick={() => selectGradientType('radial')}>
                      Radial
                    </button>
                  </div>
                </div>
              )}
            </div>
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
              <input type="checkbox" checked={customizeEyeColor} onChange={(e) => toggleCustomizeEyeColor(e.target.checked)} />
              Different eye colors
            </label>
            {customizeEyeColor && (
              <div className="swatch-group-row">
                <ColorField
                  label="Eye frame"
                  swatches={FOREGROUND_SWATCHES}
                  value={eyeFrameColor}
                  hexInput={eyeFrameHexInput}
                  onHexInputChange={setEyeFrameHexInput}
                  onCommitHex={commitEyeFrameHexInput}
                  onSelect={selectEyeFrameColor}
                  ariaPrefix="Eye frame"
                />
                <ColorField
                  label="Eye ball"
                  swatches={FOREGROUND_SWATCHES}
                  value={eyeBallColor}
                  hexInput={eyeBallHexInput}
                  onHexInputChange={setEyeBallHexInput}
                  onCommitHex={commitEyeBallHexInput}
                  onSelect={selectEyeBallColor}
                  ariaPrefix="Eye ball"
                />
              </div>
            )}
          </div>
          {colorWarning && <span className="caption field-error">{colorWarning}</span>}

          <input type="hidden" name="style" value={JSON.stringify(style)} />
        </div>

        <div className="preview-panel">
          <span className="overline">Preview</span>
          <div className="viq-glass viq-glass--static preview-glass">
            <QrPreview url={PREVIEW_DATA} style={style} logo={logoOptions} size={188} showDownload downloadName="qr-preview" />
          </div>
          <div className="preview-meta">
            {destinationHostname && <span className="preview-destination">→ {destinationHostname}</span>}
            <span className="caption">Short code is assigned on create</span>
          </div>
          <div className="preview-actions">
            <CreateQrSubmitButton disabled={!isUrlValid} />
          </div>
        </div>
      </form>
    </div>
  );
}
