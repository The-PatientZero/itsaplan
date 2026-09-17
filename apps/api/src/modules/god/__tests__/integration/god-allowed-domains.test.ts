import { beforeEach, describe, expect, it } from 'bun:test';
import { api, app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { setup } from '../helpers';

// The password endpoints live behind the better-auth catch-all, which Eden Treaty
// does not model, so they are driven through the app handler directly.
function signUp(email: string) {
  return app.handle(
    new Request('http://localhost/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-password-123', name: 'Someone' }),
    }),
  );
}

describe('allowed email domains', () => {
  beforeEach(resetDb);

  it('stores the list normalized and reports it publicly', async () => {
    const { god } = await setup();

    const res = await god.api.god['auth-settings'].put({
      allowedEmailDomains: [' @XXenta.eu', 'xxenta.eu', '', 'Example.org'],
    });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ allowedEmailDomains: ['xxenta.eu', 'example.org'] });
    expect((await api['auth-config'].get()).data).toMatchObject({
      allowedEmailDomains: ['xxenta.eu', 'example.org'],
    });
  });

  it('refuses an entry that is not a domain', async () => {
    const { god } = await setup();

    const res = await god.api.god['auth-settings'].put({ allowedEmailDomains: ['xxenta'] });

    expect(res.status).toBe(400);
    expect((await god.api.god['auth-settings'].get()).data).toMatchObject({
      allowedEmailDomains: [],
    });
  });

  it('creates accounts only for addresses in a listed domain, matched exactly', async () => {
    const { god } = await setup();
    await god.api.god['auth-settings'].put({ allowedEmailDomains: ['xxenta.eu'] });

    const refused = await signUp('someone@gmail.com');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'EMAIL_DOMAIN_NOT_ALLOWED' });
    expect((await signUp('someone@sub.xxenta.eu')).status).toBe(403);
    expect((await signUp('Someone@XXenta.eu')).status).toBe(200);
  });
});
