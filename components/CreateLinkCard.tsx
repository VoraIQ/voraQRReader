'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createLinkAction } from '@/app/actions';
import QrPreview from './QrPreview';
import {
  DEFAULT_STYLE,
  LOGO_SIZES,
  MAX_LOGO_BYTES,
  QR_PRESETS,
  findPresetForStyle,
  hasSafeContrast,
  sanitizeQrStyle,
  type QrLogoSize,
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

export default function CreateLinkCard() {
  const [destinationUrl, setDestinationUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [label, setLabel] = useState('');
  const [presetId, setPresetId] = useState(QR_PRESETS[0].id);
  const [fgColor, setFgColor] = useState(DEFAULT_STYLE.fgColor);
  const [bgColor, setBgColor] = useState(DEFAULT_STYLE.bgColor);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<QrLogoSize>(0.32);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [colorWarning, setColorWarning] = useState<string | null>(null);
  const [fgHexInput, setFgHexInput] = useState(DEFAULT_STYLE.fgColor);
  const [customizeEyeColor, setCustomizeEyeColor] = useState(false);
  const [eyeColor, setEyeColor] = useState(DEFAULT_STYLE.fgColor);
  const [eyeHexInput, setEyeHexInput] = useState(DEFAULT_STYLE.fgColor);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const restored = sanitizeQrStyle(JSON.parse(raw));
      if (restored) {
        setPresetId(findPresetForStyle(restored).id);
        setFgColor(restored.fgColor);
        setFgHexInput(restored.fgColor);
        setBgColor(restored.bgColor);
        if (restored.eyeColor) {
          setCustomizeEyeColor(true);
          setEyeColor(restored.eyeColor);
          setEyeHexInput(restored.eyeColor);
        }
      }
    } catch {
      // Ignore malformed or inaccessible storage — default style is a fine fallback.
    }
  }, []);

  const preset = QR_PRESETS.find((p) => p.id === presetId) ?? QR_PRESETS[0];
  const style: QrStyleConfig = {
    dotsType: preset.dotsType,
    cornersSquareType: preset.cornersSquareType,
    cornersDotType: preset.cornersDotType,
    fgColor,
    bgColor,
    ...(customizeEyeColor ? { eyeColor } : {}),
  };
  const isCustomFg = !FOREGROUND_SWATCHES.some((s) => s.value === fgColor);
  const isCustomEye = !FOREGROUND_SWATCHES.some((s) => s.value === eyeColor);

  function persistStyle(next: QrStyleConfig) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort only; not remembering the style for next time isn't fatal.
    }
  }

  function selectPreset(id: string) {
    const next = QR_PRESETS.find((p) => p.id === id) ?? QR_PRESETS[0];
    setPresetId(id);
    persistStyle({ dotsType: next.dotsType, cornersSquareType: next.cornersSquareType, cornersDotType: next.cornersDotType, fgColor, bgColor });
  }

  function selectFgColor(value: string): boolean {
    if (!hasSafeContrast(value, bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setFgColor(value);
    setFgHexInput(value);
    persistStyle({ ...style, fgColor: value });
    return true;
  }

  function commitFgHexInput() {
    const normalized = normalizeHexColor(fgHexInput);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setFgHexInput(fgColor);
      return;
    }
    if (!selectFgColor(normalized)) {
      setFgHexInput(fgColor);
    }
  }

  function selectBgColor(value: string) {
    if (!hasSafeContrast(fgColor, value) || (customizeEyeColor && !hasSafeContrast(eyeColor, value))) {
      setColorWarning('That background would make the current colors too hard to scan.');
      return;
    }
    setColorWarning(null);
    setBgColor(value);
    persistStyle({ ...style, bgColor: value });
  }

  function selectEyeColor(value: string): boolean {
    if (!hasSafeContrast(value, bgColor)) {
      setColorWarning('That color is too close to the background for reliable scanning — try something darker.');
      return false;
    }
    setColorWarning(null);
    setEyeColor(value);
    setEyeHexInput(value);
    persistStyle({ ...style, eyeColor: value });
    return true;
  }

  function commitEyeHexInput() {
    const normalized = normalizeHexColor(eyeHexInput);
    if (!normalized) {
      setColorWarning('Enter a valid hex color, like #3b82f6.');
      setEyeHexInput(eyeColor);
      return;
    }
    if (!selectEyeColor(normalized)) {
      setEyeHexInput(eyeColor);
    }
  }

  function toggleCustomizeEyeColor(checked: boolean) {
    setCustomizeEyeColor(checked);
    persistStyle({ dotsType: preset.dotsType, cornersSquareType: preset.cornersSquareType, cornersDotType: preset.cornersDotType, fgColor, bgColor, ...(checked ? { eyeColor } : {}) });
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
                  className={`preset-card${p.id === presetId ? ' preset-card-active' : ''}`}
                  onClick={() => selectPreset(p.id)}
                  aria-pressed={p.id === presetId}
                >
                  <QrPreview
                    url={PREVIEW_DATA}
                    style={{
                      dotsType: p.dotsType,
                      cornersSquareType: p.cornersSquareType,
                      cornersDotType: p.cornersDotType,
                      fgColor,
                      bgColor,
                      ...(customizeEyeColor ? { eyeColor } : {}),
                    }}
                    size={52}
                  />
                  <span className="preset-card-name">{p.name}</span>
                  <span className="mono preset-card-dots">{p.dotsType}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="swatch-group-row">
            <div className="swatch-group">
              <span className="overline">Foreground</span>
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
                  className={`swatch-btn swatch-color-input${isCustomFg ? ' swatch-btn-active' : ''}`}
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
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={customizeEyeColor}
                  onChange={(e) => toggleCustomizeEyeColor(e.target.checked)}
                />
                Different eye color
              </label>
              {customizeEyeColor && (
                <div className="swatch-row">
                  {FOREGROUND_SWATCHES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      title={s.name}
                      aria-label={`Eye color: ${s.name}`}
                      aria-pressed={s.value === eyeColor}
                      className={`swatch-btn${s.value === eyeColor ? ' swatch-btn-active' : ''}`}
                      style={{ background: s.value }}
                      onClick={() => selectEyeColor(s.value)}
                    />
                  ))}
                  <input
                    type="color"
                    value={eyeColor}
                    onChange={(e) => selectEyeColor(e.target.value)}
                    title="Custom eye color"
                    aria-label="Custom eye color"
                    className={`swatch-btn swatch-color-input${isCustomEye ? ' swatch-btn-active' : ''}`}
                  />
                  <input
                    type="text"
                    value={eyeHexInput}
                    onChange={(e) => setEyeHexInput(e.target.value)}
                    onBlur={commitEyeHexInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEyeHexInput();
                      }
                    }}
                    placeholder="#000000"
                    maxLength={7}
                    spellCheck={false}
                    className="hex-input mono"
                    aria-label="Eye hex color"
                  />
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
