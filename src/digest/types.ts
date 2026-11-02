import { readFileSync } from 'node:fs';

export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log (styleguide):
// never convert to UTC for display.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  first: string;
  last: string;
};

type Line = { at: string; job: string; status: JobStatus; owner: string | null; error?: string };

// Read runs/<night>.jsonl into one row per job. A line that doesn't parse is counted, never
// thrown: the night still renders. Throws only when the night's file is not on disk.
export function readNight(runsDir: string, night: string): DigestRow[] {
  const rows = new Map<string, Line[]>();
  const text = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let parsed: Line;
    try {
      parsed = JSON.parse(line) as Line;
    } catch {
      continue; // a bad line never throws
    }
    const job = parsed.job;
    rows.set(job, [...(rows.get(job) ?? []), parsed]);
  }

  const out: DigestRow[] = [];
  for (const [job, lines] of rows) {
    const sorted = [...lines].sort((a, b) => a.at.localeCompare(b.at));
    const last = sorted[sorted.length - 1];
    out.push({
      job,
      owner: last.owner,
      runs: sorted.length,
      retries: sorted.filter((l) => l.status === 'retry').length,
      lastStatus: last.status,
      lastError: last.error ?? null,
      first: sorted[0].at,
      last: last.at,
    });
  }
  return out.sort((a, b) => a.job.localeCompare(b.job));
}