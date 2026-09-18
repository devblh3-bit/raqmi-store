# Telegram bot setup

> **SECURITY: rotate the bot token now.** The current `TELEGRAM_BOT_TOKEN` was
> pasted into a chat and must be treated as compromised. In BotFather:
> `/mybots` → select the bot → **API Token** → **Revoke current token**. Put the
> new token in `.env` only (never `NEXT_PUBLIC_*`, never commit it), then
> re-run `setWebhook` below — the webhook URL survives rotation but any script
> using the old token stops working.

## Environment variables

```env
TELEGRAM_BOT_TOKEN=123456789:AA...            # from BotFather
TELEGRAM_ADMIN_CHAT_ID=123456789              # numeric chat id of the admin DM
TELEGRAM_WEBHOOK_SECRET=<random, no spaces>   # openssl rand -hex 32  (or base64url)
```

Find your chat id: DM the bot anything, then run the `getUpdates` curl below
and read `message.chat.id`.

## Register the webhook

One-time operator action (deliberately not done in app code):

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://your-domain.example/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message","callback_query"]' \
  -d "drop_pending_updates=true"
```

> **`callback_query` is required.** The deposit Approve/Reject buttons arrive as
> callback queries, not messages. Registering with `["message"]` alone makes the
> buttons do nothing at all — no error, no delivery, no log line — because
> Telegram simply never forwards the taps. Omit `allowed_updates` entirely to
> accept the default set, which includes callback queries.

Telegram will send `X-Telegram-Bot-Api-Secret-Token: <secret>` on every
delivery; the handler rejects anything else with 401 and fails closed when the
env var is unset. Verify registration:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Rotating TELEGRAM_WEBHOOK_SECRET

1. Generate a new value: `openssl rand -hex 32`.
   Telegram allows only `A-Z a-z 0-9 _ -` in this value, so avoid `+/=` — use
   `openssl rand -base64url 32` or `openssl rand -hex 32`, not plain base64.
2. Update the env var in your deployment and redeploy (the handler compares
   against the live env, so the new value must be live first).
3. Re-run the `setWebhook` command above with the new `secret_token`.

Order matters: deploy first, then `setWebhook`. In the gap, deliveries signed
with the old secret get 401 and Telegram retries them — nothing is lost.
Rotate immediately if the secret ever appears in logs or chat.

## Local development (no public URL)

Webhook and `getUpdates` are mutually exclusive. For local work, unregister
the webhook and poll:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=30&offset=-1"
```

Feed the resulting `update` objects into `handleTelegramWebhook` directly
(tests in `tests/telegram.test.ts` show the shape), or use a tunnel
(`cloudflared tunnel --url http://localhost:3000`) and `setWebhook` to the
tunnel URL. Remember to restore the production webhook afterwards.

## Login Widget (browser sign-in)

Separate from the webhook above, and configured in BotFather, not in code:

1. `/mybots` -> select the bot -> **Bot Settings** -> **Domain** -> set it to the
   **exact host** serving the login page (e.g. `shop.example.com` — no scheme,
   no path, no trailing slash).
2. `TELEGRAM_BOT_USERNAME` in `.env` is the bot's username **without** the `@`
   (e.g. `Devblh_bot`); the widget also needs `NEXT_PUBLIC_APP_URL` as an
   absolute `https://` origin, and renders nothing without it.

A domain mismatch is the usual cause of "the button does nothing": Telegram
renders the widget but silently refuses to return a signed payload.
