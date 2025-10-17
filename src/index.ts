import { buildSVG } from './svg';
import { Align, autoContrast, parseColor, parseDims } from './util';

interface RenderOptions {
  width: number;
  height: number;
  background: string;
  foreground: string;
  scale: number;
  searchParams: URLSearchParams;
}

const DEFAULT_BACKGROUND = '#dddddd';
const MAX_TEXT_LENGTH = 120;

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildHeaders(),
      });
    }

    try {
      const url = new URL(request.url);
      const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const lookup = segments.filter(Boolean).map(decodeURIComponent);

      if (!lookup.length) {
        return usageResponse();
      }

      const { width, height } = parseDims(lookup[0]);
      const bgSegment = lookup[1];
      const fgSegment = lookup[2];

      const background = bgSegment ? parseColor(bgSegment) : DEFAULT_BACKGROUND;
      const foreground = fgSegment
        ? parseColor(fgSegment)
        : autoContrast(background);

      const scale = parseScale(url.searchParams.get('scale'));

      const { svg, etag } = await renderSvg({
        width,
        height,
        background,
        foreground,
        scale,
        searchParams: url.searchParams,
      });

      const responseHeaders = buildHeaders({
        extra: [
          ['Content-Type', 'image/svg+xml; charset=utf-8'],
          ['Cache-Control', 'public, max-age=31536000, immutable'],
          ['ETag', etag],
        ],
      });

      if (request.headers.get('If-None-Match') === etag) {
        return new Response(null, {
          status: 304,
          headers: responseHeaders,
        });
      }

      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: responseHeaders,
        });
      }

      return new Response(svg, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (error) {
      return usageResponse(error instanceof Error ? error.message : undefined);
    }
  },
};

async function renderSvg(options: RenderOptions) {
  const {
    width,
    height,
    background,
    foreground,
    scale,
    searchParams,
  } = options;

  const textParam = searchParams.get('says');
  const rawText = textParam ? textParam.trim() : '';
  const text = clampText(rawText);

  const fontFamily = searchParams.get('font')?.trim() || undefined;
  const fontWeight = searchParams.get('weight')?.trim() || undefined;

  const sizeParam = parseFloatSafe(searchParams.get('size'));
  const padParam = parseFloatSafe(searchParams.get('pad'));
  const radiusParam = parseFloatSafe(searchParams.get('radius'));
  const strokeParam = searchParams.get('stroke');
  const strokeWidthParam = parseFloatSafe(searchParams.get('sw'));
  const shadow = parseBoolean(searchParams.get('shadow'));

  const baseSize = Math.min(width, height) / 6;
  const fontSize = clampNumber(
    Number.isFinite(sizeParam) ? sizeParam : baseSize,
    12,
    128,
  );

  const pad = clampNumber(
    Number.isFinite(padParam) ? padParam : 0,
    0,
    Math.min(width, height) / 2,
  );

  const radius = clampNumber(
    Number.isFinite(radiusParam) ? radiusParam : 0,
    0,
    Math.min(width, height) / 2,
  );

  const strokeColor = strokeParam ? parseColor(strokeParam) : undefined;
  const strokeWidth = clampNumber(
    Number.isFinite(strokeWidthParam) ? strokeWidthParam : 0,
    0,
    Math.min(width, height) / 5,
  );

  const align = parseAlign(searchParams.get('align'));
  const wrap = parseBoolean(searchParams.get('wrap'));

  const svg = buildSVG({
    width,
    height,
    background,
    foreground,
    text: text || undefined,
    fontFamily,
    fontSize,
    fontWeight,
    pad,
    align,
    wrap,
    scale,
    radius: radius * scale,
    stroke: strokeColor,
    strokeWidth: strokeWidth ? strokeWidth * scale : undefined,
    shadow,
  });

  const etagPayload = JSON.stringify({
    width,
    height,
    background,
    foreground,
    text,
    fontFamily,
    fontSize,
    pad,
    fontWeight,
    align,
    wrap,
    scale,
    radius: radius * scale,
    stroke: strokeColor,
    strokeWidth: strokeWidth ? strokeWidth * scale : undefined,
    shadow,
  });
  const etagHash = await hashString(etagPayload);
  const etag = `"${etagHash}"`;

  return { svg, etag };
}

function clampText(value: string): string {
  if (!value) {
    return '';
  }
  if (value.length <= MAX_TEXT_LENGTH) {
    return value;
  }
  if (MAX_TEXT_LENGTH <= 3) {
    return '.'.repeat(MAX_TEXT_LENGTH);
  }
  return `${value.slice(0, MAX_TEXT_LENGTH - 3)}...`;
}

function parseFloatSafe(value: string | null): number {
  if (!value) {
    return Number.NaN;
  }
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function parseScale(raw: string | null): number {
  if (!raw) {
    return 1;
  }
  const numeric = parseInt(raw, 10);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return numeric === 2 ? 2 : 1;
}

function parseAlign(value: string | null): Align {
  switch ((value ?? '').toLowerCase()) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'center':
    default:
      return 'center';
  }
}

function parseBoolean(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

async function hashString(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function usageResponse(message?: string) {
  const text = [
    'Usage: /:widthxheight/:bg?/:fg?',
    'Example: /600x300/red/white?says=Hello+World',
    message ? `Error: ${message}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return new Response(text, {
    status: 400,
    headers: buildHeaders({
      extra: [['Content-Type', 'text/plain; charset=utf-8']],
    }),
  });
}

function buildHeaders(options?: {
  extra?: [string, string][];
}): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
  });

  if (options?.extra) {
    for (const [key, value] of options.extra) {
      headers.set(key, value);
    }
  }

  return headers;
}
