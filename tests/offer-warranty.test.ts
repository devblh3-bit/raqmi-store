import { describe, it, expect } from "vitest";
import React from "react";
import {
  OfferWarranty,
  CardWarrantyAccordion,
  cleanRulesText,
} from "@/components/OfferWarranty";
import type { CatalogOffer } from "@/lib/catalog";

describe("OfferWarranty Component & Text Cleaner", () => {
  it("cleans HTML tags and excessive line breaks from provider rules", () => {
    const raw =
      "<blockquote><b>⚡ Instant replacement</b></blockquote><br><br><br>Full 365 days coverage. Contact support.&nbsp;&amp;&nbsp;enjoy.";
    const cleaned = cleanRulesText(raw);
    expect(cleaned).not.toContain("<blockquote>");
    expect(cleaned).not.toContain("<b>");
    expect(cleaned).not.toContain("&nbsp;");
    expect(cleaned).toContain("⚡ Instant replacement");
    expect(cleaned).toContain("Full 365 days coverage.");
    expect(cleaned).toContain("& enjoy.");
  });

  const sampleOffer: CatalogOffer = {
    id: "offer-1",
    label: { en: "1 Year Full Warranty", ar: "ضمان كامل لمدة سنة" },
    rules: {
      en: "Full 365 days coverage. Contact support with order code.",
      ar: "ضمان كامل طوال 365 يوماً. تواصل مع الدعم برمز الطلب.",
    },
    price: 5000,
    baseCost: 4000,
    agencyFee: 1000,
    requiresCustomerInput: false,
  };

  it("renders inline accordion for active card (Approach A)", () => {
    const element = CardWarrantyAccordion({
      offer: sampleOffer,
      locale: "en",
    });

    expect(element).toBeDefined();
    expect(element.type).toBe("div");
    expect(element.props.className).toContain("border-t");
    // Child is details
    expect(element.props.children.type).toBe("details");
  });

  it("renders in card mode (Option 1) with green tint and trust tags", () => {
    const element = OfferWarranty({
      offer: sampleOffer,
      locale: "en",
      mode: "card",
    });

    expect(element).toBeDefined();
    expect(element.type).toBe("div");
    expect(element.props.className).toContain("rounded-2xl");
    expect(element.props.className).toContain("border-emerald-500/20");
  });

  it("renders in accordion mode (Option 2) with details tag", () => {
    const element = OfferWarranty({
      offer: sampleOffer,
      locale: "en",
      mode: "accordion",
    });

    expect(element).toBeDefined();
    expect(element.type).toBe("details");
    expect(element.props.className).toContain("group");
  });

  it("falls back to default warranty when no rules are set on offer", () => {
    const noRulesOffer: CatalogOffer = {
      id: "offer-2",
      label: { en: "Standard Access" },
      price: 1000,
      baseCost: 800,
      agencyFee: 200,
      requiresCustomerInput: false,
    };

    const element = OfferWarranty({
      offer: noRulesOffer,
      locale: "en",
      mode: "card",
    });

    expect(element).toBeDefined();
    expect(element.type).toBe("div");
  });
});
