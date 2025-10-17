import { CSS_COLORS } from './colors';

export interface Dimensions {
  width: number;
  height: number;
}

export type Align = 'center' | 'left' | 'right';

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 8000;

export function parseDims(value: string): Dimensions {
  const trimmed = value.trim();
  const match = /^(\d{1,4})x(\d{1,4})$/.exec(trimmed);
  if (!match) {
    throw new Error('Invalid dimensions');
  }
  const width = clamp(parseInt(match[1], 10), MIN_DIMENSION, MAX_DIMENSION);
  const height = clamp(parseInt(match[2], 10), MIN_DIMENSION, MAX_DIMENSION);
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new Error('Invalid dimensions');
  }
  return { width, height };
}

export function parseColor(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Invalid color');
  }

  if (normalized === 't' || normalized === 'transparent') {
    return 'transparent';
  }

  if (normalized in CSS_COLORS) {
    return CSS_COLORS[normalized];
  }

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(normalized);
  if (hexMatch) {
    const value = hexMatch[1];
    if (value.length === 3) {
      const expanded = value
        .split('')
        .map((char) => char + char)
        .join('');
      return `#${expanded}`;
    }
    return `#${value}`;
  }

  const rgbMatch = /^rgba?\(\s*([^)]+)\s*\)$/.exec(normalized);
  if (rgbMatch) {
    const components = rgbMatch[1]
      .split(',')
      .map((part) => part.trim())
      .join(', ');
    return normalized.startsWith('rgba')
      ? `rgba(${components})`
      : `rgb(${components})`;
  }

  const hslMatch = /^hsla?\(\s*([^)]+)\s*\)$/.exec(normalized);
  if (hslMatch) {
    const components = hslMatch[1]
      .split(',')
      .map((part) => part.trim())
      .join(', ');
    return normalized.startsWith('hsla')
      ? `hsla(${components})`
      : `hsl(${components})`;
  }

  throw new Error('Invalid color');
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return rgbToLuminance([r, g, b]);
}

export function autoContrast(bg: string): string {
  if (bg === 'transparent') {
    return '#111111';
  }

  const rgb = colorToRgb(bg);
  if (!rgb) {
    return '#111111';
  }

  const luminance = rgbToLuminance(rgb);
  return luminance > 0.55 ? '#111111' : '#ffffff';
}

export function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface WrapOptions {
  text: string;
  maxWidth: number;
  fontSize: number;
  wrap: boolean;
  maxLines?: number;
}

export function wrapText(options: WrapOptions): string[] {
  const { text, maxWidth, fontSize, wrap, maxLines = 2 } = options;
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (!wrap) {
    return [trimmed];
  }

  const widthPerChar = fontSize * 0.6;
  const charsPerLine = Math.max(1, Math.floor(maxWidth / widthPerChar));

  if (trimmed.length <= charsPerLine) {
    return [trimmed];
  }

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    if (word.length > charsPerLine) {
      if (current) {
        pushCurrent();
      }
      const segments = chunkWord(word, charsPerLine);
      for (const segment of segments) {
        lines.push(segment);
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      current = candidate;
    } else {
      pushCurrent();
      current = word;
    }
  }

  pushCurrent();

  if (lines.length <= maxLines) {
    return lines;
  }

  const limited = lines.slice(0, maxLines);
  const overflow = lines.slice(maxLines - 1);
  limited[maxLines - 1] = collapseWithEllipsis(
    overflow.join(' ').trim(),
    charsPerLine,
  );
  return limited;
}

function chunkWord(word: string, size: number): string[] {
  const result: string[] = [];
  let index = 0;
  while (index < word.length) {
    result.push(word.slice(index, index + size));
    index += size;
  }
  return result;
}

function collapseWithEllipsis(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 3) {
    return '.'.repeat(maxChars);
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

function normalizeHex(value: string): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!match) {
    throw new Error('Invalid hex color');
  }
  const [hex] = match;
  if (match[1].length === 3) {
    const expanded = match[1]
      .split('')
      .map((char) => char + char)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }
  return hex.toLowerCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return [r, g, b];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function colorToRgb(color: string): [number, number, number] | null {
  const trimmed = color.trim().toLowerCase();
  if (trimmed === 'transparent') {
    return null;
  }

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(trimmed);
  if (hexMatch) {
    return hexToRgb(trimmed);
  }

  const rgbMatch = /^rgba?\(\s*([^)]+)\s*\)$/.exec(trimmed);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => part.trim());
    if (parts.length < 3) {
      return null;
    }
    const rgb = parts.slice(0, 3).map(parseRgbPart);
    if (rgb.some((value) => value === null)) {
      return null;
    }
    return rgb as [number, number, number];
  }

  const hslMatch = /^hsla?\(\s*([^)]+)\s*\)$/.exec(trimmed);
  if (hslMatch) {
    const parts = hslMatch[1].split(',').map((part) => part.trim());
    if (parts.length < 3) {
      return null;
    }
    const h = parseFloat(parts[0]);
    const s = parsePercentage(parts[1]);
    const l = parsePercentage(parts[2]);
    if ([h, s, l].some((value) => Number.isNaN(value))) {
      return null;
    }
    return hslToRgb(h, s, l);
  }

  if (trimmed in CSS_COLORS) {
    return hexToRgb(CSS_COLORS[trimmed]);
  }

  return null;
}

function parseRgbPart(value: string): number | null {
  if (value.endsWith('%')) {
    const percent = parseFloat(value.slice(0, -1));
    if (Number.isNaN(percent)) {
      return null;
    }
    return clamp(Math.round((percent / 100) * 255), 0, 255);
  }
  const numeric = parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return clamp(numeric, 0, 255);
}

function parsePercentage(value: string): number {
  if (!value.endsWith('%')) {
    return Number.NaN;
  }
  const numeric = parseFloat(value.slice(0, -1));
  if (Number.isNaN(numeric)) {
    return Number.NaN;
  }
  return clamp(numeric / 100, 0, 1);
}

function hslToRgb(
  hDegrees: number,
  s: number,
  l: number,
): [number, number, number] {
  const h = ((hDegrees % 360) + 360) % 360 / 360;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  ];
}

function hueToRgb(p: number, q: number, t: number): number {
  let temp = t;
  if (temp < 0) temp += 1;
  if (temp > 1) temp -= 1;
  if (temp < 1 / 6) return p + (q - p) * 6 * temp;
  if (temp < 1 / 2) return q;
  if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
  return p;
}

function rgbToLuminance([r, g, b]: [number, number, number]): number {
  const channels = [r, g, b].map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928
      ? scaled / 12.92
      : Math.pow((scaled + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
