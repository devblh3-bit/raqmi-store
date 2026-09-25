# 1. Islamic Agency Procurement & Catalog Lifecycle

Date: 2026-09-24  
Status: Accepted

## Context

The storefront operates under an Islamic agency (`Wakalah bi ujrah`) commerce model where the platform acts as an authorized purchasing agent (*Wakil*) procuring digital goods on behalf of customers (*Muwakkil*) rather than trading in unpossessed floating inventory (*Bay' ma la yamluk*).

## Decisions

1. **Wholesale Provider Decoupling**: Customer storefront `Offer` records are decoupled from upstream `ProviderOffer` inventory. Orders trigger programmatic procurement against prioritized upstream suppliers (Canboso, QCST, VenteBot).
2. **Deterministic Agency Fee**: The customer authorizes an explicit procurement capital plus an agreed agency fee (`AgencyFee`), locked at order placement.
3. **Failover Procurement Chain**: Each storefront offer routes through `OfferProviderLink` priorities. If a primary supplier fails or runs out of stock, secondary suppliers are attempted automatically before falling back to manual admin resolution.

## Consequences

- **Positive**: Strict Shariah compliance, zero inventory carry risk, automated multi-supplier redundancy.
- **Negative**: Dynamic currency conversion required between upstream supplier pricing (USD/VND) and Algerian DZD.
