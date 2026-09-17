import { beforeEach, describe, expect, it } from 'bun:test';
import { api, app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup } from '../helpers';

// The generic OAuth endpoints live behind the better-auth catch-all, which Eden
// Treaty does not model, so they are driven through the app handler directly.
function startMicrosoftSignIn() {
  return app.handle(
    new Request('http://localhost/api/auth/sign-in/oauth2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: 'microsoft', callbackURL: 'http://localhost:3001/' }),
    }),
  );
}

function microsoftCallback() {
  return app.handle(
    new Request('http://localhost/api/auth/oauth2/callback/microsoft?code=x&state=y'),
  );
}

const credentials = {
  tenantId: '5f9e8b3a-1c2d-4e6f-8a7b-9c0d1e2f3a4b',
  clientId: 'entra-app',
  clientSecret: 'entra-secret',
};

describe('god Microsoft settings', () => {
  beforeEach(resetDb);

  it('refuses a plain user', async () => {
    await setup();
    const user = await addUser({ email: 'someone@example.com' });

    expect((await user.api.god['microsoft-settings'].get()).status).toBe(403);
    expect((await user.api.god['microsoft-settings'].put({ enabled: false })).status).toBe(403);
  });

  it('reports an unconfigured provider with the redirect URI to register', async () => {
    const { god } = await setup();

    const res = await god.api.god['microsoft-settings'].get();

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      enabled: false,
      tenantId: '',
      clientId: '',
      hasClientSecret: false,
      redirectUri: 'http://localhost:3000/api/auth/oauth2/callback/microsoft',
    });
  });

  it('refuses to enable the provider without complete credentials', async () => {
    const { god } = await setup();

    const res = await god.api.god['microsoft-settings'].put({
      ...credentials,
      tenantId: '',
      enabled: true,
    });

    expect(res.status).toBe(400);
    expect(res.error!.value).toMatchObject({
      error: 'Add the tenant ID, client ID and secret first',
    });
  });

  it('refuses a tenant id that is not a directory id', async () => {
    const { god } = await setup();

    const res = await god.api.god['microsoft-settings'].put({ ...credentials, tenantId: 'common' });

    expect(res.status).toBe(400);
  });

  it('stores the credentials, never returns the secret, and offers the sign-in', async () => {
    const { god } = await setup();
    expect((await startMicrosoftSignIn()).status).toBe(403);

    const saved = await god.api.god['microsoft-settings'].put({ ...credentials, enabled: true });

    expect(saved.status).toBe(200);
    expect(saved.data).toMatchObject({
      enabled: true,
      tenantId: credentials.tenantId,
      clientId: credentials.clientId,
      hasClientSecret: true,
    });
    expect(JSON.stringify(saved.data)).not.toContain(credentials.clientSecret);
    expect((await api['auth-config'].get()).data).toMatchObject({ microsoft: true });

    const started = await startMicrosoftSignIn();
    expect(started.status).toBe(200);
    expect(((await started.json()) as { url: string }).url).toStartWith(
      `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/authorize?`,
    );
  });

  it('routes the callback to the Microsoft provider', async () => {
    const { god } = await setup();
    const refused = await microsoftCallback();
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'MICROSOFT_DISABLED' });

    await god.api.god['microsoft-settings'].put({ ...credentials, enabled: true });

    const res = await microsoftCallback();
    expect(res.status).not.toBe(403);
    expect(await res.text()).not.toContain('_DISABLED');
  });

  it('counts as a single sign-on provider when password sign-in is turned off', async () => {
    const { god } = await setup();
    await god.api.god['microsoft-settings'].put({ ...credentials, enabled: true });

    const res = await god.api.god['auth-settings'].put({ emailPassword: false });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ emailPassword: false, hasSsoProvider: true });
    const disabled = await god.api.god['microsoft-settings'].put({ enabled: false });
    expect(disabled.status).toBe(400);
  });
});
