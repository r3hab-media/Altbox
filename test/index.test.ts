import { describe, expect, it } from 'vitest';

import worker from '../src/index';

async function fetchSvg(path: string) {
  const request = new Request(`https://example.com${path}`);
  const response = await worker.fetch(request);
  const body = await response.text();
  return { response, body };
}

describe('routes', () => {
  it('handles /:dims route', async () => {
    const { response, body } = await fetchSvg('/600x300');
    expect(response.status).toBe(200);
    expect(body).toContain('width="600"');
    expect(body).toContain('height="300"');
    expect(body).toContain('fill="#dddddd"');
  });

  it('handles /:dims/:bg route', async () => {
    const { response, body } = await fetchSvg('/600x300/red');
    expect(response.status).toBe(200);
    expect(body).toContain('fill="#ff0000"');
  });

  it('handles /:dims/:bg/:fg route with text', async () => {
    const { response, body } = await fetchSvg('/600x300/red/yellow?says=Hello+World');
    expect(response.status).toBe(200);
    expect(body).toContain('fill="#ff0000"');
    expect(body).toContain('fill="#ffff00"');
    expect(body).toContain('Hello World');
  });

  it('supports transparent backgrounds', async () => {
    const { response, body } = await fetchSvg('/600x300/t/red?says=Hello+World');
    expect(response.status).toBe(200);
    expect(body).toContain('fill="none"');
    expect(body).toContain('fill="#ff0000"');
    expect(body).toContain('Hello World');
  });
});
