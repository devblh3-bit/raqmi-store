Here is a complete, page-by-page visual breakdown of the admin experience—how every screen looks, what controls you have, and what happens when you click them.

---

# 🗺️ The Complete Admin Panel Experience

```
ADMIN SIDEBAR NAVIGATION
┌────────────────────────────────────────┐
│  RAQMI ADMIN                           │
│                                        │
│  📊 Dashboard       /admin             │
│  📦 Products        /admin/catalog     │
│  🏷️ Categories      /admin/categories  │
│  🛒 Orders          /admin/orders      │
│  💳 Deposits        /admin/deposits    │
│  👥 Users           /admin/users       │
│  🤝 Resellers       /admin/resellers   │
│  🔄 Providers & Sync /admin/sync       │
│  📜 Audit Logs      /admin/audit       │
│  ⚙️ Settings        /admin/settings    │
└────────────────────────────────────────┘
```

---

## 1. Executive Dashboard (`/admin`)
**Purpose:** Give you a 5-second health check of your entire business the moment you log in.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                             │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ Today Sales  │ │ 30-Day Gross │ │ Customer Liab│ │ Pending Action │ │
│  │ $1,420.50    │ │ $34,800.00   │ │ $4,250.00    │ │ 3 Deposits     │ │
│  │ 42 Orders    │ │ 1,120 Orders │ │ (Total unspent)│ 2 Stuck Orders │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│  ⚠️ OPERATIONAL ACTION BANNER                                          │
│  • 3 Deposits waiting for proof review          [ View Deposits → ]   │
│  • 2 Orders failed fulfillment (need manual key)[ View Orders → ]     │
│  • Provider VBR balance is below $50 ($15.57)   [ Top Up Provider → ] │
├────────────────────────────────────────────────────────────────────────┤
│  Provider API Balances:                                                │
│  • VBR: $15.57 (Low ⚠️)   • QCST: $340.00 (Healthy)  • Canboso: $85.00 │
└────────────────────────────────────────────────────────────────────────┘
```

### The Admin Experience
- You instantly see if any customers deposited money that needs approval.
- You see if your upstream supplier balances are running low before customers get hit with out-of-stock errors.
- You see how much money is sitting inside customer wallets.

---

## 2. Catalog: Product Directory (`/admin/catalog`)
**Purpose:** High-level management of products, visibility switches, and quick navigation.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Products                             [ + Create New Product ]         │
│                                                                        │
│  [ Search by name or slug...        ]  [ Category: All ▼ ] [ Status: All ▼ ]
├────────────────────────────────────────────────────────────────────────┤
│  Product         Category    Variants   Status      Sort   Actions     │
├────────────────────────────────────────────────────────────────────────┤
│  [Logo] ChatGPT  AI & Tools  3 offers   🟢 Active    1     [ Edit ]    │
│  Slug: chatgpt               (1 pinned)                    [ Offers → ]│
├────────────────────────────────────────────────────────────────────────┤
│  [Logo] Canva    Design      2 offers   🟢 Active    2     [ Edit ]    │
│  Slug: canva-pro             (2 pinned)                    [ Offers → ]│
├────────────────────────────────────────────────────────────────────────┤
│  [Logo] Spotify  Music       4 offers   ⚪ Inactive  3     [ Edit ]    │
│  Slug: spotify-prem          (0 pinned)                    [ Offers → ]│
└────────────────────────────────────────────────────────────────────────┘
```

### The Admin Experience
- **1-Click Quick Toggle**: Click the green `Active` pill to immediately hide/show the product on the storefront.
- Click **`[ Offers → ]`** to jump straight to the variant curation studio for that specific product.

---

## 3. The Curation Studio: Variants & Provider Pool (`/admin/catalog/[id]/offers`)
**Purpose:** This is the heart of your catalog. Curate distinct variants, write localized rules, set markups, and manage backup suppliers.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  ← Back to Product          Offers — ChatGPT Plus                      │
├────────────────────────────────────────────────────────────────────────┤
│  LIVE STOREFRONT VARIANTS (2 Active)                                   │
├────────────────────────────────────────────────────────────────────────┤
│  Variant 1: "1 Month — Shared Profile (15-Day Warranty)"  [BUDGET]    │
│  Retail: $9.99 USD (≈ 2,400 DZD) · Markup: 42% · Stock: 45             │
│  EN Rules: "Shared 1-device profile. 15 days replacement warranty."   │
│  AR Rules: "حساب مشترك لجهاز واحد. ضمان استبدال 15 يوم."               │
│                                                                        │
│  Linked Suppliers:                                                     │
│  • Priority 1 (Primary): [VBR] SKU #vbr-gpt-shared ($7.00) [Active ✓]  │
│  • Priority 2 (Backup):  [QCST] SKU #qc-gpt-shared ($7.50) [Active ✓]  │
│                                                                        │
│  [ Edit Labels & Rules ]  [ + Link Backup Supplier ]  [ Unpin Variant ]│
├────────────────────────────────────────────────────────────────────────┤
│  Variant 2: "1 Month — Private Account (30-Day Warranty)" [VIP]       │
│  Retail: $19.99 USD (≈ 4,800 DZD) · Markup: 25% · Stock: 18            │
│  EN Rules: "Upgraded on personal email. 30 days full replacement."     │
│  AR Rules: "ترقية على إيميلك الشخصي. ضمان كامل لمدة 30 يوم."           │
│                                                                        │
│  Linked Suppliers:                                                     │
│  • Priority 1 (Primary): [QCST] SKU #qc-gpt-priv ($16.00)  [Active ✓]  │
│                                                                        │
│  [ Edit Labels & Rules ]  [ + Link Backup Supplier ]  [ Unpin Variant ]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  AVAILABLE SUPPLIER POOL (Synced from APIs)                            │
│  [ Search raw name / SKU...       ] [ Provider: All ▼ ] [ Filter ]     │
├────────────────────────────────────────────────────────────────────────┤
│  Provider  SKU & Supplier Name          Cost    Stock   Action         │
├────────────────────────────────────────────────────────────────────────┤
│  [VBR]     #vbr-gpt-shared-1m           $7.00   45      [ + Create New │
│            "ChatGPT Plus Shared 15d"                    Variant ]      │
├────────────────────────────────────────────────────────────────────────┤
│  [QCST]    #qc-gpt-priv-1m              $16.00  18      [ + Create New │
│            "ChatGPT Plus Private Email"                 Variant ]      │
├────────────────────────────────────────────────────────────────────────┤
│  [Canboso] #can-gpt-priv-1m             $16.50  10      [ + Attach as  │
│            "ChatGPT Plus Upgrade Key"                   Backup ]       │
└────────────────────────────────────────────────────────────────────────┘
```

### The Step-by-Step Workflow

#### Workflow A: Clicking `[ + Create New Variant ]`
When you click this on a supplier row, a **slide-over modal** opens:
1. **Supplier Info (Read-Only Box)**: Shows provider name, SKU, cost ($7.00), and original supplier notes.
2. **Variant Labels (EN / AR / FR)**: 
   - You type: `1 Month — Shared Profile (15-Day Warranty)` (and translations).
3. **Customer Rules & Warranty Instructions (EN / AR / FR Textareas)**:
   - You type the instructions the buyer sees: e.g. *"Account login delivered instantly. 15-day replacement warranty. Do not alter email/password."*
4. **Markup & Price Calculator**:
   - You enter your markup %: `42%`.
   - The UI immediately computes: `$7.00 cost + 42% = $9.99 selling price (≈ 2,400 DZD)`.
5. **Badge Picker**: Select `BUDGET`, `POPULAR`, or `VIP`.
6. Click **Confirm**: The variant is live, pinned, and linked to that provider!

#### Workflow B: Clicking `[ + Link Backup Supplier ]`
If another supplier has the **exact same warranty & terms**:
- Select the supplier from a dropdown.
- It attaches as **Priority 2**.
- If Priority 1 goes out of stock, Priority 2 automatically takes over.

---

## 4. Orders Management & Recovery (`/admin/orders`)
**Purpose:** Monitor customer purchases and recover from provider errors without touching code.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Orders                                                                │
│  [ All ] [ Pending ] [ Paid ] [ Completed ] [ Failed ⚠️ ]              │
│  [ Search order code / email...                                      ] │
├────────────────────────────────────────────────────────────────────────┤
│  Code        Customer         Total    Status       Items    Actions   │
├────────────────────────────────────────────────────────────────────────┤
│  #RQM-91A4   sam@gmail.com    $19.99   🟢 COMPLETED ChatGPT  [ View ]  │
│  22 Sep 08:14                          (Auto-VBR)   1M-VIP             │
├────────────────────────────────────────────────────────────────────────┤
│  #RQM-88B1   karim@yahoo.fr   $9.99    🔴 FAILED    ChatGPT  [ Action ▼│
│  22 Sep 07:30                          (OOS)        1M-Shared          │
└────────────────────────────────────────────────────────────────────────┘
```

### The Action Menu on a FAILED Order:
When you click **`[ Action ▼ ]`** on a failed order, you get 3 instant levers:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ORDER #RQM-88B1 — CUSTOMER: karim@yahoo.fr — AMOUNT: $9.99            │
│  Item: ChatGPT Plus (1M-Shared)                                        │
│  Failure Reason: Supplier VBR returned "Out of Stock" (HTTP 409)       │
├────────────────────────────────────────────────────────────────────────┤
│  CHOOSE RECOVERY ACTION:                                               │
│                                                                        │
│  1. 🔄 [ Retry via Backup Supplier (QCST) ]                            │
│     Dispatches purchase immediately to Priority 2 supplier.            │
│                                                                        │
│  2. ✍️ [ Manual Key / Credential Delivery ]                             │
│     Open modal: Paste account email/password or license key manually.  │
│     Encrypts credentials and completes order immediately.              │
│                                                                        │
│  3. 💰 [ 1-Click Refund to Customer Wallet ]                           │
│     Cancels order and credits $9.99 back to customer's wallet balance. │
│     Sends Telegram alert: "Your order was refunded due to stock."      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Deposits & Treasury Queue (`/admin/deposits`)
**Purpose:** Review customer top-up proofs and approve/reject wallet credits safely.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Deposits                                                              │
│  [ Pending (3) ] [ Approved ] [ Rejected ] [ All ]                     │
├────────────────────────────────────────────────────────────────────────┤
│  Customer          Method        Amount    Proof / TxHash    Actions   │
├────────────────────────────────────────────────────────────────────────┤
│  omar@gmail.com    MANUAL_BANK   $50.00    [ 🖼️ View Receipt] [ Approve]│
│  CCP Slip #48192   (CCP Algerie)           (Zoom Lightbox)   [ Reject ]│
├────────────────────────────────────────────────────────────────────────┤
│  amine@crypto.io   USDT_BEP20    $100.00   0x4f81...c39a     [ Approve]│
│  Confirmed 20/20   (BSC)                   [ 🔗 BscScan ]    [ Reject ]│
└────────────────────────────────────────────────────────────────────────┘
```

### The Admin Experience
- **Proof Lightbox**: Click `[ 🖼️ View Receipt ]` $\rightarrow$ an instant zoom viewer opens to inspect the payment slip or bank stamp.
- **Crypto Verification**: Click `[ 🔗 BscScan ]` $\rightarrow$ opens the public blockchain explorer to confirm the TX hash.
- **Click `[ Approve ]`**:
  - Automatically runs inside a serializable transaction.
  - Credits the exact USD amount into the user's wallet.
  - Sends a Telegram notification to the user: *"Your deposit of $50.00 has been approved!"*

---

## 6. User Directory & Wallet Adjustments (`/admin/users`)
**Purpose:** Manage customer accounts, check balances, and make manual credit/debit adjustments with an audit trail.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  User Directory                                                        │
│  [ Search user by email or Telegram ID...                            ] │
├────────────────────────────────────────────────────────────────────────┤
│  User Email       Role        Wallet Balance   Orders   Actions        │
├────────────────────────────────────────────────────────────────────────┤
│  oussama@live.com CUSTOMER    $42.50 USD       14       [ Adjust +/- ] │
│  TG: @oussamablh              (≈ 10,200 DZD)            [ View Orders ]│
├────────────────────────────────────────────────────────────────────────┤
│  tech_reseller    RESELLER    $350.00 USD      89       [ Adjust +/- ] │
│  TG: @tech_store  (Gold Tier) (≈ 84,000 DZD)            [ Pricing Matrix│
└────────────────────────────────────────────────────────────────────────┘
```

### The Manual Balance Adjustment Modal:
When you click **`[ Adjust +/- ]`**:
```
┌────────────────────────────────────────────────────────────────────────┐
│  MANUAL WALLET ADJUSTMENT — oussama@live.com                           │
│  Current Balance: $42.50 USD                                           │
├────────────────────────────────────────────────────────────────────────┤
│  Action Type: (●) Credit Add (+)     ( ) Debit Deduct (-)              │
│  Amount: [ $15.00 ] USD                                                │
│                                                                        │
│  * Mandatory Reason (Audit Logged):                                    │
│  [ Compensation for order delay #RQM-7712                           ]  │
├────────────────────────────────────────────────────────────────────────┤
│  [ Cancel ]                                   [ Confirm Adjustment ]   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. B2B Resellers Management (`/admin/resellers`)
**Purpose:** Approve wholesale reseller applications and configure special price overrides.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Reseller Program                                                      │
│  [ Reseller Applications (2 Pending) ] [ Active Resellers ] [ Tiers ]  │
├────────────────────────────────────────────────────────────────────────┤
│  Applicant        Applied Date  Total Spent  Applicant Note  Actions   │
├────────────────────────────────────────────────────────────────────────┤
│  alger_cards@dz   21 Sep 14:20  $820.00      "Telegram store [Approve] │
│  TG: @algercards                             with 5k subs"   [Reject]  │
└────────────────────────────────────────────────────────────────────────┘
```

- When you click **`[ Approve ]`**: A prompt asks: *"Assign Tier: [ Gold Reseller (10% off) ▼ ]"*.  
- The user's role immediately becomes `RESELLER`. Whenever they log in to the storefront, all prices automatically show their wholesale discount!

---

## 8. Provider Sync & API Balances (`/admin/sync`)
**Purpose:** Keep an eye on external API health, trigger manual syncs, and set low-balance warnings.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Providers & Sync Operations                                           │
├────────────────────────────────────────────────────────────────────────┤
│  [VBR Provider]                                                        │
│  Status: 🟢 Active  ·  Wholesale Balance: $15.57 USD (⚠️ LOW BALANCE)   │
│  Auto-Pause Threshold: [ $50.00 ] [ Save ]                             │
│  [ Disable Provider ]  [ Refresh Balance ]  [ 🔄 Sync Catalog Now ]    │
├────────────────────────────────────────────────────────────────────────┤
│  [QCST Provider]                                                       │
│  Status: 🟢 Active  ·  Wholesale Balance: $340.00 USD (Healthy)         │
│  Auto-Pause Threshold: [ $30.00 ] [ Save ]                             │
│  [ Disable Provider ]  [ Refresh Balance ]  [ 🔄 Sync Catalog Now ]    │
├────────────────────────────────────────────────────────────────────────┤
│  Recent Automated Sync Logs:                                           │
│  • 22 Sep 08:00: VBR Sync finished (+0 added, 142 updated) · OK        │
│  • 22 Sep 07:45: QCST Sync finished (+2 added, 88 updated) · OK        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 9. System Settings & Currency Engine (`/admin/settings`)
**Purpose:** Manage global settings like exchange rates and maintenance mode.

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│  Global Settings                                                       │
├────────────────────────────────────────────────────────────────────────┤
│  1. CURRENCY CONVERSION ENGINE                                         │
│  Base Accounting: USD ($)                                              │
│  Storefront Display Multiplier: 1 USD = [ 240.00 ] DZD  [ Update Rate ]│
│  (Immediately recalculates all DZD estimates across the storefront)    │
├────────────────────────────────────────────────────────────────────────┤
│  2. STOREFRONT STATUS                                                  │
│  Operational Mode: (●) Open for Orders   ( ) Maintenance Mode          │
│  Banner Message: [ We are upgrading provider servers. Back in 1 hour. ]│
├────────────────────────────────────────────────────────────────────────┤
│  3. TELEGRAM BOT MONITOR (@Devblh_bot)                                 │
│  Webhook Status: 🟢 Connected  ·  Latency: 180ms                       │
│  Admin Chat ID: 2112083087                                             │
│  [ Send Test Alert to Telegram ]                                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Summary of What This Delivers
1. **Catalog Control**: You create distinct variants with custom titles, rules, and badges in 1 click.
2. **Order Safety**: You never lose money on a stuck order—you have Retry, Manual Delivery, and 1-Click Refund.
3. **Financial Security**: You see live balances, customer liabilities, and adjust user wallets with audit notes.
4. **Reseller Engine**: You manage wholesale clients with special discount tiers.

How does this breakdown look to you? Are there any specific screens or buttons you want adjusted before we start coding?