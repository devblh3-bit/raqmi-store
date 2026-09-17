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
TELEGRAM_WEBHOOK_SECRET=<64 hex chars>        # openssl rand -hex 32
```

Find your chat id: DM the bot anything, then run the `getUpdates` curl below
and read `message.chat.id`.

## Register the webhook

One-time operator action (deliberately not done in app code):

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://your-domain.example/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "allowed_updates=[\"message\"]" \
  -d "drop_pending_updates=true"
```

Telegram will send `X-Telegram-Bot-Api-Secret-Token: <secret>` on every
delivery; the handler rejects anything else with 401 and fails closed when the
env var is unset. Verify registration:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Rotating TELEGRAM_WEBHOOK_SECRET

1. Generate a new value: `openssl rand -hex 32`.
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
