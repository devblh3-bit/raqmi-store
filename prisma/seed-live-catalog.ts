/**
 * Seeds and consolidates the storefront with real, in-stock products and offers
 * from connected supplier bots (Canboso, QCST, VBR).
 *
 * Removes the temporary synthetic "seed" provider and placeholder offers,
 * and attaches real live offers directly onto clean, canonical product slugs.
 *
 * Run: npx tsx --conditions=react-server --env-file=.env prisma/seed-live-catalog.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ProviderLinkSpec {
  providerCode: "canboso" | "qcst" | "vbr";
  providerSku: string;
  priority?: number;
}

interface OfferSpec {
  label: { en: string; ar: string; fr: string };
  badge?: string;
  markupPercent: number;
  compareAtMinor?: number; // USD cents
  rules?: { en: string; ar: string; fr: string };
  links: ProviderLinkSpec[];
}

interface ProductSpec {
  slug: string;
  categorySlug: string;
  name: { en: string; ar: string; fr: string };
  description: { en: string; ar: string; fr: string };
  image: string; // brand token for ProductArt (e.g. "claude", "youtube", etc.)
  isFeatured?: boolean;
  isNew?: boolean;
  soldCount?: number;
  sortOrder?: number;
  offers: OfferSpec[];
}

const canonicalLiveProducts: ProductSpec[] = [
  // =========================================================================
  // CATEGORY: AI & LLM (ai)
  // =========================================================================
  {
    slug: "claude-pro",
    categorySlug: "ai",
    name: {
      en: "Claude AI & API Credits",
      ar: "كلود الذكاء الاصطناعي وتوكنات API",
      fr: "Claude AI & Crédits API",
    },
    description: {
      en: "High-performance Claude 3.5 Sonnet, Opus & Haiku API access for coding, autonomous agents, and AI development. Full warranty and instant delivery.",
      ar: "وصول عالي السرعة لتوكنات Claude 3.5 Sonnet و Opus للمطورين ومساعدي البرمجة وأدوات الذكاء الاصطناعي. تسليم فوري وضمان كامل.",
      fr: "Accès haute vitesse aux tokens Claude 3.5 Sonnet, Opus et Haiku pour le développement et l'automatisation IA. Garantie complète et livraison instantanée.",
    },
    image: "claude",
    isFeatured: true,
    isNew: true,
    soldCount: 342,
    sortOrder: 1,
    offers: [
      {
        label: {
          en: "10M Token Claude 1 Day (Full Warranty)",
          ar: "10 مليون توكن كلود - يوم واحد (ضمان كامل)",
          fr: "10M Tokens Claude 1 Jour (Garantie Complète)",
        },
        badge: "Popular",
        markupPercent: 30, // $1.15 -> ~$1.50
        compareAtMinor: 250,
        rules: {
          en: "24-hour validity from activation. Covers all Claude 3.5 Sonnet and Opus models.",
          ar: "صلاحية 24 ساعة من التفعيل. يدعم جميع موديلات Claude 3.5 Sonnet و Opus.",
          fr: "Validité 24 heures après activation. Compatible avec tous les modèles Claude 3.5.",
        },
        links: [{ providerCode: "canboso", providerSku: "6aacd2725271203cb12bbb68", priority: 0 }],
      },
      {
        label: {
          en: "50M Token Claude 1 Day (Full Warranty)",
          ar: "50 مليون توكن كلود - يوم واحد (ضمان كامل)",
          fr: "50M Tokens Claude 1 Jour (Garantie Complète)",
        },
        markupPercent: 23, // $3.24 -> ~$3.99
        compareAtMinor: 599,
        rules: {
          en: "24-hour validity. Recommended for intensive coding and multi-file codebases.",
          ar: "صلاحية 24 ساعة. موصى به لمهام البرمجة المكثفة والمشاريع الكبيرة.",
          fr: "Validité 24 heures. Recommandé pour le codage intensif et les grands projets.",
        },
        links: [{ providerCode: "canboso", providerSku: "6aacd29d5271203cb12bc663", priority: 0 }],
      },
      {
        label: {
          en: "100M Token Claude 1 Day (Full Warranty)",
          ar: "100 مليون توكن كلود - يوم واحد (ضمان كامل)",
          fr: "100M Tokens Claude 1 Jour (Garantie Complète)",
        },
        badge: "Best Value",
        markupPercent: 20, // $4.57 -> ~$5.49
        compareAtMinor: 899,
        rules: {
          en: "Heavy developer tier. Dedicated bandwidth and fast response rates.",
          ar: "باقة المطورين الكبرى. سرعة استجابة عالية ونطاق ترددي مخصص.",
          fr: "Forfait développeur intensif. Bande passante dédiée et réponses rapides.",
        },
        links: [{ providerCode: "canboso", providerSku: "6aacd2b75271203cb12bcb99", priority: 0 }],
      },
      {
        label: {
          en: "200M Token Claude 1 Day (Full Warranty)",
          ar: "200 مليون توكن كلود - يوم واحد (ضمان كامل)",
          fr: "200M Tokens Claude 1 Jour (Garantie Complète)",
        },
        badge: "Pro",
        markupPercent: 18, // $7.58 -> ~$8.95
        compareAtMinor: 1400,
        links: [{ providerCode: "canboso", providerSku: "6aacd2d95271203cb12bd1b8", priority: 0 }],
      },
    ],
  },
  {
    slug: "gemini-pro",
    categorySlug: "ai",
    name: {
      en: "Google Gemini Pro AI",
      ar: "جوجل جيميني برو Google Gemini Pro",
      fr: "Google Gemini Pro AI",
    },
    description: {
      en: "Official Google Gemini Pro access with 5TB Cloud Drive storage. Built for deep reasoning, multimodal vision, coding, and Veo video generation.",
      ar: "اشتراك رسمي في Google Gemini Pro مع مساحة تخزين 5 تيرابايت على Google Drive. مثالي للأبحاث والبرمجة وتحليل الفيديو وتوليد الوسائط المتعددة.",
      fr: "Accès officiel Google Gemini Pro avec 5 To de stockage Google Drive. Idéal pour le code, la recherche et la génération vidéo.",
    },
    image: "gemini",
    isFeatured: true,
    soldCount: 512,
    sortOrder: 2,
    offers: [
      {
        label: {
          en: "Gemini Pro 1 Year (Add Slot - Full Warranty)",
          ar: "جيميني برو سنة كاملة (إضافة حساب - ضمان كامل)",
          fr: "Gemini Pro 1 An (Ajout Slot - Garantie Totale)",
        },
        badge: "1 Year",
        markupPercent: 150, // 20,000 VND (~$0.80) -> ~$2.00
        compareAtMinor: 1200,
        rules: {
          en: "Invite added directly to your Google account with 1-year warranty.",
          ar: "تتم إضافة الدعوة مباشرة إلى حساب جوجل الخاص بك مع ضمان سنة كاملة.",
          fr: "Invitation ajoutée directement à votre compte Google avec garantie 1 an.",
        },
        links: [{ providerCode: "qcst", providerSku: "prod_70c9d3ade6c62ba65536", priority: 0 }],
      },
      {
        label: {
          en: "Gemini Pro 18 Months (Activation Link)",
          ar: "جيميني برو 18 شهراً (رابط تفعيل مباشر)",
          fr: "Gemini Pro 18 Mois (Lien d'activation)",
        },
        badge: "Hot",
        markupPercent: 170, // 18,525 VND (~$0.74) -> ~$2.00
        compareAtMinor: 1800,
        links: [{ providerCode: "qcst", providerSku: "prod_09e6e3ec3ef39ef4746f", priority: 0 }],
      },
    ],
  },
  {
    slug: "chatgpt-plus",
    categorySlug: "ai",
    name: {
      en: "ChatGPT & Codex API",
      ar: "شات جي بي تي وتوكنات Codex",
      fr: "ChatGPT & API Codex",
    },
    description: {
      en: "High-speed OpenAI GPT-4o and Codex developer token credits for automated coding, analysis, and API workflows.",
      ar: "رصيد توكنات مطوري كودكس و GPT-4o عالي السرعة لمهام البرمجة والتحليل والتطبيقات الذكية.",
      fr: "Crédits de tokens développeur Codex et GPT-4o haute vitesse pour le codage et les flux API.",
    },
    image: "chatgpt",
    isFeatured: true,
    soldCount: 420,
    sortOrder: 3,
    offers: [
      {
        label: {
          en: "API Codex 30M Token 1 Day (Full Warranty)",
          ar: "30 مليون توكن كودكس - يوم واحد (ضمان كامل)",
          fr: "30M Tokens Codex 1 Jour (Garantie Totale)",
        },
        badge: "Popular",
        markupPercent: 50, // 27,000 VND (~$1.08) -> ~$1.62
        compareAtMinor: 400,
        links: [{ providerCode: "qcst", providerSku: "prod_c3a078ee442de87202ce", priority: 0 }],
      },
      {
        label: {
          en: "API Codex 100M Token 1 Day (Full Warranty)",
          ar: "100 مليون توكن كودكس - يوم واحد (ضمان كامل)",
          fr: "100M Tokens Codex 1 Jour (Garantie Totale)",
        },
        badge: "Best Value",
        markupPercent: 40, // 66,000 VND (~$2.64) -> ~$3.70
        compareAtMinor: 800,
        links: [{ providerCode: "qcst", providerSku: "prod_77397b7a264e838cf7a5", priority: 0 }],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: DESIGN & CREATIVE (kreatif)
  // =========================================================================
  {
    slug: "capcut-pro",
    categorySlug: "kreatif",
    name: {
      en: "CapCut Pro Video Editor",
      ar: "محرر الفيديو كاب كات برو CapCut Pro",
      fr: "CapCut Pro Éditeur Vidéo",
    },
    description: {
      en: "All VIP filters, transitions, auto-captions, smart background removal, and 4K 60fps export on Windows, Mac, iOS, and Android.",
      ar: "جميع المؤثرات الاحترافية والانتقالات بالذكاء الاصطناعي وإزالة الخلفية والتصدير بدقة 4K 60fps على الهواتف والكمبيوتر.",
      fr: "Tous les effets VIP, transitions IA, sous-titres automatiques et export 4K sur mobile, Mac et PC.",
    },
    image: "capcut",
    isFeatured: true,
    soldCount: 890,
    sortOrder: 4,
    offers: [
      {
        label: {
          en: "CapCut Pro 7 Days (Full Warranty)",
          ar: "كاب كات برو 7 أيام (ضمان كامل)",
          fr: "CapCut Pro 7 Jours (Garantie Totale)",
        },
        markupPercent: 300, // $0.12 -> ~$0.48
        compareAtMinor: 199,
        links: [
          { providerCode: "canboso", providerSku: "6aa2ed63553547f0f1081cb0", priority: 0 },
          { providerCode: "qcst", providerSku: "prod_f47b740ac80e5a48a79d", priority: 1 },
        ],
      },
      {
        label: {
          en: "CapCut Pro 30 Days (Full Warranty)",
          ar: "كاب كات برو 30 يوماً (ضمان كامل)",
          fr: "CapCut Pro 30 Jours (Garantie Totale)",
        },
        badge: "Best Seller",
        markupPercent: 45, // $1.72 -> ~$2.49
        compareAtMinor: 499,
        links: [
          { providerCode: "canboso", providerSku: "6aacd1595271203cb12b8279", priority: 0 },
          { providerCode: "qcst", providerSku: "prod_465977a3961c37021e86", priority: 1 },
        ],
      },
      {
        label: {
          en: "CapCut Pro 6 Months (Full Warranty)",
          ar: "كاب كات برو 6 أشهر (ضمان كامل)",
          fr: "CapCut Pro 6 Mois (Garantie Totale)",
        },
        badge: "Best Deal",
        markupPercent: 25, // $9.53 -> ~$11.91
        compareAtMinor: 2400,
        links: [
          { providerCode: "canboso", providerSku: "6aacd1775271203cb12b8907", priority: 0 },
          { providerCode: "qcst", providerSku: "prod_61d2867bdca86045b81d", priority: 1 },
        ],
      },
    ],
  },
  {
    slug: "canva-pro",
    categorySlug: "kreatif",
    name: {
      en: "Canva Pro Design Suite",
      ar: "كانفا برو للتصميم Canva Pro",
      fr: "Canva Pro Suite Créative",
    },
    description: {
      en: "Full Canva Pro access with 100M+ premium assets, brand kits, AI Magic Studio, transparent background PNGs, and custom resize.",
      ar: "اشتراك كانفا برو مع وصول غير محدود لملايين القوالب والتصاميم وإزالة الخلفية وأدوات الذكاء الاصطناعي Magic Studio.",
      fr: "Accès illimité à Canva Pro : 100M+ éléments premium, kits de marque, IA Magic Studio et redimensionnement rapide.",
    },
    image: "canva",
    isFeatured: true,
    soldCount: 654,
    sortOrder: 5,
    offers: [
      {
        label: {
          en: "Canva Pro 1 Month (Invite Link)",
          ar: "كانفا برو شهر واحد (رابط دعوة)",
          fr: "Canva Pro 1 Mois (Lien d'invitation)",
        },
        badge: "Instant Link",
        markupPercent: 150, // $0.39 -> ~$0.98
        compareAtMinor: 299,
        links: [{ providerCode: "canboso", providerSku: "6aacd1055271203cb12b6f03", priority: 0 }],
      },
      {
        label: {
          en: "Canva Pro 1 Year (Slot - Full Warranty)",
          ar: "كانفا برو سنة كاملة (حساب رسمي - ضمان كامل)",
          fr: "Canva Pro 1 An (Slot - Garantie Totale)",
        },
        badge: "1 Year",
        markupPercent: 30, // $3.05 / 50k VND -> ~$3.97 / $2.60
        compareAtMinor: 1200,
        links: [
          { providerCode: "canboso", providerSku: "6aacd1825271203cb12b8cb8", priority: 0 },
          { providerCode: "qcst", providerSku: "prod_38bd624138507d516acb", priority: 1 },
        ],
      },
    ],
  },
  {
    slug: "adobe-creative",
    categorySlug: "kreatif",
    name: {
      en: "Adobe Creative Cloud & Express",
      ar: "أدوبي كرييتف كلاود وإكسبريس",
      fr: "Adobe Creative Cloud & Express",
    },
    description: {
      en: "Adobe Express Premium with complete cloud templates, fonts, generative AI tools, and 12-month access.",
      ar: "أدوبي إكسبريس بريميوم مع مكتبة القوالب الكاملة والخطوط وأدوات الذكاء الاصطناعي التوليدي مع وصول 12 شهراً.",
      fr: "Adobe Express Premium avec modèles cloud complets, polices et outils d'IA générative pendant 12 mois.",
    },
    image: "adobe",
    soldCount: 310,
    sortOrder: 6,
    offers: [
      {
        label: {
          en: "Adobe Express Premium 12 Months",
          ar: "أدوبي إكسبريس بريميوم 12 شهراً",
          fr: "Adobe Express Premium 12 Mois",
        },
        badge: "1 Year",
        markupPercent: 100, // 25,000 VND (~$1.00) -> ~$2.00
        compareAtMinor: 800,
        links: [{ providerCode: "qcst", providerSku: "prod_c0ee59442b26bd007031", priority: 0 }],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: STREAMING (streaming)
  // =========================================================================
  {
    slug: "youtube-premium",
    categorySlug: "streaming",
    name: {
      en: "YouTube Premium & Music",
      ar: "يوتيوب بريميوم وميوزك YouTube Premium",
      fr: "YouTube Premium & Music",
    },
    description: {
      en: "Ad-free streaming, background play with screen locked, offline video downloads, and unlimited YouTube Music Premium access.",
      ar: "مشاهدة بدون إعلانات، تشغيل في الخلفية والشاشة مقفلة، تحميل الفيديوهات بدون إنترنت، واشتراك مجاني في YouTube Music.",
      fr: "Streaming sans publicité, lecture en arrière-plan, téléchargements hors-ligne et accès complet à YouTube Music Premium.",
    },
    image: "youtube",
    isFeatured: true,
    soldCount: 980,
    sortOrder: 7,
    offers: [
      {
        label: {
          en: "YouTube Premium 3 Months Slot (Full Warranty)",
          ar: "يوتيوب بريميوم 3 أشهر (ضمان كامل)",
          fr: "YouTube Premium 3 Mois (Garantie Totale)",
        },
        markupPercent: 30, // $3.81 -> ~$4.95
        compareAtMinor: 1199,
        links: [{ providerCode: "canboso", providerSku: "6ab13364f6d40479fddaac09", priority: 0 }],
      },
      {
        label: {
          en: "YouTube Premium 6 Months Slot (Full Warranty)",
          ar: "يوتيوب بريميوم 6 أشهر (ضمان كامل)",
          fr: "YouTube Premium 6 Mois (Garantie Totale)",
        },
        markupPercent: 20, // $8.38 -> ~$10.05
        compareAtMinor: 2399,
        links: [{ providerCode: "canboso", providerSku: "6ab134fcf6d40479fddaf681", priority: 0 }],
      },
      {
        label: {
          en: "YouTube Premium 1 Year Slot (Full Warranty)",
          ar: "يوتيوب بريميوم سنة كاملة (ضمان كامل)",
          fr: "YouTube Premium 1 An (Garantie Totale)",
        },
        badge: "Best Seller",
        markupPercent: 15, // $13.93 -> ~$16.02
        compareAtMinor: 4500,
        links: [{ providerCode: "canboso", providerSku: "6ab133c9f6d40479fddabe78", priority: 0 }],
      },
    ],
  },
  {
    slug: "netflix-premium",
    categorySlug: "streaming",
    name: {
      en: "Netflix 4K Ultra HD",
      ar: "نتفليكس 4K الترا اتش دي",
      fr: "Netflix 4K Ultra HD",
    },
    description: {
      en: "Private profile on an Ultra HD 4K Netflix account with HDR support. Stream your favorite movies and TV shows across all devices.",
      ar: "ملف شخصي خاص على حساب نتفليكس 4K Ultra HD مع دعم HDR على جميع الأجهزة الذكية والتلفاز.",
      fr: "Profil privé sur un compte Netflix 4K Ultra HD avec support HDR sur TV, PC et mobile.",
    },
    image: "netflix",
    soldCount: 420,
    sortOrder: 8,
    offers: [
      {
        label: {
          en: "Netflix 4K UHD 30 Days Slot",
          ar: "نتفليكس 4K الترا اتش دي - 30 يوماً",
          fr: "Netflix 4K UHD 30 Jours Slot",
        },
        badge: "4K UHD",
        markupPercent: 30, // $2.29 -> ~$2.98
        compareAtMinor: 699,
        links: [{ providerCode: "canboso", providerSku: "6aaedc3886b4242014994dfd", priority: 0 }],
      },
    ],
  },
  {
    slug: "spotify-premium",
    categorySlug: "streaming",
    name: {
      en: "Spotify Premium",
      ar: "سبوتيفاي بريميوم Spotify Premium",
      fr: "Spotify Premium",
    },
    description: {
      en: "Unlimited music streaming with zero ad interruptions, high-fidelity audio quality, and offline playlist downloads.",
      ar: "استماع للموسيقى بدون إعلانات بجودة صوت فائقة النقاء مع إمكانية التحميل والاستماع دون إنترنت.",
      fr: "Écoute musicale illimitée sans publicité, qualité sonore haute fidélité et écoute hors-ligne.",
    },
    image: "spotify",
    soldCount: 310,
    sortOrder: 9,
    offers: [
      {
        label: {
          en: "Spotify Premium 3 Months Link",
          ar: "سبوتيفاي بريميوم 3 أشهر (رابط تفعيل)",
          fr: "Spotify Premium 3 Mois (Lien d'activation)",
        },
        badge: "3 Months",
        markupPercent: 50, // $1.53 -> ~$2.30
        compareAtMinor: 999,
        links: [{ providerCode: "canboso", providerSku: "6aacda4e5271203cb12d5388", priority: 0 }],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: PRODUCTIVITY & LICENSES (tools & lisensi)
  // =========================================================================
  {
    slug: "microsoft-365",
    categorySlug: "tools",
    name: {
      en: "Microsoft 365 & Office Suite",
      ar: "مايكروسوفت 365 وأوفيس",
      fr: "Microsoft 365 & Suite Office",
    },
    description: {
      en: "Full desktop and mobile apps for Word, Excel, PowerPoint, Outlook, plus 1TB OneDrive cloud storage across up to 5 devices.",
      ar: "حزمة برامج وورد، إكسل، باوربوينت، أوتلوك، ومساحة تخزين سحابية 1 تيرابايت على OneDrive تعمل على 5 أجهزة.",
      fr: "Word, Excel, PowerPoint, Outlook et 1 To de stockage cloud OneDrive pour 5 appareils simultanés.",
    },
    image: "microsoft",
    isFeatured: true,
    soldCount: 715,
    sortOrder: 10,
    offers: [
      {
        label: {
          en: "Office 365 5 Months Premium Slot",
          ar: "أوفيس 365 بريميوم 5 أشهر",
          fr: "Office 365 5 Mois Premium Slot",
        },
        markupPercent: 30, // $3.43 -> ~$4.46
        compareAtMinor: 999,
        links: [{ providerCode: "canboso", providerSku: "6aacd7f65271203cb12cdc26", priority: 0 }],
      },
      {
        label: {
          en: "Office 365 12 Months Premium Slot",
          ar: "أوفيس 365 بريميوم سنة كاملة",
          fr: "Office 365 12 Mois Premium Slot",
        },
        badge: "1 Year",
        markupPercent: 25, // $4.77 -> ~$5.96
        compareAtMinor: 1800,
        links: [{ providerCode: "canboso", providerSku: "6aacd8005271203cb12cdd91", priority: 0 }],
      },
      {
        label: {
          en: "Office 365 2 Years + 1TB OneDrive",
          ar: "أوفيس 365 سنتان + 1 تيرابايت سحابي",
          fr: "Office 365 2 Ans + 1 To OneDrive",
        },
        markupPercent: 100, // $1.91 -> ~$3.82
        compareAtMinor: 2400,
        links: [{ providerCode: "canboso", providerSku: "6ab21156f6d40479fdf71942", priority: 0 }],
      },
    ],
  },
  {
    slug: "windows-11-pro",
    categorySlug: "lisensi",
    name: {
      en: "Windows 10 / 11 Pro Genuine License",
      ar: "مفتاح تنشيط ويندوز 10 / 11 برو أصلي",
      fr: "Licence Officielle Windows 10 / 11 Pro",
    },
    description: {
      en: "Genuine digital retail activation key for Windows 10 Pro or Windows 11 Pro. Lifetime activation, multi-language support, and instant key delivery.",
      ar: "مفتاح تنشيط رقمي رسمي ودائم لنظام ويندوز 10 برو أو 11 برو. تنشيط مدى الحياة مع تسليم فوري للمفتاح.",
      fr: "Clé de licence numérique officielle pour Windows 10/11 Pro. Activation permanente à vie et livraison immédiate.",
    },
    image: "windows",
    soldCount: 560,
    sortOrder: 11,
    offers: [
      {
        label: {
          en: "Windows 10/11 Pro OEM Retail Key (Lifetime)",
          ar: "مفتاح ويندوز 10/11 برو رسمي (مدى الحياة)",
          fr: "Clé Windows 10/11 Pro Retail (À Vie)",
        },
        badge: "Instant Key",
        markupPercent: 18, // $3.81 -> ~$4.50
        compareAtMinor: 1999,
        links: [{ providerCode: "canboso", providerSku: "6ab2116cf6d40479fdf71bb8", priority: 0 }],
      },
      {
        label: {
          en: "Windows 10/11 Pro Online Retail Key",
          ar: "مفتاح تنشيط ويندوز أونلاين 10/11 برو",
          fr: "Clé Windows 10/11 Pro Online",
        },
        markupPercent: 25, // $3.39 -> ~$4.24
        compareAtMinor: 1899,
        links: [{ providerCode: "canboso", providerSku: "6aacd7df5271203cb12cd91b", priority: 0 }],
      },
    ],
  },
  {
    slug: "office-2024-pro",
    categorySlug: "lisensi",
    name: {
      en: "Microsoft Office 2024 Pro Plus Lifetime Key",
      ar: "مفتاح مايكروسوفت أوفيس 2024 برو بلس مدى الحياة",
      fr: "Clé Microsoft Office 2024 Pro Plus à Vie",
    },
    description: {
      en: "Official lifetime activation key for Microsoft Office 2024 Professional Plus. Includes Word, Excel, PowerPoint, Access, Outlook, and OneNote.",
      ar: "مفتاح تنشيط دائم لبرامج أوفيس 2024 برو بلس. يشمل وورد وإكسل وباوربوينت وأكسس وأوتلوك مدى الحياة دون اشتراك شهري.",
      fr: "Clé d'activation officielle et définitive pour Microsoft Office 2024 Professionnel Plus sur PC.",
    },
    image: "microsoft",
    soldCount: 290,
    sortOrder: 12,
    offers: [
      {
        label: {
          en: "Office 2024 Pro Lifetime License Key",
          ar: "مفتاح أوفيس 2024 برو بلس مدى الحياة",
          fr: "Clé Office 2024 Pro Plus à Vie",
        },
        badge: "Lifetime",
        markupPercent: 50, // $2.63 -> ~$3.95
        compareAtMinor: 3999,
        links: [{ providerCode: "canboso", providerSku: "6aacdcf25271203cb12dcdac", priority: 0 }],
      },
    ],
  },
  {
    slug: "quillbot-premium",
    categorySlug: "tools",
    name: {
      en: "QuillBot Premium Paraphraser",
      ar: "كويك بوت بريميوم QuillBot Premium",
      fr: "QuillBot Premium Paraphraseur",
    },
    description: {
      en: "AI-powered paraphrasing, grammar checker, plagiarism detector, summarizer, and tone changer. Unlimited words in Paraphraser.",
      ar: "إعادة صياغة النصوص بالذكاء الاصطناعي، تدقيق لغوي، كشف الانتحال، وتلخيص المقالات دون قيود على عدد الكلمات.",
      fr: "Reformulation assistée par IA, correcteur grammatical et vérificateur de plagiat sans limite de mots.",
    },
    image: "quillbot",
    soldCount: 185,
    sortOrder: 13,
    offers: [
      {
        label: {
          en: "QuillBot Premium 1 Month Private",
          ar: "كويك بوت بريميوم شهر واحد (حساب خاص)",
          fr: "QuillBot Premium 1 Mois Privé",
        },
        badge: "Popular",
        markupPercent: 30, // $3.05 / 69,750 VND (~$2.79) -> ~$3.95
        compareAtMinor: 999,
        links: [
          { providerCode: "canboso", providerSku: "6aacdd375271203cb12dd881", priority: 0 },
          { providerCode: "qcst", providerSku: "prod_58def033c1c5d033c9f2", priority: 1 },
        ],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: VPN & SECURITY (vpn)
  // =========================================================================
  {
    slug: "nordvpn",
    categorySlug: "vpn",
    name: {
      en: "Premium VPN & Privacy Pass",
      ar: "اشتراكات VPN فائقة السرعة والأمان",
      fr: "Pass VPN Premium & Vie Privée",
    },
    description: {
      en: "High-speed encrypted VPN connections to protect public Wi-Fi, bypass geo-restrictions, and unlock global streaming catalogs.",
      ar: "اتصالات مشفرة وفائقة السرعة لحماية الخصوصية وتخطي الحجب الجغرافي وفتح مكتبات البث العالمية.",
      fr: "Connexions VPN chiffrées à haute vitesse pour contourner les restrictions et sécuriser votre navigation.",
    },
    image: "nordvpn",
    soldCount: 380,
    sortOrder: 14,
    offers: [
      {
        label: {
          en: "AdGuard VPN 7 Days (Full Warranty)",
          ar: "أدجارد في بي إن 7 أيام (ضمان كامل)",
          fr: "AdGuard VPN 7 Jours (Garantie Totale)",
        },
        markupPercent: 70, // $0.58 -> ~$0.99
        compareAtMinor: 299,
        links: [{ providerCode: "canboso", providerSku: "6aacdca45271203cb12dc02d", priority: 0 }],
      },
      {
        label: {
          en: "IPVanish VPN 7 Days (Full Warranty)",
          ar: "آي بي فانيش في بي إن 7 أيام",
          fr: "IPVanish VPN 7 Jours",
        },
        markupPercent: 70, // $0.58 -> ~$0.99
        compareAtMinor: 299,
        links: [{ providerCode: "canboso", providerSku: "6aacdcad5271203cb12dc1c3", priority: 0 }],
      },
      {
        label: {
          en: "NordVPN 3 Months Link",
          ar: "نورد في بي إن 3 أشهر (رابط تفعيل)",
          fr: "NordVPN 3 Mois (Lien d'activation)",
        },
        badge: "3 Months",
        markupPercent: 25, // 99,000 VND (~$3.96) -> ~$4.95
        compareAtMinor: 1499,
        links: [{ providerCode: "qcst", providerSku: "prod_3be79447dbda886f1e5d", priority: 0 }],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: EDUCATION (pendidikan)
  // =========================================================================
  {
    slug: "duolingo-super",
    categorySlug: "pendidikan",
    name: {
      en: "Duolingo Super & Max",
      ar: "ديلينجو سوبر وماكس Duolingo",
      fr: "Duolingo Super & Max",
    },
    description: {
      en: "Learn languages without limits: unlimited hearts, zero ad interruptions, personalized practice, and AI roleplay conversations.",
      ar: "تعلم اللغات بطلاقة دون قيود: قلوب لا نهائية، بدون إعلانات، ومحادثات تدريبية بالذكاء الاصطناعي.",
      fr: "Apprenez les langues sans limites : cœurs illimités, zéro publicité et dialogues avec l'IA.",
    },
    image: "duolingo",
    soldCount: 460,
    sortOrder: 15,
    offers: [
      {
        label: {
          en: "Duolingo Super 12 Months Code",
          ar: "كود ديلينجو سوبر سنة كاملة (12 شهراً)",
          fr: "Code Duolingo Super 12 Mois",
        },
        badge: "1 Year",
        markupPercent: 300, // 25,000 VND (~$1.00) -> ~$4.00
        compareAtMinor: 2400,
        links: [{ providerCode: "qcst", providerSku: "prod_3bed3d378f13b0ff86b1", priority: 0 }],
      },
      {
        label: {
          en: "Duolingo Super 6 Months (Full Warranty)",
          ar: "ديلينجو سوبر 6 أشهر (ضمان كامل)",
          fr: "Duolingo Super 6 Mois (Garantie)",
        },
        markupPercent: 22, // $5.72 -> ~$6.98
        compareAtMinor: 1500,
        links: [{ providerCode: "canboso", providerSku: "6aacd4205271203cb12c2ac7", priority: 0 }],
      },
      {
        label: {
          en: "Duolingo Max 3 Months (with AI Video Roleplay)",
          ar: "ديلينجو ماكس 3 أشهر (مع الذكاء الاصطناعي)",
          fr: "Duolingo Max 3 Mois (avec IA)",
        },
        markupPercent: 20, // $6.29 -> ~$7.55
        compareAtMinor: 2100,
        links: [{ providerCode: "canboso", providerSku: "6aacd4115271203cb12c25c1", priority: 0 }],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: ACCOUNTS & EMAIL (akun)
  // =========================================================================
  {
    slug: "aged-gmail-accounts",
    categorySlug: "akun",
    name: {
      en: "Aged Google Gmail Accounts (2FA)",
      ar: "حسابات جوجل جيميل قديمة موثقة (2FA)",
      fr: "Comptes Gmail Anciens (2FA)",
    },
    description: {
      en: "Trusted Google Gmail accounts registered between 2010 and 2022 with 2-Factor Authentication enabled. Ideal for marketing, agency setups, and API keys.",
      ar: "حسابات جوجل قديمة مسجلة بين 2010 و 2022 مع تفعيل التحقق بخطوتين 2FA وموثوقية عالية لتفادي الحظر.",
      fr: "Comptes Google Gmail enregistrés entre 2010 et 2022 avec 2FA activée. Forte réputation pour marketing et APIs.",
    },
    image: "gmail",
    soldCount: 840,
    sortOrder: 16,
    offers: [
      {
        label: {
          en: "Aged Random Gmail (2010~2022) with 2FA",
          ar: "حساب جيميل قديم عشوائي (2010-2022) مع 2FA",
          fr: "Compte Gmail Ancien (2010-2022) avec 2FA",
        },
        badge: "2FA Verified",
        markupPercent: 48, // $1.34 -> ~$1.98
        compareAtMinor: 399,
        links: [{ providerCode: "canboso", providerSku: "6aaff3ae86b4242014ba4024", priority: 0 }],
      },
      {
        label: {
          en: "US Aged Gmail Account with 2FA",
          ar: "حساب جيميل أمريكي قديم مع 2FA",
          fr: "Compte Gmail US Ancien avec 2FA",
        },
        markupPercent: 45, // $1.72 -> ~$2.49
        compareAtMinor: 499,
        links: [{ providerCode: "canboso", providerSku: "6a9f199a4f6e4dbc770d3fcf", priority: 0 }],
      },
    ],
  },

  // =========================================================================
  // CATEGORY: DEVELOPER & CLOUD (developer)
  // =========================================================================
  {
    slug: "cloud-developer-credits",
    categorySlug: "developer",
    name: {
      en: "AWS Cloud Developer Vouchers",
      ar: "قسائم رصيد المطورين أمازون ويب سيرفيسز AWS",
      fr: "Bons de Crédits Développeur AWS Cloud",
    },
    description: {
      en: "Amazon Web Services (AWS) promo credit redeem code. Apply directly to your AWS billing console for EC2, RDS, S3, and Lambda instances.",
      ar: "كود شحن رصيد ترويجي لأمازون ويب سيرفيسز AWS. يتم إضافته مباشرة في لوحة الفوترة لخدمات EC2 و S3 وقواعد البيانات.",
      fr: "Code promotionnel de crédit AWS pour instances EC2, S3, RDS et fonctions Lambda.",
    },
    image: "aws",
    soldCount: 215,
    sortOrder: 17,
    offers: [
      {
        label: {
          en: "Code Redeem $50 AWS (Amazon Web Services)",
          ar: "كود شحن رصيد 50 دولار في AWS",
          fr: "Code de Recharge 50$ AWS Cloud",
        },
        badge: "$50 Credit",
        markupPercent: 38, // $6.48 -> ~$8.94
        compareAtMinor: 2500,
        links: [{ providerCode: "canboso", providerSku: "6ab2791f2d45b71acbe8eb0d", priority: 0 }],
      },
    ],
  },
];

async function main() {
  console.log("=== Step 1: Purging 'seed' synthetic provider and placeholder offers ===");

  // 1. Delete all links pointing to provider "seed"
  const deletedLinks = await prisma.offerProviderLink.deleteMany({
    where: { providerOffer: { provider: { code: "seed" } } },
  });
  console.log(`- Deleted ${deletedLinks.count} OfferProviderLinks pointing to 'seed'`);

  // 2. Delete all ProviderOffers belonging to provider "seed"
  const deletedPos = await prisma.providerOffer.deleteMany({
    where: { provider: { code: "seed" } },
  });
  console.log(`- Deleted ${deletedPos.count} ProviderOffers belonging to 'seed'`);

  // 3. Delete the "seed" provider
  const deletedProv = await prisma.provider.deleteMany({
    where: { code: "seed" },
  });
  console.log(`- Deleted ${deletedProv.count} 'seed' Provider record`);

  // 4. Remove obsolete duplicate product slugs created in earlier intermediate steps
  const obsoleteSlugs = [
    "canva-pro-suite",
    "youtube-premium-membership",
    "netflix-4k-uhd",
    "spotify-premium-music",
    "microsoft-365-suite",
    "google-gemini-pro",
    "claude-api-tokens",
    "quillbot-premium-pro",
    "duolingo-super-learn",
    "ultra-vpn-access",
    "capcut-pro-editor",
    "windows-10-11-pro-license",
    "office-2024-pro-license",
  ];

  // Also remove unlinked placeholder products (notion-plus, figma-pro) if empty
  const staleEmpty = ["notion-plus", "figma-pro"];
  for (const s of staleEmpty) {
    const prod = await prisma.product.findUnique({
      where: { slug: s },
      include: { offers: { include: { links: true } } },
    });
    if (prod && prod.offers.every((o) => o.links.length === 0)) {
      obsoleteSlugs.push(s);
    }
  }

  // Delete offers and products for obsolete slugs
  await prisma.offerProviderLink.deleteMany({
    where: { offer: { product: { slug: { in: obsoleteSlugs } } } },
  });
  await prisma.offer.deleteMany({
    where: { product: { slug: { in: obsoleteSlugs } } },
  });
  const deletedObsoleteProducts = await prisma.product.deleteMany({
    where: { slug: { in: obsoleteSlugs } },
  });
  console.log(`- Removed ${deletedObsoleteProducts.count} duplicate/obsolete product records`);

  console.log("\n=== Step 2: Seeding & Consolidating Canonical Live Products ===");

  const providers = await prisma.provider.findMany();
  const providerByCode = new Map(providers.map((p) => [p.code.toLowerCase(), p]));

  let productsUpserted = 0;
  let offersUpserted = 0;
  let linksCreated = 0;

  for (const p of canonicalLiveProducts) {
    const category = await prisma.category.findUnique({
      where: { slug: p.categorySlug },
    });
    if (!category) {
      console.warn(`Category "${p.categorySlug}" not found! Skipping product ${p.slug}`);
      continue;
    }

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        categoryId: category.id,
        nameEn: p.name.en,
        nameAr: p.name.ar,
        nameFr: p.name.fr,
        descriptionEn: p.description.en,
        descriptionAr: p.description.ar,
        descriptionFr: p.description.fr,
        images: [p.image],
        isFeatured: !!p.isFeatured,
        isNew: !!p.isNew,
        soldCount: p.soldCount ?? 0,
        sortOrder: p.sortOrder ?? 0,
        isActive: true,
      },
      create: {
        slug: p.slug,
        categoryId: category.id,
        nameEn: p.name.en,
        nameAr: p.name.ar,
        nameFr: p.name.fr,
        descriptionEn: p.description.en,
        descriptionAr: p.description.ar,
        descriptionFr: p.description.fr,
        images: [p.image],
        isFeatured: !!p.isFeatured,
        isNew: !!p.isNew,
        soldCount: p.soldCount ?? 0,
        sortOrder: p.sortOrder ?? 0,
        isActive: true,
      },
    });
    productsUpserted++;

    // Purge any lingering unlinked mock offers on this canonical product
    const validOfferLabels = new Set(p.offers.map((o) => o.label.en));
    const staleOffers = await prisma.offer.findMany({
      where: { productId: product.id, labelEn: { notIn: [...validOfferLabels] } },
    });
    if (staleOffers.length > 0) {
      await prisma.offerProviderLink.deleteMany({
        where: { offerId: { in: staleOffers.map((o) => o.id) } },
      });
      await prisma.offer.deleteMany({
        where: { id: { in: staleOffers.map((o) => o.id) } },
      });
      console.log(`  Cleaned ${staleOffers.length} stale offers from "${p.slug}"`);
    }

    // Upsert offers & links
    for (const [offerIdx, o] of p.offers.entries()) {
      let offer = await prisma.offer.findFirst({
        where: { productId: product.id, labelEn: o.label.en },
      });

      if (!offer) {
        offer = await prisma.offer.create({
          data: {
            productId: product.id,
            labelEn: o.label.en,
            labelAr: o.label.ar,
            labelFr: o.label.fr,
            markupPercent: o.markupPercent,
            compareAtMinor: o.compareAtMinor ? BigInt(o.compareAtMinor) : null,
            badge: o.badge ?? null,
            rulesEn: o.rules?.en ?? "",
            rulesAr: o.rules?.ar ?? "",
            rulesFr: o.rules?.fr ?? "",
            sortOrder: offerIdx,
            isActive: true,
          },
        });
      } else {
        offer = await prisma.offer.update({
          where: { id: offer.id },
          data: {
            labelAr: o.label.ar,
            labelFr: o.label.fr,
            markupPercent: o.markupPercent,
            compareAtMinor: o.compareAtMinor ? BigInt(o.compareAtMinor) : null,
            badge: o.badge ?? null,
            rulesEn: o.rules?.en ?? "",
            rulesAr: o.rules?.ar ?? "",
            rulesFr: o.rules?.fr ?? "",
            sortOrder: offerIdx,
            isActive: true,
          },
        });
      }
      offersUpserted++;

      for (const linkSpec of o.links) {
        const prov = providerByCode.get(linkSpec.providerCode.toLowerCase());
        if (!prov) {
          console.warn(`Provider "${linkSpec.providerCode}" not found in DB!`);
          continue;
        }

        const po = await prisma.providerOffer.findUnique({
          where: {
            providerId_providerSku: {
              providerId: prov.id,
              providerSku: linkSpec.providerSku,
            },
          },
        });

        if (!po) {
          console.warn(
            `ProviderOffer not found for provider ${linkSpec.providerCode} and SKU ${linkSpec.providerSku} (offer: ${o.label.en})`,
          );
          continue;
        }

        await prisma.offerProviderLink.upsert({
          where: {
            offerId_providerOfferId: {
              offerId: offer.id,
              providerOfferId: po.id,
            },
          },
          update: {
            priority: linkSpec.priority ?? 0,
            isEnabled: true,
          },
          create: {
            offerId: offer.id,
            providerOfferId: po.id,
            priority: linkSpec.priority ?? 0,
            isEnabled: true,
          },
        });
        linksCreated++;
      }
    }
  }

  console.log(`\n✅ Catalog Consolidation Complete!`);
  console.log(`- Canonical products: ${productsUpserted}`);
  console.log(`- Active real offers: ${offersUpserted}`);
  console.log(`- Provider links: ${linksCreated}`);
}

main()
  .catch((e) => {
    console.error("Consolidation failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
