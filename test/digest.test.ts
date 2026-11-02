import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readNight } from '../src/digest/types.js';

function tempRuns(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-test-'));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

const VALID = [
  `{"at":"2026-10-29T01:30:00+01:00","job":"a","status":"retry","owner":"rook","error":"boom"}`,
  `{"at":"2026-10-29T01:31:00+01:00","job":"a","status":"ok","owner":"rook"}`,
  `{"at":"2026-10-29T01:00:00+01:00","job":"b","status":"ok","owner":null}`,
].join('\n');

describe('digest reader', () => {
  it('readNight returns one row per job from a valid log', () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-10-28.jsonl'), VALID);
    const rows = readNight(dir, '2026-10-28');
    expect(rows.map((r) => r.job)).toEqual(['a', 'b']);
    const [a, b] = rows;
    expect(a).toMatchObject({ runs: 2, retries: 1, lastStatus: 'ok', lastError: null });
    expect(a.first).toBe('2026-10-29T01:30:00+01:00');
    expect(a.last).toBe('2026-10-29T01:31:00+01:00');
    expect(b).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });

  it('readNight wastes a bad line but still renders the night', () => {
    const dir = tempRuns();
    writeFileSync(join(dir, '2026-10-28.jsonl'), `${VALID}\n{"at":"2026-10-29T05:59:58","job":"lane/sy`);
    const rows = readNight(dir, '2026-10-28');
    expect(rows).toHaveLength(2);
  });

  it('readNight reads the real runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const rows = readNight('runs', '2026-10-28');
    expect(rows).toHaveLength(5);
    const lines = readdirSync('runs').filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
    expect(lines).toContain('2026-10-28.jsonl');
  });
});