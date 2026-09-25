# Catalog & Procurement

The catalog and procurement context manages the curation, taxonomy, supplier linking, and fulfillment routing of digital goods for the Algerian market under an Islamic agency (`Wakalah bi ujrah`) commerce model.

## Language

### Catalog Taxonomy

**Category**:
A top-level intent-driven grouping that organizes complementary digital products for customer discovery (`ai-dev`, `design-creative`, `productivity`, `entertainment`, `security-utilities`).
_Avoid_: Collection, department, group

**Product**:
A distinct software service, application, or utility presented to the customer with dedicated localized copy and a canonical slug.
_Avoid_: Item, SKU, listing, tool

**Offer**:
A purchasable customer-facing variant of a Product, distinguished by duration, usage volume, or seat tier.
_Avoid_: Variant, plan, tier, option

**FulfillmentType**:
The delivery mechanism and customer input contract required to fulfill an Offer: instant digital key (`KEY`), personal account invitation (`INVITE`), or pre-activated account credentials (`PRE_ACTIVATED`).
_Avoid_: Delivery method, dispatch type, item format

**WarrantyTier**:
The standardized protection guarantee backing an Offer: full-term duration (`FULL_TERM`), 24-hour instant activation guarantee (`ACTIVATION_24H`), or permanent OEM license guarantee (`LIFETIME_OEM`).
_Avoid_: Guarantee level, return policy, warranty plan

### Procurement & Upstream

**Provider**:
An upstream wholesale digital supplier bot or API (e.g. Canboso, QCST, VenteBot) integrated with the platform.
_Avoid_: Vendor, supplier, wholesaler

**ProviderOffer**:
A raw upstream SKU supplied by a Provider, retaining wholesale cost, raw descriptions, and provider stock status.
_Avoid_: Upstream SKU, wholesale offer, raw product

**OfferProviderLink**:
A prioritized failover route linking a storefront Offer to one or more ProviderOffers for automated procurement.
_Avoid_: Provider mapping, failover chain, fallback link

### Commercial & Agency

**AgencyFee**:
The transparent, agreed-upon service fee earned by the platform acting as a purchasing proxy on behalf of the customer.
_Avoid_: Profit margin, markup, markup minor, commission
