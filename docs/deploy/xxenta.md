# Deploying the xXenta instance

What this repository ships for the xXenta cluster, and the order of the first deployment.
The cluster itself, the chart, the values files and the secrets are owned by
`xxenta.infrastructure` (single-node k3s, CloudNativePG, Traefik with cert-manager,
Helm over SSH). This document is the application side of that boundary; the contract it
answers is `docs/app-deployment-contract.md` in that repository.

## Images

Four images, one per service, built by `docs/deploy/publish-xxenta-images.yml` once it is
copied to `.github/workflows/`. Every push to `main` publishes:

```
ghcr.io/<owner>/planning-api:sha-<12 chars>
ghcr.io/<owner>/planning-web:sha-<12 chars>
ghcr.io/<owner>/planning-worker:sha-<12 chars>
ghcr.io/<owner>/planning-bot:sha-<12 chars>
```

`<owner>` is the lower-cased owner of this repository, so the names follow the repository
when it moves to the organization. The tag is the commit, which is what makes it
immutable; the values file in the infrastructure repository names it, and a rollback is a
revert of that file. While the repository is private the packages are private too, and
the namespace needs an image pull secret with `read:packages`.

## How the images meet the contract

| Contract clause | This application |
|---|---|
| amd64, GHCR, immutable tag | The workflow above. |
| Listens on 8080 | The api reads `API_PORT`, web reads `PORT`; the images default to 3000 and 3001. Set them in the chart or point the Service at the defaults. |
| Non-root user | The images run as `bun` or `node` (uid 1000) and accept any `runAsUser`; nothing depends on the uid. |
| Read-only filesystem except `/tmp` | Each image needs `/tmp`. The api also writes `/backups` when it takes a pre-migration dump, and web writes `/app/apps/web/.next/cache` (the `next/image` cache). Mount an `emptyDir` on each. |
| Exits on SIGTERM within 30 seconds | Bun and Node exit on SIGTERM; no handler holds the process. |
| `/health/live` and `/health/ready` | The api answers both; ready runs `select 1` and answers 503 while the database does not answer. Web answers both with 200 once the server is up; it has no database. Worker and bot expose no port. |
| Configuration by environment, migrator and runtime connection strings separate | Every value is an environment variable (table below). The migration Job and the api Deployment take different `DATABASE_URL` values from different Secrets when the roles are split. |
| JSON logs | Not met. Every service logs plain text lines to stdout. |
| Never migrates on startup; same image migrates with an alternate command | The image's default command migrates and then serves, for the upstream compose file. The chart sets the api Deployment's command to `bun run apps/api/src/index.ts` and the pre-upgrade Job's to `bun run packages/db/src/migrate.ts` with `SKIP_PRE_MIGRATION_BACKUP=1`, since CloudNativePG holds the point-in-time recovery a pre-migration dump would duplicate. |
| Rate limiting in the application | Not met beyond better-auth's own limits on the auth endpoints. Staff-only users; revisit with the infrastructure repository's trigger. |

The bot must run as exactly one replica: Telegram hands each poll to a single caller.

## Environment

The values the chart has to supply. Secrets are the ones the infrastructure repository
applies from its `.env` files; the names below are the contract.

| Variable | Services | Value |
|---|---|---|
| `DATABASE_URL` | api, worker, bot, migration Job | `postgres://<role>:<password>@<cluster>-rw.xxenta-prod:5432/planning`. The migration Job's role owns the schema; the runtime role needs read and write on every table, or is the same role. |
| `BETTER_AUTH_SECRET` | api | Random, at least 32 bytes. |
| `APP_ENCRYPTION_KEY` | api, worker, bot | Random 32 bytes, base64. Encrypts the provider credentials at rest; changing it makes the stored credentials unreadable. |
| `API_URL` | api, web | `https://planning-api.xxenta.eu` |
| `APP_URL` | api | `https://planning.xxenta.eu` |
| `SERVICE_URL_API` | web | The in-cluster api Service, for example `http://planning-api:3000`. Web streams avatars and attachments from it. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | api | The attachment store; see below. |
| `SSRF_ALLOWED_HOSTS` | api, worker | Private hosts the api may call for webhooks and imports. Empty unless an organization service is on a private address. |
| `SKIP_PRE_MIGRATION_BACKUP` | migration Job | `1`. |
| `PRIVACY_URL`, `TERMS_URL` | web | Empty hides the legal notice on the logged-out screens. |
| `COOKIE_DOMAIN`, `PASSKEY_RP_ID`, `PASSKEY_RP_NAME` | api | Not needed: the cookie domain `.xxenta.eu` and the passkey relying party derive from `APP_URL`, and the relying party name defaults to the product name. |
| `TELEMETRY_DISABLED` | worker | Unset; telemetry stays on (decision 0010). |

`NODE_ENV=production` is set in the images.

## Attachments

The api needs an S3-compatible bucket. Two options; the choice is not made yet:

1. **A Scaleway Object Storage bucket** in `nl-ams`, beside the one CloudNativePG archives to.
   `S3_ENDPOINT=https://s3.nl-ams.scw.cloud`, `S3_REGION=nl-ams`, an API key scoped to the
   bucket. Nothing runs in the cluster, and the bucket is durable and versioned by the
   provider.
2. **MinIO in the namespace** with a PersistentVolume under `/data`. Self-contained, but the
   volume is outside the CloudNativePG backups and needs its own copy off the host.

The first is the simpler operation and closes the backup gap; it needs a bucket and a key
created in the Scaleway console.

## Database

One CloudNativePG cluster per namespace, PostgreSQL 18. The api's migrations run as the
pre-upgrade Job from the same image against the same database; the schema is owned by the
Job's role. The image carries the PostgreSQL 18 client, so the dump the upstream compose
file takes before migrating also works against this server, though the Job skips it.

## Hostnames

| Host | Service | Notes |
|---|---|---|
| `planning.xxenta.eu` | web | Login screen, the application. |
| `planning-api.xxenta.eu` | api | The auth handler, the REST API, `/mcp`, `/scim/v2`, `/media`. |

Siblings under `.xxenta.eu`, so the session cookie is shared without configuration. One
certificate per host from cert-manager over HTTP-01. The api's CORS allow-list is
`APP_URL`.

## First deployment

1. **Google Cloud.** In the organization's project, create an OAuth client of type Web
   application with user type Internal, so only Workspace accounts of the organization
   pass consent. The authorized redirect URI is the value god mode shows under
   Integrations, Auth provider, Google (`https://planning-api.xxenta.eu/api/auth/callback/google`).
   Keep the client ID and secret for step 6.
2. **Microsoft Entra.** Register an application in the organization's tenant, single
   tenant. Under Authentication add a Web redirect URI with the value god mode shows under
   Auth provider, Microsoft 365 (`https://planning-api.xxenta.eu/api/auth/oauth2/callback/microsoft`).
   Under Certificates & secrets create a client secret and note its expiry. The default
   `User.Read` permission with the `openid`, `profile` and `email` scopes is enough. Keep the
   directory (tenant) ID (god mode accepts only that id, never `common`), the application
   (client) ID and the secret for step 6. Guest accounts of the tenant carry their external
   address; the allowed-domains list keeps them out.
3. **Mailbox.** An SMTP account the instance sends from (invitations, password resets,
   notifications). Host, port, encryption, username, password, and the From address.
4. **Infrastructure.** Bucket and key for attachments (see Attachments), the two DNS
   records, the Secrets from the table above, the values file naming the four image tags,
   and `helm upgrade --install` as the infrastructure runbook describes. The migration Job
   runs first; the api reports ready once `select 1` answers.
5. **First account.** Open `https://planning.xxenta.eu` and register with the email form;
   the first account becomes the instance owner (god). Use an organization address.
6. **God mode, in this order.**
   1. Integrations, Email provider: the SMTP values, then Send test email.
   2. Integrations, Auth provider: Google client ID and secret, enabled; Microsoft tenant
      ID, client ID and secret, enabled. Save.
   3. Sign out and sign in once with a Google Workspace account and once with a Microsoft
      365 account, so both round trips are known to work before the password form goes.
   4. Authentication: Allowed email domains `xxenta.eu` (one per line for more); Trust
      addresses from sign-in providers on; Registration open; Email and password off.
      Save.
7. **Verify.** A personal Gmail or Outlook account is refused with
   `EMAIL_DOMAIN_NOT_ALLOWED` on the login screen. An attachment uploaded to an issue is
   served back through `/media`. `https://planning-api.xxenta.eu/health/ready` answers 200.
8. **Roll back once on purpose** by reverting the values file, as the infrastructure
   runbook asks, and record the date there.

## Upgrading

Merge upstream into `main` (decision 0007), let the workflow publish the four tags, change
the tags in the values file. The migration Job applies whatever the release added; the
database's point-in-time recovery is the way back if a migration cannot be undone.
