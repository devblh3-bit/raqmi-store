# Raqmi Store — Admin Panel Comprehensive Improvement & Architecture Plan

**Document Version:** 1.1 (Updated with Distinct Offer Specification & Warranty Tiering Architecture)  
**Target System:** Next.js 16 (App Router), Prisma ORM, PostgreSQL, `next-intl` (en, ar, fr), Tailwind CSS v4  
**Date:** September 2026  

---

## 1. Executive Summary & Core Philosophy

Raqmi Store operates in the digital goods space (subscriptions, software licenses, gaming/social top-ups, accounts). In this industry, **upstream providers are rarely identical**: one supplier offers a 15-day warranty on a shared profile, while another offers a 30-day warranty on a private personal email.

### Core Architectural Philosophy:
1. **Suppliers are 100% Invisible to Customers**: Buyers see your store brand, your product, your variant options, and your terms.
2. **Distinct Offers for Distinct Terms (Primary Pattern)**: If two provider SKUs differ in warranty duration, delivery method, or account type (shared vs. private), they **must be created as separate customer-facing variant offers** with clear feature badges and dedicated pricing.
3. **Strict Fallback Only for Identical Specs (Secondary Pattern)**: Multiple suppliers are linked to the *same* offer as backups (Priority 1 $\rightarrow$ Priority 2) **only when their warranty, delivery mode, and specs are 100% identical**.
4. **Complete Browser-Based Control**: The administrator must never touch database scripts to curate variants, recover stuck orders, refund customers, adjust wallet balances, or manage wholesale resellers.

```
                                  RAQMI ADMIN COCKPIT
                                           │
  ┌───────────────────┬────────────────────┼────────────────────┬───────────────────┐
  ▼                   ▼                    ▼                    ▼                   ▼
Catalog & Curation   Order Recovery &     Customer Wallets &   Financials &        System Settings &
(Offers & Badges)    Fulfillment Ops      Reseller Network     Audit Logging       Currency Engine
──────────────────   ────────────────     ──────────────────   ────────────        ─────────────────
• 1-Click Variant    • Retry Order        • User Directory     • Executive KPIs    • USD/DZD FX Rate
• Multi-lang Rules   • Manual Delivery    • Balance Adjust +/- • Audit Explorer    • Store Maint. Mode
• Warranty Badges    • Wallet Refund      • Reseller Approvals • Deposit Lightbox  • Telegram Monitor
• Category CRUD      • Decrypted Inspect  • Tier Price Matrix  • Liability Ledger  • Provider Balances
```

---

## 2. Core Feature: Offer Curation, Warranty Tiering & Provider Mapping

### 2.1 Why Blind Supplier Merging Fails in Digital Goods
Consider a product like **ChatGPT Plus**:
* **Provider 1 (VBR)**: Sells a *Shared Profile (login via code), 15 Days Warranty* @ $7 wholesale.
* **Provider 2 (QCST)**: Sells a *Private Personal Account (upgraded on buyer's email), 30 Days Full Warranty* @ $16 wholesale.

If an admin merges both under a single generic *"1 Month"* variant with automatic failover:
- A customer paying for a 30-day private account would be silently fulfilled with a 15-day shared account if Provider 2 is out of stock.
- This creates immediate customer chargebacks, support tickets, and reputational damage.

### 2.2 The Solution: Two Curation Patterns

```
PATTERN A: Distinct Variant Offers (Default & Recommended)
─────────────────────────────────────────────────────────────────────────────
Product: "ChatGPT Plus"
  ├── Variant 1: "1 Month — Shared Profile (15-Day Warranty)" · [BUDGET]
  │     Retail: $9.99  ·  Supplier: Provider 1 (VBR Shared SKU)
  │     Rules: "Shared account. 15 days replacement warranty. Instant delivery."
  │
  └── Variant 2: "1 Month — Private Account (30-Day Full Warranty)" · [VIP]
        Retail: $19.99  ·  Supplier: Provider 2 (QCST Private SKU)
        Rules: "Private account upgraded on your personal email. 30 days full warranty."

PATTERN B: Backup Fallback (Strictly Identical Specs Only)
─────────────────────────────────────────────────────────────────────────────
Variant: "1 Month — Private Account (30-Day Full Warranty)"
  ├── Priority 1 (Primary): QCST Private SKU #qc-gpt-1m ($15.00)
  └── Priority 2 (Backup):  Canboso Private SKU #can-gpt-1m ($15.50)
      └─► Both provide the exact same 30-day private upgrade.
      └─► Fallback triggers only if Priority 1 is Out of Stock.
```

---

### 2.3 The 1-Click Offer Creation Modal Flow

From the **Provider Offer Pool** in `/admin/catalog/[id]/offers`:

1. **Provider Pool Table Row** displays:
   - Provider Badge: `VBR`, `QCST`, or `Canboso`
   - Provider SKU & Raw Title: e.g. `vbr-chatgpt-shared-1m`
   - Wholesale Cost: e.g. `$7.00 USD`
   - Stock & Availability: e.g. `Available (45 in stock)`
   - Supplier Specs Box: Raw terms extracted from provider (Warranty days, account type, customer input required).
   - **Action Buttons**:
     - **`[ + Create as New Variant ]`** (Primary action)
     - **`[ + Attach as Backup to Existing Variant ]`** (Secondary action with warning)

2. **The Creation Modal (Interactive Form)**:
   ```
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ CREATE NEW VARIANT (OFFER)                                                 │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │ ℹ️ SUPPLIER SPECIFICATIONS (READ-ONLY REFERENCE)                            │
   │ Provider: VBR  ·  SKU: vbr-chatgpt-shared-1m  ·  Wholesale Cost: $7.00 USD │
   │ Warranty: 15 Days  ·  Input Required: None (Ready Account)                  │
   │ Supplier Notes: "Shared profile for 1 device. Do not change credentials."   │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │ 1. VARIANT DISPLAY LABELS (Multi-Language)                                 │
   │ [EN] Label: [ 1 Month — Shared Profile (15-Day Warranty)                 ] │
   │ [AR] Label: [ شهر واحد — حساب مشترك (ضمان 15 يوم)                         ] │
   │ [FR] Label: [ 1 Mois — Profil Partagé (Garantie 15 Jours)                ] │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │ 2. CUSTOMER RULES & WARRANTY INSTRUCTIONS (Multi-Language Textareas)       │
   │ [EN] Rules: [ Shared account for 1 device. 15 days replacement warranty. ] │
   │             [ Credentials delivered immediately after checkout.          ] │
   │ [AR] Rules: [ حساب مشترك لجهاز واحد. ضمان استبدال لمدة 15 يوم.           ] │
   │             [ يتم تسليم بيانات الحساب فوراً بعد إتمام الطلب.              ] │
   │ [FR] Rules: [ Compte partagé pour 1 appareil. Garantie de 15 jours.      ] │
   │             [ Identifiants livrés instantanément après la commande.      ] │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │ 3. PRICING, MARKUP & BADGES                                                │
   │ Markup Percentage: [ 42.85 ] %                                             │
   │ ┌─────────────────────────────────────────────────────────────────────────┐ │
   │ │  Live Calculation:                                                      │ │
   │ │  Cost: $7.00  +  Markup: $3.00  =  Selling Price: $10.00 USD             │ │
   │ │  Storefront Indicative Price: ≈ 2,400 DZD                               │ │
   │ └─────────────────────────────────────────────────────────────────────────┘ │
   │ Feature Badge: [ BUDGET ] (Options: BUDGET, POPULAR, BEST VALUE, VIP)     │
   │ Strike-Through Price (Compare At): [ $14.00 ] (Shows crossed-out discount) │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │ [ Cancel ]                                         [ Create Variant & Link ]│
   └─────────────────────────────────────────────────────────────────────────────┘
   ```

### 2.4 Linking a Backup Provider (`OfferProviderLink`)
If an admin clicks **`[ + Attach as Backup to Existing Variant ]`**:
- A dropdown displays all current variants for this product.
- **Safety Warning Displayed**:
  > ⚠️ *Important: Only link this supplier as a backup if their warranty duration, account type, and delivery method match the chosen variant 100%.*
- On confirmation, creates an `OfferProviderLink` with `priority = (existing max + 1)`.

### 2.5 Negative Margin Guard for Fallbacks
If an identical fallback supplier is invoked during background fulfillment:
- **Condition**: If `BackupSupplier.cost > CustomerPaidAmount`:
- **Action**: The system does **not** fulfill at a loss.
- **Behavior**:
  1. The order item is held in `AWAITING_SELLER`.
  2. An immediate Telegram alert is dispatched to the admin:
     > ⚠️ *Order #RQM-1234: Primary supplier OOS. Backup supplier cost ($16.00) exceeds payment ($15.00).*
  3. Admin can either **[ Force Fulfill via Backup ]** or **[ 1-Click Refund to Customer Wallet ]**.

### 2.6 Storefront Product Page Integration
When a buyer views `/[locale]/products/[slug]` and clicks an offer variant:
1. Dynamic price and badge update immediately.
2. The localized **Rules & Warranty Instructions** (`rulesEn`, `rulesAr`, `rulesFr`) render directly beneath the offer selector in a clear, card-styled panel.
3. In Arabic locale (`/ar`), the RTL alignment renders smoothly alongside warranty icons.

---

## 3. Comprehensive Admin Feature Domains

### Domain 1: Catalog & Category Management

#### 1.1 Category CRUD (`/[locale]/admin/categories`)
*Currently categories are hardcoded in seeds.*
- Create, edit, translate (`nameEn`, `nameAr`, `nameFr`), and reorder categories.
- Slug generation, icon upload, and `isActive` master visibility switch.

#### 1.2 Product Merchandising
- Product badges: `isFeatured` (promoted on storefront hero grid) and `isNew`.
- `contentLocked` / `translationLockedAr/Fr`: Prevents automated sync jobs from overwriting human-edited descriptions.
- Dedicated logo upload (`public/logos/[slug].webp`) with preview and removal.

---

### Domain 2: Order Recovery & Fulfillment Operations (`/[locale]/admin/orders`)

#### 2.1 The Problem
Orders can stall in `FAILED` or `PLACED_WITH_PROVIDER` states (e.g. API timeouts, invalid customer emails, or suppliers requiring manual activation). The current page is strictly read-only.

#### 2.2 Operational Levers
1. **Retry Dispatch Action**:
   - Re-run `dispatchPendingOrders` for a failed order item.
   - Option to override and route to a specific provider link.
2. **Manual Key / Credential Delivery Modal (`AWAITING_SELLER`)**:
   - For orders fulfilled manually (e.g. custom account creation, offline voucher):
   - Admin enters credentials/keys in a secure textarea.
   - System encrypts payload with `aes-256-gcm` (`encryptField`), sets status to `COMPLETED`, and triggers delivery notification to the buyer.
3. **Automated Wallet Refund Action**:
   - One-click button to cancel an order and credit the exact amount back to the customer's wallet via `applyDeltaTx()`.
   - Automatically writes an `AuditLog` entry and notifies the customer.
4. **Decrypted Order Inspection**:
   - Expandable drawer showing decrypted customer input (buyer's email/username), decrypted delivery credentials, and full chronological `FulfillmentAttempt` timeline with provider error codes.

---

### Domain 3: Customer Directory & Reseller Program

#### 3.1 Customer Directory (`/[locale]/admin/users`)
- Search users by email, Telegram ID, or role (`CUSTOMER`, `RESELLER_APPLICANT`, `RESELLER`, `ADMIN`).
- User profile card: Wallet balance in USD & DZD, total spend, order history.
- **Manual Balance Adjustment Modal**:
  - Credit (`+`) or Debit (`-`) in USD cents.
  - **Mandatory Reason Field**: Must record audit justification (e.g. *"In-person cash deposit"* or *"Service compensation"*).
  - Runs in a `SERIALIZABLE` transaction with database check constraints preventing negative balances.

#### 3.2 Reseller Program Management (`/[locale]/admin/resellers`)
- **Application Review Queue**:
  - Review users who applied for reseller status (`RESELLER_APPLICANT`).
  - 1-Click Approve (promotes to `RESELLER` + assigns tier) or Reject.
- **Reseller Tiers (`ResellerTier`)**:
  - Configure tier discount percentages (e.g. Silver 5%, Gold 10%).
- **Wholesale Price Override Matrix (`OfferTierPriceOverride`)**:
  - Grid mapping `Offer` $\times$ `ResellerTier`.
  - Set fixed wholesale prices for specific items, bypassing percentage formulas.

---

### Domain 4: Deposit & Treasury Operations (`/[locale]/admin/deposits`)

#### 4.1 Enhanced Review Queue
- Filter by method (`MANUAL_BANK`, `USDT_BEP20`, `USDT_TRC20`), status, and date.
- Search by user email or transaction hash.
- **Proof Lightbox Viewer**: High-resolution zoom viewer for bank/CCP receipts and direct clickable links to BscScan / TronScan explorers.
- **Two-Click Approval**: Confirmation dialog preventing accidental double-approvals.

---

### Domain 5: Financial Dashboard, Audit Logs & System Settings

#### 5.1 Executive Dashboard (`/[locale]/admin`)
- **KPI Cards**:
  - Today's Sales Volume & Net Orders (last 24h).
  - Total Customer Wallet Liability (`SUM(Wallet.balanceMinor)`).
  - Pending Actions Alert Banner (pending deposits, failed orders needing manual keys).
  - Provider Balances & low-balance warnings.

#### 5.2 Audit Log Explorer (`/[locale]/admin/audit`)
- Complete searchable history of administrative actions (`OFFER_PINNED`, `DEPOSIT_APPROVED`, `MANUAL_REFUND`, `BALANCE_ADJUSTED`) with actor, timestamp, and JSON details.

#### 5.3 System Settings (`/[locale]/admin/settings`)
- **Currency Engine**: Direct input field for USD $\rightarrow$ DZD exchange multiplier (e.g. `1 USD = 240 DZD`).
- **Storefront Operational Mode**: Emergency toggle for Maintenance Mode (disables checkout with customizable banner).
- **Telegram Bot Health**: Real-time webhook latency check, last update ID, and test alert trigger.

---

## 4. Technical Architecture & Database Mapping

All proposed features map directly to existing Prisma models without requiring destructive database migrations:

| Feature Area | Models Utilized |
| :--- | :--- |
| Variant Curation & Rules | `Offer.rulesEn/Ar/Fr`, `Offer.labelEn/Ar/Fr`, `Offer.markupPercent`, `Offer.badge` |
| Fallback Chains | `OfferProviderLink.priority`, `OfferProviderLink.isEnabled` |
| Categories | `Category` |
| Order Recovery & Refund | `Order`, `OrderItem`, `ProviderOrder`, `FulfillmentAttempt`, `WalletTransaction` |
| Users & Wallet Adjustments | `User`, `Wallet`, `WalletTransaction`, `AuditLog` |
| Reseller Tiers & Overrides | `ResellerTier`, `OfferTierPriceOverride`, `User` |
| Audit Trail | `AuditLog` |
| Provider Sync & Balances | `Provider`, `SyncRun` |

---

## 5. Phased Implementation Roadmap

```
Sprint 1: Variant Curation & Warranty Badging Cockpit
  ├── Task 1.1: 1-Click "Create Variant from Provider SKU" modal
  ├── Task 1.2: Multi-lang labels (EN/AR/FR) + multi-lang rules (EN/AR/FR)
  ├── Task 1.3: Markup % calculator with live retail USD/DZD preview & badge selector
  ├── Task 1.4: OfferProviderLink management (strict identical fallback reordering)
  └── Task 1.5: Storefront product view rules & warranty badge display

Sprint 2: Order Operations & Recovery
  ├── Task 2.1: Order retry dispatch server action
  ├── Task 2.2: Manual key delivery modal (AWAITING_SELLER)
  ├── Task 2.3: 1-Click wallet refund action
  └── Task 2.4: Decrypted order inspection drawer

Sprint 3: User Console & Reseller Program
  ├── Task 3.1: /admin/users list with wallet balance overview
  ├── Task 3.2: Manual balance adjustment modal (+/-) with audit logging
  ├── Task 3.3: /admin/resellers application review queue
  └── Task 3.4: Wholesale price override matrix (OfferTierPriceOverride)

Sprint 4: Categories & Dashboard KPIs
  ├── Task 4.1: Category CRUD management (/admin/categories)
  ├── Task 4.2: Executive KPI dashboard cards (revenue, liability, alerts)
  └── Task 4.3: Audit Log Explorer (/admin/audit)
```

---

## 6. Verification & Quality Plan

1. **Automated Unit & Integration Tests**:
   - Tests in `tests/admin-catalog.test.ts` verifying offer creation with multi-lang rules, badges, and link priority.
   - Tests in `tests/admin-orders.test.ts` asserting manual refund credits wallet and writes `AuditLog`.
   - Verification of `priceForOffer` ensuring separate variants retain independent pricing.
   - Maintain 100% green status on `tsc --noEmit` and `vitest run`.
2. **Design Standards**:
   - Strict adherence to repository theme tokens (`globals.css`), functional glass, warm `#f7f6f2` / deep `#0d0f11` palette, and emerald accents.
   - Complete RTL support for Arabic administration.
3. **Knowledge Graph Synchronization**:
   - Run `/home/oussama-blh/.local/bin/graphify update .` after every code change to keep knowledge graph up to date.
