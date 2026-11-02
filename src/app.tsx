import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { readNight } from './digest/types.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';
import { DigestView } from './views/digest.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    let rows;
    try {
      rows = readNight(config.runsDir, night);
    } catch {
      return c.text('no night on disk', 404);
    }
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestView night={night} rows={rows} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    let rows;
    try {
      rows = readNight(config.runsDir, night);
    } catch {
      return c.json({ error: 'no night on disk' }, 404);
    }
    return c.json({ night, rows });
  });

  return app;
}
