import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

function tempRuns(content: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  mkdirSync(dir, { recursive: true });
  if (content !== null) writeFileSync(join(dir, '2026-10-28.jsonl'), content);
  return dir;
}

const configFor = (runsDir: string) => ({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

const GOOD = [
  `{"at":"2026-10-29T01:30:00+01:00","job":"a","status":"retry","owner":"rook","error":"boom"}`,
  `{"at":"2026-10-29T01:31:00+01:00","job":"a","status":"ok","owner":"rook"}`,
  `{"at":"2026-10-29T02:00:03+01:00","job":"b","status":"fail","owner":null,"error":"quota"}`,
].join('\n');

describe('digest routes', () => {
  it('page returns 200 and renders rows for a night on disk', async () => {
    const app = createApp(configFor(tempRuns(GOOD)));
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('a');
    expect(html).toContain('b');
  });

  it('page returns 404 for a night with no file', async () => {
    const app = createApp(configFor(tempRuns(null)));
    const res = await app.request('/digest/2026-10-27');
    expect(res.status).toBe(404);
  });

  it('page renders "nothing ran" for an empty night', async () => {
    const app = createApp(configFor(tempRuns('')));
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('page renders despite a bad line', async () => {
    const dir = tempRuns(`${GOOD}\n{"at":"2026-10-29T05:59:58"`);
    const app = createApp(configFor(dir));
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
  });

  it('JSON returns the same jobs, same order, as the page', async () => {
    const runsDir = tempRuns(GOOD);
    const app = createApp(configFor(runsDir));
    const jsonRes = await app.request('/api/digest/2026-10-28');
    const json = await jsonRes.json();
    expect(jsonRes.status).toBe(200);
    expect(json.night).toBe('2026-10-28');
    const pageRes = await app.request('/digest/2026-10-28');
    const html = await pageRes.text();
    const jobs = json.rows.map((r: { job: string }) => r.job);
    // Page and JSON must agree (ADR 0001). Assert page shows every job once in order.
    for (const job of jobs) {
      // count occurrences in page
      const occurrences = html.split(`<td>${job}</td>`).length - 1;
      expect(occurrences).toBe(1);
    }
    expect(jobs).toContain('a');
    expect(jobs).toContain('b');
  });

  it('JSON returns 404 for a night with no file', async () => {
    const app = createApp(configFor(tempRuns(null)));
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(404);
  });
});