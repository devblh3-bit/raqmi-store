# 2. Architectural Decisions: Admin Inactivity Enforcement, Alert Routing & Agency Transparency

Date: 2026-09-24  
Status: Accepted

## Context

Following ADR 0001, we need to finalize:
1. The exact technical mechanism for enforcing strict idle timeouts on administrative routes.
2. The operational alert routing strategy via Telegram.
3. The storefront price presentation for Islamic agency (*Tawkeel*) procurement fees.

## Decisions

### 1. Instant Session Gate on Admin Layout & Server Actions
In `src/app/[locale]/admin/layout.tsx` and all admin Server Actions:
- The system checks `session.lastActive`.
- Even if `session.remember === true`, if `Date.now() - session.lastActive > IDLE_TIMEOUT_MS` (30 minutes), the session is destroyed via `deleteSession()` and the admin is redirected to `/${locale}/login?next=/${locale}/admin&error=inactive`.
- This ensures sensitive operations (wallet balance additions, provider API keys, order status modifications) cannot be accessed on unattended machines.

### 2. Single Unified Operational Telegram Stream
- All critical store events (failed automated dispatches, pending wallet deposits, provider balance thresholds) route through a single Telegram channel (`TELEGRAM_ADMIN_CHAT_ID`).
- Messages use high-contrast emoji classification:
  - 🚨 **Urgent**: `FAILED_DISPATCH` requiring manual intervention.
  - 💰 **Financial**: New wallet deposit requiring receipt verification.
  - ⚠️ **Warning**: Provider wholesale balance below safety buffer ($20.00).

### 3. Transparent Dual Display for Agency Pricing
- Product detail pages and carts display the total authorized capital prominently.
- A subtle, accessible breakdown badge/tooltip clarifies: *"Wholesale procurement $X.XX + $Y.YY automated agency fee"*.
- The checkout step presents the formal *Tawkeel* authorization declaration.

## Consequences

- **Positive**: Strict zero-trust admin security; single-pane-of-glass operations for store maintainers; compliant Islamic agency contract transparency.
- **Negative**: Admins must interact or re-authenticate within 30 minutes when accessing admin panels; tooltips require localization in EN, AR, FR.
