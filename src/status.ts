import { readdirSync, readFileSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: { night: string; ok: number; retry: number; fail: number }[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({
      night,
      ...countsFor(config.runsDir, night),
    })),
  };
}

// Per-status line counts for a night; a bad line is skipped. Used by the board's digest links.
function countsFor(runsDir: string, night: string): { ok: number; retry: number; fail: number } {
  const out = { ok: 0, retry: 0, fail: 0 };
  let text: string;
  try {
    text = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let o: { status?: string };
    try {
      o = JSON.parse(line) as { status?: string };
    } catch {
      continue;
    }
    if (o.status === 'ok' || o.status === 'retry' || o.status === 'fail') out[o.status] += 1;
  }
  return out;
}
