# 3. Catalog Taxonomy, Delivery Classification & Curation Architecture

Date: 2026-09-24  
Status: Accepted

## Context

The initial catalog structure had 10 fragmented categories with legacy Indonesian slugs (`akun`, `kreatif`, `lisensi`, `pendidikan`, `sosial`), empty sections, ambiguity between subscription accounts vs API token packs, and zero visibility into whether an item was a key, email invite, or pre-made account.

## Decisions

1. **5 Intent-Driven Macro-Categories**: Consolidated catalog taxonomy into 5 high-density categories ordered by Algerian buyer demand:
   - `ai-dev`: AI workspace subscriptions and developer API tokens (ChatGPT, Claude, Gemini, API packs).
   - `design-creative`: Creative design, video editing, and stock asset tools (Canva, CapCut, Adobe, Freepik).
   - `productivity`: Office software, cloud suites, and utility tools (Microsoft 365, Office 2024, Windows 11, Zoom, QuillBot).
   - `entertainment`: Streaming media, music, and community gaming (Netflix, Spotify, YouTube, Discord Nitro).
   - `security-utilities`: Virtual private networks (VPN), accounts, and antivirus (NordVPN, Surfshark, Aged Gmail, Duolingo, Kaspersky).
2. **Distinct Product Consumption Boundaries**: Distinct consumption models (e.g. `claude-pro` account vs `claude-api-credits` token packs; `microsoft-365` cloud suite vs `windows-11-pro` lifetime OEM keys) are separated into dedicated `Product` entities with tailored warranty instructions and search targeting.
3. **Explicit FulfillmentType Model**: Every `Offer` specifies a concrete `fulfillmentType`:
   - `KEY`: Instant license delivery without customer inputs.
   - `INVITE`: Personal account upgrade requiring customer email input, captured contextually inline on the product card selector.
   - `PRE_ACTIVATED`: Pre-made credentials delivered upon procurement.
   Storefront offer selector badges render these delivery expectations explicitly before checkout.
4. **3 Standardized Customer Warranty Tiers**: Standardized upstream warranty text into three customer-facing tiers:
   - `FULL_TERM`: Full duration warranty for subscriptions (1m/3m/12m).
   - `ACTIVATION_24H`: 24-hour instant delivery and activation guarantee for token packs and accounts.
   - `LIFETIME_OEM`: Permanent hardware binding guarantee for Windows/Office OEM keys.
5. **Dynamic Agency Pricing & Failover Absorptive Buffer**: Storefront prices are pegged to the active primary provider (Priority 0). If failover occurs mid-transaction, minor wholesale cost spreads are absorbed by the agency fee rather than failing the customer's dispatch.
6. **Zero-Inventory Restock UX**: If all linked providers for an offer are out of stock, the variant is disabled with an "Out of stock" pill and provides a direct WhatsApp restock inquiry link.
7. **Phased Curation Strategy**: Launch with 22 verified hero products featuring multi-supplier failover links. Unlinked upstream items (~500 SKUs) remain in the Admin Studio inbox for progressive onboarding.
8. **English Kebab-Case Slug Standardization**: All category and product routing slugs adhere to English kebab-case (`/categories/ai-dev`) to prevent URL encoding corruption across social messaging platforms, accompanied by localized display names in Arabic, English, and French.

## Consequences

- **Positive**: Eliminates thin/empty categories, eliminates delivery confusion/disputes, improves storefront credibility, and simplifies navigation for Algerian buyers.
- **Negative**: Requires category and product data migration in Prisma seed scripts and updating existing static catalog references.
