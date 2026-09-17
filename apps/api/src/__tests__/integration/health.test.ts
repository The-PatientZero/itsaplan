import { describe, it, expect } from 'bun:test';
import { api } from '../helpers/app';

// Smoke test for the Eden Treaty setup. These routes need no session, and all but the
// readiness probe need no database — if the others fail, the treaty/app wiring is
// broken, not the DB.
describe('health', () => {
  it('GET / returns the liveness payload', async () => {
    const { data, status } = await api.get();

    expect(status).toBe(200);
    expect(data).toEqual({ name: 'Planning Tool api', status: 'ok' });
  });

  it('GET /health/live and /health/ready answer 200 while the database answers', async () => {
    expect((await api.health.live.get()).status).toBe(200);
    expect((await api.health.ready.get()).status).toBe(200);
  });

  it('GET /me without a session reports unauthenticated', async () => {
    const { data, status } = await api.me.get();

    expect(status).toBe(200);
    expect(data).toEqual({ authenticated: false });
  });

  it('GET /projects without a session is rejected with 401', async () => {
    const { error } = await api.projects.get();

    expect(error?.status).toBe(401);
  });
});
