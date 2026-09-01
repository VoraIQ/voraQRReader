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

function isValidDestinationUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const restored = sanitizeQrStyle(JSON.parse(raw));
      if (restored) {
        setPresetId(findPresetForStyle(restored).id);
        setFgColor(restored.fgColor);
        setBgColor(restored.bgColor);
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
  };
  const isCustomFg = !FOREGROUND_SWATCHES.some((s) => s.value === fgColor);
  const isCustomBg = !BACKGROUND_SWATCHES.some((s) => s.value === bgColor);

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

  function selectFgColor(value: string) {
    setFgColor(value);
    persistStyle({ ...style, fgColor: value });
  }

  function selectBgColor(value: string) {
    setBgColor(value);
    persistStyle({ ...style, bgColor: value });
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
  const isUrlValid = isValidDestinationUrl(trimmedUrl);
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
                    style={{ dotsType: p.dotsType, cornersSquareType: p.cornersSquareType, cornersDotType: p.cornersDotType, fgColor, bgColor }}
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
              </div>
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
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => selectBgColor(e.target.value)}
                  title="Custom color"
                  aria-label="Custom background color"
                  className={`swatch-btn swatch-color-input${isCustomBg ? ' swatch-btn-active' : ''}`}
                />
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

          <input type="hidden" name="style" value={JSON.stringify(style)} />
        </div>

        <div className="preview-panel">
          <span className="overline">Preview</span>
          <div className="viq-glass viq-glass--static preview-glass">
            <QrPreview url={PREVIEW_DATA} style={style} logo={logoOptions} size={188} showDownload downloadName="qr-preview" />
          </div>
          <div className="preview-meta">
            <span className="mono preview-url">{PREVIEW_DATA}</span>
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
