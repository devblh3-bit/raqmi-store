import "server-only";

import {
  renderPlaintext,
  toSafePlaintext,
  type PlaintextField,
} from "./escape";
import {
  sendMessageToAdmin,
  type BotApiResult,
  type InlineKeyboardMarkup,
  type TelegramMessage,
} from "./client";

/**
 * Typed admin alerts.
 *
 * Each `notify*` function does two things and returns one value:
 *  1. sends a **plaintext** Telegram DM to the admin chat (subject to throttling)
 *  2. returns an `AlertRecord` the caller can persist verbatim as an in-app
 *     `Notification` row.
 *
 * This module deliberately does not import Prisma - persistence is another
 * agent's concern. It returns the shape; the caller writes it.
 *
 * All interpolated dynamic values (product names, provider messages, customer
 * input, delivery payloads) are routed through `escape.ts`, so every body is
 * plaintext-safe and is sent with **no `parse_mode`**.
 */

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  | "out_of_stock"
  | "fallback_used"
  | "provider_failure"
  | "low_provider_balance"
  | "reseller_application"
  | "pending_deposit"
  | "cost_drift"
  | "margin_violation";

/**
 * Admin-facing strings in all three storefront locales.
 * English is canonical; ar/fr are hand-written, not machine-translated.
 */
export interface Localized {
  ar: string;
  en: string;
  fr: string;
}

export interface AlertRecord {
  type: AlertType;
  severity: AlertSeverity;
  title: Localized;
  body: Localized;
  /** Relative admin-panel path, when there is a place to go and act. */
  link?: string;
  /** False when the send failed *or* when the throttle collapsed this alert. */
  sentToTelegram: boolean;

  /* ---- extra context; ignore it if your Notification row doesn't need it --- */

  /** Stable identity of the thing the alert is about. */
  entityId: string;
  /** `${type}:${entityId}` - the throttle key. */
  dedupeKey: string;
  /** True when the throttle suppressed the Telegram send. */
  throttled: boolean;
  /** Repeats collapsed into this send since the last one that went out. */
  collapsedCount: number;
  /** Redacted failure reason when `sentToTelegram` is false and not throttled. */
  sendError?: string;
  /** Telegram message id of the sent alert, so a caller can retire its buttons. */
  messageId?: number;
  occurredAt: string;
}

/* -------------------------------------------------------------------------- */
/* Throttling                                                                 */
/* -------------------------------------------------------------------------- */

export interface ThrottleDecision {
  /** May we send right now? */
  allowed: boolean;
  /**
   * When `allowed`, how many suppressed repeats are being folded into this
   * send. When not allowed, how many repeats have accumulated so far.
   */
  collapsed: number;
}

/**
 * Pluggable throttle. Swap in a Redis/Postgres implementation later without
 * touching any `notify*` function:
 *
 *   setThrottleStore(new RedisThrottleStore(redis));
 *
 * `hit` is allowed to be async so a network-backed store fits the same shape.
 */
export interface ThrottleStore {
  hit(key: string, windowMs: number): ThrottleDecision | Promise<ThrottleDecision>;
  /** Test/ops affordance. */
  clear(): void;
}

/** Default throttle window: one alert per (type, entity) per 15 minutes. */
export const DEFAULT_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

/**
 * In-memory throttle.
 *
 * ⚠️ **SERVERLESS CAVEAT** — this is per-instance, per-process state. On
 * Vercel/Lambda each cold start gets an empty map and concurrent instances do
 * not share it, so with N warm instances an OOS storm can still emit up to N
 * DMs per window instead of 1. That is an acceptable ceiling (N is small, and
 * it collapses 500 DMs to a handful), but it is *not* a guarantee. For a hard
 * guarantee, back `ThrottleStore` with Redis or a `notification_throttle` table
 * keyed on `dedupeKey` with a `window_start` column.
 *
 * Memory is bounded: entries older than two windows are pruned on each hit,
 * and the map is hard-capped so a storm across 100k distinct products cannot
 * grow it without limit.
 */
export class MemoryThrottleStore implements ThrottleStore {
  private readonly entries = new Map<string, { windowStart: number; suppressed: number }>();

  constructor(private readonly maxEntries = 5_000) {}

  hit(key: string, windowMs: number): ThrottleDecision {
    const now = Date.now();
    this.prune(now, windowMs);

    const existing = this.entries.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      // Window open (or expired): allow, and report what we swallowed.
      const collapsed = existing?.suppressed ?? 0;
      this.entries.set(key, { windowStart: now, suppressed: 0 });
      return { allowed: true, collapsed };
    }

    existing.suppressed += 1;
    return { allowed: false, collapsed: existing.suppressed };
  }

  clear(): void {
    this.entries.clear();
  }

  private prune(now: number, windowMs: number): void {
    if (this.entries.size < this.maxEntries) {
      // Cheap opportunistic prune only when the map is getting large.
      if (this.entries.size < Math.floor(this.maxEntries / 2)) return;
    }
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart >= windowMs * 2) this.entries.delete(key);
    }
    // Still over cap after pruning: drop oldest insertions (Map preserves order).
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
}

/** A store that never throttles — handy in tests and one-off scripts. */
export class NoopThrottleStore implements ThrottleStore {
  hit(): ThrottleDecision {
    return { allowed: true, collapsed: 0 };
  }
  clear(): void {}
}

let throttleStore: ThrottleStore = new MemoryThrottleStore();

export function setThrottleStore(store: ThrottleStore): void {
  throttleStore = store;
}

export function getThrottleStore(): ThrottleStore {
  return throttleStore;
}

/** Clear all throttle state (tests, or after an operator "resend" action). */
export function resetThrottle(): void {
  throttleStore.clear();
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                   */
/* -------------------------------------------------------------------------- */

export interface NotifyOptions {
  /** Skip the Telegram send but still return the record (for DB-only alerts). */
  telegram?: boolean;
  /** Override the dedupe window for this alert. */
  throttleWindowMs?: number;
  /** Bypass the throttle entirely (e.g. an operator-triggered resend). */
  skipThrottle?: boolean;
}

interface AlertSpec {
  type: AlertType;
  severity: AlertSeverity;
  entityId: string;
  title: Localized;
  body: Localized;
  link?: string;
  /** Structured lines for the Telegram message; values are sanitised. */
  fields?: PlaintextField[];
  /** Optional inline keyboard (e.g. Approve/Reject). Ids only, never amounts. */
  buttons?: InlineKeyboardMarkup;
}

/**
 * `info` alerts arrive silently; `warning`/`critical` buzz the phone.
 * An OOS storm at 3am should not wake anyone for an `info`.
 */
function isSilent(severity: AlertSeverity): boolean {
  return severity === "info";
}

const SEVERITY_PREFIX: Record<AlertSeverity, string> = {
  info: "INFO",
  warning: "WARNING",
  critical: "CRITICAL",
};

async function dispatch(spec: AlertSpec, options: NotifyOptions = {}): Promise<AlertRecord> {
  const { telegram = true, throttleWindowMs = DEFAULT_THROTTLE_WINDOW_MS, skipThrottle = false } = options;

  const entityId = toSafePlaintext(spec.entityId, { maxLength: 200 }) || "unknown";
  const dedupeKey = `${spec.type}:${entityId}`;

  const decision: ThrottleDecision = skipThrottle
    ? { allowed: true, collapsed: 0 }
    : await throttleStore.hit(dedupeKey, throttleWindowMs);

  const record: AlertRecord = {
    type: spec.type,
    severity: spec.severity,
    title: spec.title,
    body: spec.body,
    link: spec.link,
    sentToTelegram: false,
    entityId,
    dedupeKey,
    throttled: !decision.allowed,
    collapsedCount: decision.collapsed,
    occurredAt: new Date().toISOString(),
  };

  if (!telegram || !decision.allowed) return record;

  const fields = [...(spec.fields ?? [])];
  if (decision.collapsed > 0) {
    fields.push({
      label: "Repeats collapsed",
      value: `${decision.collapsed} more since the last alert`,
    });
  }

  const text = renderPlaintext({
    // Title and labels are trusted static strings written here.
    title: `[${SEVERITY_PREFIX[spec.severity]}] ${spec.title.en}`,
    fields,
    notes: spec.link ? [`Admin: ${spec.link}`] : [],
  });

  const result: BotApiResult<TelegramMessage> = await sendMessageToAdmin(text, {
    // No parseMode: the body contains provider/customer content.
    disableNotification: isSilent(spec.severity),
    replyMarkup: spec.buttons,
  });

  if (result.ok) {
    record.sentToTelegram = true;
    record.messageId = result.result?.message_id;
  } else {
    record.sendError = result.error; // already redacted by the client
  }
  return record;
}

/* -------------------------------------------------------------------------- */
/* Alerts                                                                     */
/* -------------------------------------------------------------------------- */

export interface OutOfStockInput {
  productId: string;
  productName: string;
  sku?: string;
  providerName?: string;
}

/** Stock hit zero: orders for this product will start failing. */
export function notifyOutOfStock(
  input: OutOfStockInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const name = toSafePlaintext(input.productName, { maxLength: 120 });
  return dispatch(
    {
      type: "out_of_stock",
      severity: "warning",
      entityId: input.productId,
      title: {
        en: "Out of stock",
        ar: "نفاد المخزون",
        fr: "Rupture de stock",
      },
      body: {
        en: `${name} is out of stock. New orders will fail until it is restocked.`,
        ar: `المنتج ${name} نفد من المخزون. ستفشل الطلبات الجديدة حتى تتم إعادة التزويد.`,
        fr: `${name} est en rupture de stock. Les nouvelles commandes échoueront jusqu'au réapprovisionnement.`,
      },
      link: `/admin/products/${encodeURIComponent(input.productId)}`,
      fields: [
        { label: "Product", value: input.productName },
        { label: "SKU", value: input.sku },
        { label: "Provider", value: input.providerName },
      ],
    },
    options,
  );
}

export interface FallbackUsedInput {
  productId: string;
  productName: string;
  primaryProvider: string;
  fallbackProvider: string;
  /** Priority rank of the provider that actually served the order. */
  fallbackPriority: number;
  orderId?: string;
}

/** The primary provider was out of stock and a lower-priority one served it. */
export function notifyFallbackUsed(
  input: FallbackUsedInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const name = toSafePlaintext(input.productName, { maxLength: 120 });
  const primary = toSafePlaintext(input.primaryProvider, { maxLength: 80 });
  const fallback = toSafePlaintext(input.fallbackProvider, { maxLength: 80 });
  const n = Number.isFinite(input.fallbackPriority) ? input.fallbackPriority : 0;

  return dispatch(
    {
      type: "fallback_used",
      severity: "warning",
      entityId: `${input.productId}:${input.fallbackProvider}`,
      title: {
        en: "Fallback provider used",
        ar: "تم استخدام مورد بديل",
        fr: "Fournisseur de secours utilisé",
      },
      body: {
        en: `${name}: primary provider ${primary} was out of stock, so ${fallback} (priority ${n}) served the order. Check the margin on this route.`,
        ar: `${name}: المورد الأساسي ${primary} نفد مخزونه، فتم تنفيذ الطلب عبر ${fallback} (الأولوية ${n}). راجع هامش الربح لهذا المسار.`,
        fr: `${name} : le fournisseur principal ${primary} était en rupture, donc ${fallback} (priorité ${n}) a servi la commande. Vérifiez la marge sur cette route.`,
      },
      link: `/admin/products/${encodeURIComponent(input.productId)}`,
      fields: [
        { label: "Product", value: input.productName },
        { label: "Primary (out of stock)", value: input.primaryProvider },
        { label: "Served by", value: `${input.fallbackProvider} (priority ${n})` },
        { label: "Order", value: input.orderId },
      ],
    },
    options,
  );
}

export interface ProviderFailureInput {
  providerId: string;
  providerName: string;
  operation: string;
  /** Provider-returned message: untrusted, sanitised before use. */
  message?: string;
  statusCode?: number;
  consecutiveFailures?: number;
  orderId?: string;
}

/** A provider API call failed. Critical once failures are consecutive. */
export function notifyProviderFailure(
  input: ProviderFailureInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const provider = toSafePlaintext(input.providerName, { maxLength: 80 });
  const operation = toSafePlaintext(input.operation, { maxLength: 80 });
  const message = toSafePlaintext(input.message, { maxLength: 300 }) || "no details returned";
  const streak = input.consecutiveFailures ?? 1;
  const severity: AlertSeverity = streak >= 3 ? "critical" : "warning";

  return dispatch(
    {
      type: "provider_failure",
      severity,
      entityId: `${input.providerId}:${input.operation}`,
      title: {
        en: "Provider failure",
        ar: "فشل في الاتصال بالمورد",
        fr: "Échec du fournisseur",
      },
      body: {
        en: `${provider} failed during ${operation}: ${message}. Consecutive failures: ${streak}.`,
        ar: `فشل المورد ${provider} أثناء ${operation}: ${message}. عدد الأعطال المتتالية: ${streak}.`,
        fr: `${provider} a échoué lors de ${operation} : ${message}. Échecs consécutifs : ${streak}.`,
      },
      link: `/admin/providers/${encodeURIComponent(input.providerId)}`,
      fields: [
        { label: "Provider", value: input.providerName },
        { label: "Operation", value: input.operation },
        { label: "HTTP status", value: input.statusCode },
        { label: "Consecutive failures", value: streak },
        { label: "Order", value: input.orderId },
        { label: "Message", value: input.message },
      ],
    },
    options,
  );
}

export interface LowProviderBalanceInput {
  providerId: string;
  providerName: string;
  balance: number | string;
  threshold: number | string;
  currency: string;
}

/** Provider wallet is running low; orders will start failing when it empties. */
export function notifyLowProviderBalance(
  input: LowProviderBalanceInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const provider = toSafePlaintext(input.providerName, { maxLength: 80 });
  const balance = toSafePlaintext(input.balance, { maxLength: 40 });
  const threshold = toSafePlaintext(input.threshold, { maxLength: 40 });
  const currency = toSafePlaintext(input.currency, { maxLength: 12 });
  const numeric = typeof input.balance === "number" ? input.balance : Number(input.balance);
  const severity: AlertSeverity = Number.isFinite(numeric) && numeric <= 0 ? "critical" : "warning";

  return dispatch(
    {
      type: "low_provider_balance",
      severity,
      entityId: input.providerId,
      title: {
        en: "Low provider balance",
        ar: "رصيد المورد منخفض",
        fr: "Solde fournisseur faible",
      },
      body: {
        en: `${provider} balance is ${balance} ${currency}, below the ${threshold} ${currency} threshold. Top it up to avoid failed orders.`,
        ar: `رصيد المورد ${provider} هو ${balance} ${currency}، أي أقل من الحد المحدد ${threshold} ${currency}. قم بشحن الرصيد لتجنّب فشل الطلبات.`,
        fr: `Le solde de ${provider} est de ${balance} ${currency}, sous le seuil de ${threshold} ${currency}. Rechargez-le pour éviter des commandes en échec.`,
      },
      link: `/admin/providers/${encodeURIComponent(input.providerId)}`,
      fields: [
        { label: "Provider", value: input.providerName },
        { label: "Balance", value: `${balance} ${currency}` },
        { label: "Threshold", value: `${threshold} ${currency}` },
      ],
    },
    options,
  );
}

export interface ResellerApplicationInput {
  applicationId: string;
  /** Customer-supplied: fully untrusted. */
  businessName: string;
  /** Customer-supplied: fully untrusted. */
  contact: string;
  /** Customer-supplied free text: fully untrusted. */
  note?: string;
}

/** Someone applied for reseller pricing; needs a human decision. */
export function notifyResellerApplication(
  input: ResellerApplicationInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const business = toSafePlaintext(input.businessName, { maxLength: 120 }) || "unnamed applicant";
  const contact = toSafePlaintext(input.contact, { maxLength: 120 }) || "no contact given";

  return dispatch(
    {
      type: "reseller_application",
      severity: "info",
      entityId: input.applicationId,
      title: {
        en: "New reseller application",
        ar: "طلب حساب موزّع جديد",
        fr: "Nouvelle demande de revendeur",
      },
      body: {
        en: `${business} (${contact}) applied for reseller access. Review it and approve or reject in the admin panel.`,
        ar: `تقدّم ${business} (${contact}) بطلب للحصول على حساب موزّع. راجع الطلب ثم وافق عليه أو ارفضه من لوحة التحكم.`,
        fr: `${business} (${contact}) a demandé un accès revendeur. À examiner puis approuver ou refuser dans l'espace admin.`,
      },
      link: `/admin/resellers/${encodeURIComponent(input.applicationId)}`,
      fields: [
        { label: "Business", value: input.businessName },
        { label: "Contact", value: input.contact },
        { label: "Note", value: input.note },
      ],
    },
    options,
  );
}

export interface PendingDepositInput {
  depositId: string;
  customerLabel: string;
  amount: number | string;
  currency: string;
  method: string;
  reference?: string;
  waitingMinutes?: number;
  /**
   * Attach Approve/Reject buttons. callback_data carries only the deposit id
   * (opaque, <=64 bytes); the amount is re-read from the DB on the way back in,
   * never trusted from the button.
   */
  withActions?: boolean;
}

/** A manual-confirmation deposit is waiting; it ages into a warning. */
export function notifyPendingDeposit(
  input: PendingDepositInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const customer = toSafePlaintext(input.customerLabel, { maxLength: 120 }) || "a customer";
  const amount = toSafePlaintext(input.amount, { maxLength: 40 });
  const currency = toSafePlaintext(input.currency, { maxLength: 12 });
  const method = toSafePlaintext(input.method, { maxLength: 60 });
  const reference = toSafePlaintext(input.reference, { maxLength: 80 });
  const waited = input.waitingMinutes ?? 0;
  const severity: AlertSeverity = waited >= 60 ? "warning" : "info";

  return dispatch(
    {
      type: "pending_deposit",
      severity,
      entityId: input.depositId,
      title: {
        en: "Deposit awaiting confirmation",
        ar: "إيداع في انتظار التأكيد",
        fr: "Dépôt en attente de confirmation",
      },
      body: {
        en: `A ${amount} ${currency} deposit from ${customer} via ${method} is waiting for manual confirmation${reference ? ` (reference ${reference})` : ""}.`,
        ar: `إيداع بقيمة ${amount} ${currency} من ${customer} عبر ${method} في انتظار التأكيد اليدوي${reference ? ` (المرجع ${reference})` : ""}.`,
        fr: `Un dépôt de ${amount} ${currency} de ${customer} via ${method} attend une confirmation manuelle${reference ? ` (référence ${reference})` : ""}.`,
      },
      link: `/admin/deposits/${encodeURIComponent(input.depositId)}`,
      buttons: input.withActions
        ? {
            inline_keyboard: [
              [
                { text: "✅ Approve", callback_data: `dep:ok:${input.depositId}` },
                { text: "❌ Reject", callback_data: `dep:no:${input.depositId}` },
              ],
            ],
          }
        : undefined,
      fields: [
        { label: "Amount", value: `${amount} ${currency}` },
        { label: "Customer", value: input.customerLabel },
        { label: "Method", value: input.method },
        { label: "Reference", value: input.reference },
        { label: "Waiting", value: waited ? `${waited} min` : undefined },
      ],
    },
    options,
  );
}

export interface CostDriftInput {
  productId: string;
  productName: string;
  providerId: string;
  providerName: string;
  oldCost: number;
  newCost: number;
  currency: string;
  /** Signed percentage change; computed here when omitted. */
  changePercent?: number;
}

/** Provider cost moved more than 10%: the configured margin may no longer hold. */
export function notifyCostDrift(
  input: CostDriftInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const pctRaw =
    input.changePercent ??
    (input.oldCost !== 0 ? ((input.newCost - input.oldCost) / Math.abs(input.oldCost)) * 100 : 100);
  const pct = Number.isFinite(pctRaw) ? Math.round(pctRaw * 10) / 10 : 0;
  const signed = `${pct > 0 ? "+" : ""}${pct}%`;

  const name = toSafePlaintext(input.productName, { maxLength: 120 });
  const provider = toSafePlaintext(input.providerName, { maxLength: 80 });
  const currency = toSafePlaintext(input.currency, { maxLength: 12 });
  const oldCost = toSafePlaintext(input.oldCost, { maxLength: 40 });
  const newCost = toSafePlaintext(input.newCost, { maxLength: 40 });

  return dispatch(
    {
      type: "cost_drift",
      severity: Math.abs(pct) >= 25 ? "critical" : "warning",
      entityId: `${input.productId}:${input.providerId}`,
      title: {
        en: "Provider cost moved",
        ar: "تغيّر سعر التكلفة",
        fr: "Coût fournisseur modifié",
      },
      body: {
        en: `${name} at ${provider}: cost moved from ${oldCost} to ${newCost} ${currency} (${signed}). The selling price has not changed, so the margin is at risk.`,
        ar: `${name} عند ${provider}: تغيّرت التكلفة من ${oldCost} إلى ${newCost} ${currency} بنسبة ${signed}. سعر البيع لم يتغيّر، وبالتالي هامش الربح في خطر.`,
        fr: `${name} chez ${provider} : le coût est passé de ${oldCost} à ${newCost} ${currency} (${signed}). Le prix de vente est inchangé, donc la marge est menacée.`,
      },
      link: `/admin/products/${encodeURIComponent(input.productId)}`,
      fields: [
        { label: "Product", value: input.productName },
        { label: "Provider", value: input.providerName },
        { label: "Old cost", value: `${oldCost} ${currency}` },
        { label: "New cost", value: `${newCost} ${currency}` },
        { label: "Change", value: signed },
      ],
    },
    options,
  );
}

export interface MarginViolationInput {
  productId: string;
  productName: string;
  cost: number | string;
  price: number | string;
  currency: string;
  marginPercent: number;
  floorPercent: number;
  providerName?: string;
}

/** Selling price is below the configured margin floor: every sale loses money. */
export function notifyMarginViolation(
  input: MarginViolationInput,
  options?: NotifyOptions,
): Promise<AlertRecord> {
  const name = toSafePlaintext(input.productName, { maxLength: 120 });
  const currency = toSafePlaintext(input.currency, { maxLength: 12 });
  const cost = toSafePlaintext(input.cost, { maxLength: 40 });
  const price = toSafePlaintext(input.price, { maxLength: 40 });
  const margin = Number.isFinite(input.marginPercent) ? Math.round(input.marginPercent * 10) / 10 : 0;
  const floor = Number.isFinite(input.floorPercent) ? Math.round(input.floorPercent * 10) / 10 : 0;

  return dispatch(
    {
      type: "margin_violation",
      severity: "critical",
      entityId: input.productId,
      title: {
        en: "Margin below floor",
        ar: "الهامش أقل من الحد الأدنى",
        fr: "Marge sous le seuil",
      },
      body: {
        en: `${name}: margin is ${margin}%, below the ${floor}% floor. Cost ${cost} ${currency}, price ${price} ${currency}. Fix the price or pause the product.`,
        ar: `${name}: الهامش ${margin}% وهو أقل من الحد الأدنى ${floor}%. التكلفة ${cost} ${currency} وسعر البيع ${price} ${currency}. صحّح السعر أو أوقف بيع المنتج.`,
        fr: `${name} : la marge est de ${margin}%, sous le seuil de ${floor}%. Coût ${cost} ${currency}, prix ${price} ${currency}. Corrigez le prix ou suspendez le produit.`,
      },
      link: `/admin/products/${encodeURIComponent(input.productId)}`,
      fields: [
        { label: "Product", value: input.productName },
        { label: "Provider", value: input.providerName },
        { label: "Cost", value: `${cost} ${currency}` },
        { label: "Price", value: `${price} ${currency}` },
        { label: "Margin", value: `${margin}% (floor ${floor}%)` },
      ],
    },
    options,
  );
}
