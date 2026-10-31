# euroton-godmode

Admin UI for `euroton-server`, built as a Preact single-page app. It covers users, plans, add-ons, subscriptions, coupons, feature flags, VPN credentials, the audit log & a SQL console.

**Never put this on the internet.** The console can read every row in the database. It runs each query in a read-only transaction with a 5 second timeout & logs it to `admin_audit`, but a leaked `OPERATOR_TOKEN` still exposes all account metadata. The [euroton-selfhost](https://github.com/Euroton/euroton-selfhost) install limits the godmode hostname to private address ranges in Caddy & blocks `/admin/*` on every other hostname. If you deploy it some other way, you have to do both yourself.

The token is a long-lived secret, separate from any user session. Rotate it by changing the variable on the server & restarting.

## What it won't do

It doesn't send mail as a user. It doesn't change `user_keys`, because replacing a key row destroys that user's encrypted data. It doesn't end sessions either; that's a `DELETE` in `psql`.

## Development

```sh
pnpm install
pnpm run dev    # http://localhost:8090
```

Run the server in another terminal:

```sh
OPERATOR_TOKEN=dev-token-please-change pnpm run dev
```

On first load, the config view asks for the API base & the token. The API base defaults to the page's own origin, so for this setup enter `http://localhost:4000`. Both values stay in that browser's localStorage.

## Build

```sh
pnpm run build      # static files in dist/
pnpm run preview
```

## Licence

AGPL-3.0-or-later. See `LICENSE`.
