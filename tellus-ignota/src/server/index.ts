import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { Devvit } from '@devvit/public-api';
import { api } from './routes/api';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { createDailyPost } from './core/post';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});

Devvit.addSchedulerJob({
  name: 'daily-post-job',
  onRun: async (_event, _context) => {
    try {
      await createDailyPost();
      console.log('Successfully created daily post via scheduler.');
    } catch (e) {
      console.error('Failed to create daily post:', e);
    }
  },
});
