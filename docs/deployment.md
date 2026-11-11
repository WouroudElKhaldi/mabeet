# Deployment: the live site

How Mabeet goes live, what runs on the server, and everything to set up once: the domain, the server and GitHub.
The site has one address, `https://mabeet-lb.com`: never plain http, never the server's IP address. Omar owns the deployment (`docs/team/01-work-split.md`), but anyone on the team can follow this file.

## In short

Every merge to `main` goes live by itself, once the checks pass. Nobody copies files or types commands on the
server for a normal release.

```
merge to main
   │
   ▼
GitHub Actions (.github/workflows/ci.yml)
   1. checks           typecheck, lint, format, knip, unit tests, docs up to date
   2. integration      integration tests on a real Postgres
   3. deploy           only on main, only if 1 and 2 passed
        build the image once ──► push it to ghcr.io/wouroudelkhaldi/mabeet:<commit>
        write the server's .env from GitHub's secrets and variables
        copy docker-compose.prod.yml, deploy/ and .env to the server (/opt/mabeet)
        run deploy/remote-deploy.sh on the server:
            pull the image → back up the database → migrate → (first deploy: get the certificate) → start
        check the site answers
   │
   ▼
DigitalOcean droplet: nginx ─► website ─► Postgres, Redis   (+ the worker)
```

`development` and pull requests run the checks only. They never deploy.

## What runs on the server

One droplet runs everything with Docker Compose, from `docker-compose.prod.yml`:

| Service   | What it does                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `nginx`   | The front door on ports 80 and 443. Serves the website on `https://<DOMAIN>` only; the IP gets nothing      |
| `web`     | The website (`pnpm start`). Only nginx reaches it                                                           |
| `worker`  | The job worker (`pnpm worker`): emails, AI work, calendar sync, housekeeping. It runs every schedule itself |
| `migrate` | Runs once on every deploy (`prisma migrate deploy`), then stops. The website and worker wait for it         |
| `db`      | Postgres 17. Its data is in the `db-data` volume, which survives every deploy                               |
| `redis`   | Rate-limit counters. Nothing in it needs to survive a restart                                               |
| `certbot` | Renews the https certificate, which the first deploy got                                                    |

`web`, `worker` and `migrate` are the same image, built once by GitHub Actions. The server never sees the code and
never builds anything: it only pulls the finished image. `nginx` and `certbot` belong to the `server` profile, so
they only run on the server, not when you try the production shape on your computer.

The server's folder, `/opt/mabeet`, holds only what the deploy job copies there, plus the backups:

```
/opt/mabeet/
  .env                        written by every deploy from GitHub (never edit it by hand: the next deploy replaces it)
  docker-compose.prod.yml
  deploy/
    remote-deploy.sh          what each deploy runs on the server
    nginx/
      https.conf.template               the website on https://<DOMAIN>, www and http sent to it
      certificate-check.conf.template   first deploy only: answers Let's Encrypt's check, nothing else
  backups/                    a copy of the database before each deploy (the newest 14)
```

Because the `.env` names `COMPOSE_FILE` and `COMPOSE_PROFILES`, every command on the server is a plain
`docker compose ...`, run from `/opt/mabeet`.

## Setting it up, once

Four parts, in this order: the server, GitHub, the domain, then the first deploy.

### 1. The server (DigitalOcean droplet)

1. **Create the droplet.** Ubuntu 24.04 LTS, at least **2 GB of memory** (Postgres, Redis, the website and the
   worker together do not fit in 1 GB). Add your own SSH key when you create it.
2. **Log in as root** from your computer (Git Bash on Windows):

   ```bash
   ssh -i ~/.ssh/<your-key> root@<SERVER_IP>
   ```

3. **Update it, and turn on automatic security updates:**

   ```bash
   apt update && apt upgrade -y
   dpkg-reconfigure -plow unattended-upgrades
   ```

4. **Create the `deploy` user** that GitHub Actions logs in as, and give it your SSH key:

   ```bash
   adduser --disabled-password --gecos "" deploy
   usermod -aG sudo deploy
   mkdir -p /home/deploy/.ssh
   cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh
   chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
   passwd deploy   # a password for sudo only; logging in stays key-only
   ```

5. **Install Docker** (with the Compose plugin) from Docker's own instructions, and let `deploy` use it:

   ```bash
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker deploy
   systemctl enable --now docker
   apt install -y rsync
   ```

6. **Make the site's folder**, owned by `deploy`:

   ```bash
   mkdir -p /opt/mabeet
   chown deploy:deploy /opt/mabeet
   ```

7. **Add swap**, so a busy moment slows the site down instead of stopping it:

   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

8. **Turn on the firewall**: SSH, http and https only.

   ```bash
   ufw allow OpenSSH
   ufw allow 80
   ufw allow 443
   ufw enable
   ```

   Docker opens its published ports past `ufw`, which is why `docker-compose.prod.yml` publishes only nginx's 80
   and 443 (the website's 3000 is for the server itself only, and Postgres and Redis are not published at all).

9. **Close root and password logins.** First check, from a second terminal, that
   `ssh -i ~/.ssh/<your-key> deploy@<SERVER_IP>` works. Then, in `/etc/ssh/sshd_config`, set:

   ```
   PermitRootLogin no
   PasswordAuthentication no
   AllowUsers deploy
   ```

   and run `systemctl restart ssh`.

10. **Make a key for GitHub Actions**, on your computer. It is only for deploys, so it can be replaced without
    touching your own key:

    ```bash
    ssh-keygen -t ed25519 -f ~/.ssh/mabeet-deploy -C "github-actions-deploy" -N ""
    ```

    Add the public half (`~/.ssh/mabeet-deploy.pub`) on a new line of `/home/deploy/.ssh/authorized_keys` on the
    server. The private half (`~/.ssh/mabeet-deploy`) goes into GitHub as `SSH_PRIVATE_KEY` (next part).

### 2. GitHub (the repository's settings)

Someone with admin rights on the repository does this (Wouroud owns it).

1. **Create the environment.** Settings → Environments → New environment → `production`. Under "Deployment
   branches and tags", choose "Selected branches and tags" and add `main`, so only `main` can read its secrets.
2. **Add the secrets and variables below** in that environment (Settings → Environments → `production` → "Add
   environment secret" / "Add environment variable"). Secrets are hidden once saved; variables stay readable, so
   only values that are not private go there.

Nothing else in the settings changes: the deploy job asks for its own permission to push the image
(`packages: write`).

Generate each random value with `openssl rand -hex 32` (letters and digits only, which matters for
`POSTGRES_PASSWORD`, since it is also part of the database address). Never use a value from `.env.example` or from
your own `.env`. No value may contain a single quote (`'`).

**Required** (the deploy stops before building if one is missing):

| Name                 | Kind     | Value                                                                                             |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `DOMAIN`             | Variable | `mabeet-lb.com`, without `www`. The site's one address is `https://<DOMAIN>`                      |
| `SERVER_IP`          | Variable | The droplet's public IPv4 address. Only for SSH: the site never answers on it                     |
| `SSH_USER`           | Variable | `root` on our droplet (`deploy` if you made that user in step 4)                                  |
| `SSH_PRIVATE_KEY`    | Secret   | The whole content of `~/.ssh/mabeet-deploy`, from `-----BEGIN` to `-----END ... KEY-----`         |
| `POSTGRES_PASSWORD`  | Secret   | `openssl rand -hex 32`. Set it once: Postgres keeps the first password it starts with (see below) |
| `BETTER_AUTH_SECRET` | Secret   | `openssl rand -hex 32`. Changing it later signs everyone out                                      |
| `CRON_SECRET`        | Secret   | `openssl rand -hex 32`                                                                            |

**When we have them** (each one empty turns its feature off, exactly as on your computer; `.env.example` explains
each):

| Name                                         | Kind     | Notes                                                                                                                                  |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                             | Secret   | Without it, emails are only written to the worker's log                                                                                |
| `EMAIL_FROM`                                 | Variable | `Mabeet <hello@our-domain>`, once the domain is verified on Resend; new accounts confirm their email, so without it no one can sign up |
| `R2_ACCOUNT_ID`, `R2_PUBLIC_BUCKET`          | Variable | The photo bucket. Without R2, photos are kept in Postgres                                                                              |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`   | Secret   | An R2 API token with "Object Read & Write" on that bucket only                                                                         |
| `R2_PUBLIC_URL`                              | Variable | The bucket's public address. It is built into the image, so a change needs a new deploy                                                |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Secret   | Stripe test mode. The webhook address is `<site>/api/webhooks/stripe`                                                                  |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`  | Variable | The two monthly price ids                                                                                                              |
| `WHISH_MODE`                                 | Variable | Empty or `simulator` until Whish gives us keys; then `sandbox` or `production`                                                         |
| `WHISH_CHANNEL`, `WHISH_SECRET`              | Secret   | From Whish                                                                                                                             |
| `WHISH_WEBSITE_URL`                          | Variable | From Whish                                                                                                                             |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`          | Variable | Push notifications (`pnpm exec web-push generate-vapid-keys` makes the pair)                                                           |
| `VAPID_PRIVATE_KEY`                          | Secret   | The private half of that pair                                                                                                          |
| `CONTACT_EMAIL`, `CONTACT_WHATSAPP`          | Variable | How people reach us from `/contact`                                                                                                    |
| `DEEPSEEK_API_KEY`                           | Secret   | The AI bonus only                                                                                                                      |
| `AI_MONTHLY_BUDGET_USD`                      | Variable | Empty means $50                                                                                                                        |

Not in GitHub, because the deploy job works them out: `BETTER_AUTH_URL` (`https://<DOMAIN>`), `DATABASE_URL` and `REDIS_URL` (`docker-compose.prod.yml` points them at
its own services), `JOBS_MODE` (`queue`, set in the image), and the image's name and tag.

**What the server pulls with.** The deploy job hands the server its own short-lived `GITHUB_TOKEN` to pull the
image from GitHub's registry, so there is no extra access token to create or renew.

**A new setting later** (`docs/team/02-architecture-and-features.md`, "Settings"): add it to `src/server/env.ts`
and `.env.example` as usual, then add its name to the deploy job in `.github/workflows/ci.yml` twice (in the
`env:` block, and in the `for name in ...` list that writes the `.env`), and its value in GitHub.

### 3. The domain (Cloudflare)

Our domain is `mabeet-lb.com`, at Cloudflare.

1. **Point it at the server.** In Cloudflare, DNS → Records: two `A` records, `@` and `www`, both →
   `<SERVER_IP>`, both **DNS only (grey cloud)**. Leave SSL/TLS as it is: with the grey cloud, Cloudflare only
   answers DNS, and the server makes its own https.
2. **Wait until it points there:** `nslookup mabeet-lb.com 8.8.8.8` and `nslookup www.mabeet-lb.com 8.8.8.8` answer
   with the droplet's address (with the orange cloud they answer with Cloudflare's, `104.21...` or `172.67...`).
   The first deploy needs both, because it asks Let's Encrypt for one certificate covering the two names.

**Cloudflare's proxy (orange cloud) is not set up.** Behind it, every visitor reaches nginx from a Cloudflare address,
so the rate limits would count all visitors as one. Turning it on needs nginx to read the visitor's address from
Cloudflare's `CF-Connecting-IP` header first, then SSL/TLS set to Full (strict), never Flexible (it would loop on
redirects).

### 4. The first deploy

1. Merge the deployment pull request into `development`, then release `development` into `main` (or, to try it
   first, open the Actions tab → CI → "Run workflow" on `main` once this file is on `main`).
2. Watch it in the Actions tab. This one also gets the certificate: `deploy/remote-deploy.sh` starts nginx with
   `certificate-check.conf.template` (it answers only Let's Encrypt's check), certbot gets one certificate for
   `mabeet-lb.com` and `www.mabeet-lb.com`, then nginx switches to `https.conf.template`. Every later deploy finds
   the certificate and skips this; the `certbot` service renews it twice a day if needed, and nginx reloads every
   6 hours. If it fails at the certificate, check the DNS (part 3) before running it again: Let's Encrypt refuses a
   domain for an hour after 5 failures.
3. Open `https://mabeet-lb.com`: the home page should answer. `http://` and `www` go there too, and
   `http://<SERVER_IP>` gets nothing.
4. **Create the platform admins**, on the server (in `/opt/mabeet`):

   ```bash
   docker compose run --rm web sh -c 'pnpm admins:create "Omar Antar <omar@example.com>" && cat .admin-credentials'
   ```

   It prints each admin's password once. Send each person only their own line, privately. Running it again gives
   new passwords and never makes copies.

5. **Then, the outside services:** verify the domain on Resend (its records in Cloudflare, DNS only) and set
   `EMAIL_FROM`; give R2 a custom domain (`images.mabeet-lb.com`) and set `R2_PUBLIC_URL` to it; point Stripe's
   webhook at `https://mabeet-lb.com/api/webhooks/stripe`. Each takes effect at the next deploy.

**Changing the domain later** means a new certificate: set `DOMAIN`, point both records at the server, and deploy.
The deploy finds no certificate for the new name and gets one. Sign-in cookies are tied to the site's address, so
everyone signs in once more.

## Day to day

**Releasing** is the pull request from `development` into `main` (`docs/team/README.md`, "GitHub"). Its merge
deploys. "Run workflow" on `main` deploys `main` again, for example after changing a secret: settings are only read
at deploy time.

**Looking at the server** (from `/opt/mabeet`):

| Command                                 | What it shows or does                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| `docker compose ps`                     | Which services run, and since when                         |
| `docker compose logs -f web worker`     | The website's and the worker's logs, live (Ctrl+C to stop) |
| `docker compose logs migrate`           | What the last migration run said                           |
| `docker compose restart web worker`     | Restarts the website and the worker                        |
| `docker compose exec db psql -U mabeet` | A database prompt (careful: this is the live data)         |
| `ls -lh backups/`                       | The database copies taken before each deploy               |
| `df -h` and `free -h`                   | Disk and memory left                                       |

A reboot needs nothing: Docker starts again by itself, and every service has `restart: unless-stopped`.

## When something goes wrong

**The deploy job failed.** Open it in the Actions tab; the failed step says why.

- "... is not set in the production environment": add that secret or variable, then "Run workflow". Nothing
  reached the server; the previous version still runs.
- The build failed: the same error happens on your computer with `docker build .` (the build has no database, so
  a page or route that reads the database while building fails here first). The previous version still runs.
- `migrate` failed: the script stops before touching the website and the worker, so the previous version still
  runs. See "A migration failed" below.
- "The site answers" failed: the new version started but does not answer. Look at `docker compose logs web` on the
  server. Most often a setting is wrong: `src/server/env.ts` names the setting it refused. Fix it and run the deploy
  again, or revert the release (next point).

**Visitors see "Back in a moment".** nginx is up but the website isn't answering (`deploy/nginx/maintenance.html`).
During a deploy this lasts while the new version starts; the page reopens the site by itself. If it stays, the
website stopped: look at `docker compose logs web` on the server. A page already open when the site restarts reloads itself once
(`src/app/error.tsx`), so its visitor reaches this page too.

**A release broke the live site.** Undo it with a pull request into `main` that reverts the release
(`docs/team/README.md`, "Undoing a merged change"). Its merge deploys the previous code, rebuilt and checked like any
release.

**A migration failed** (`docs/team/02-architecture-and-features.md`, "Migrations"). The deploy took a backup just
before it. If the migration changed nothing (Postgres runs each one in a transaction, so this is the usual case),
only mark it, on the server:

```bash
docker compose run --rm migrate pnpm exec prisma migrate resolve --rolled-back <migration_name>
```

then fix it in a new pull request. If it left the database half changed, restore the backup first:

```bash
docker compose stop web worker
docker compose exec -T db dropdb -U mabeet mabeet
docker compose exec -T db createdb -U mabeet mabeet
gunzip -c backups/<the newest file>.sql.gz | docker compose exec -T db psql -U mabeet -d mabeet -v ON_ERROR_STOP=1
docker compose start web worker
```

**The database password.** Postgres sets its password only the first time it starts, from `POSTGRES_PASSWORD`.
Changing the secret later does not change Postgres; the website could no longer connect. To change it: on the
server, `docker compose exec db psql -U mabeet -c "ALTER USER mabeet PASSWORD '<new>'"`, then set the same value in
GitHub and run the deploy.

**A secret leaked.** Replace it at its source (Stripe, Resend, R2...), put the new value in GitHub, and run the
deploy. For `SSH_PRIVATE_KEY`: make a new pair, swap the public half in the server's `authorized_keys`, and the
private half in GitHub.

## Trying the production shape on your computer

```bash
docker compose -f docker-compose.prod.yml up --build
```

It builds the image as `mabeet:local` and runs the website (http://localhost:3000), the worker, the migrations,
Postgres and Redis with your `.env`. nginx and certbot do not start: they are only for the server.

## The files

| File                                           | What it is                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`                     | The checks, and the `deploy` job                                                                                                                                         |
| `Dockerfile`                                   | The one image: website, worker and migrations                                                                                                                            |
| `docker-compose.prod.yml`                      | Every service on the server (and the production shape on your computer)                                                                                                  |
| `deploy/remote-deploy.sh`                      | What each deploy runs on the server: pull, back up, migrate, the certificate (first deploy), start, clean up                                                             |
| `deploy/nginx/https.conf.template`             | nginx: the website on `https://<DOMAIN>` only (nginx fills in `${DOMAIN}` when it starts)                                                                                |
| `deploy/nginx/certificate-check.conf.template` | nginx on the first deploy, while it gets the certificate                                                                                                                 |
| `deploy/nginx/maintenance.html`                | The Mabeet page nginx shows (as a 503) while the website doesn't answer: during a deploy, or after a crash. It checks every 15 seconds and opens the site when it's back |
