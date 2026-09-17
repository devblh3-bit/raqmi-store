export type Category = {
  slug: string;
  name: Record<string, string>;
  count?: number;
};
export type Offer = {
  id: string;
  label: Record<string, string>;
  price: number;
  compareAt?: number;
  stock?: number;
  sold?: number;
  badge?: string;
};
export type Product = {
  slug: string;
  category: string;
  name: string;
  description: string;
  image: string;
  sold: number;
  rating?: number;
  reviews?: number;
  offers: Offer[];
  isNew?: boolean;
  isFeatured?: boolean;
};

export const categories: Category[] = [
  { slug: "ai", name: { en: "AI & Chatbot", fr: "IA & Chatbot", ar: "الذكاء الاصطناعي" }, count: 12 },
  { slug: "streaming", name: { en: "Streaming", fr: "Streaming", ar: "البث" }, count: 8 },
  { slug: "vpn", name: { en: "VPN & Security", fr: "VPN & Sécurité", ar: "الـ VPN والأمان" }, count: 3 },
  { slug: "akun", name: { en: "Accounts & Email", fr: "Comptes & Email", ar: "الحسابات" }, count: 5 },
  { slug: "sosial", name: { en: "Social Media", fr: "Réseaux sociaux", ar: "التواصل" }, count: 4 },
  { slug: "developer", name: { en: "Developer & Cloud", fr: "Développeur & Cloud", ar: "المطور والسحابة" }, count: 8 },
  { slug: "kreatif", name: { en: "Design & Creative", fr: "Design & Créatif", ar: "التصميم والإبداع" }, count: 6 },
  { slug: "tools", name: { en: "Productivity", fr: "Productivité", ar: "الإنتاجية" }, count: 6 },
  { slug: "lisensi", name: { en: "Licenses & Credits", fr: "Licences & Crédits", ar: "التراخيص" }, count: 4 },
  { slug: "pendidikan", name: { en: "Education", fr: "Éducation", ar: "التعليم" }, count: 2 },
];

export const products: Product[] = [
  {
    slug: "chatgpt-plus",
    category: "ai",
    name: "ChatGPT Plus",
    description: "Official OpenAI ChatGPT Plus — GPT-5 access, priority, and plugins.",
    image: "chatgpt",
    sold: 3421,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1999, compareAt: 2999, stock: 48, sold: 1240 },
      { id: "3m", label: { en: "3 months", fr: "3 mois", ar: "3 أشهر" }, price: 5499, compareAt: 8997, sold: 890, badge: "Popular" },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 18999, compareAt: 35988, sold: 410 },
    ],
    isFeatured: true,
  },
  {
    slug: "claude-pro",
    category: "ai",
    name: "Claude Pro",
    description: "Anthropic Claude Pro — extended context, faster, and priority.",
    image: "claude",
    sold: 2144,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 2199, compareAt: 3299, stock: 22, sold: 980 },
      { id: "6m", label: { en: "6 months", fr: "6 mois", ar: "6 أشهر" }, price: 11999, sold: 340 },
    ],
    isFeatured: true,
  },
  {
    slug: "gemini-pro",
    category: "ai",
    name: "Gemini Advanced",
    description: "Google Gemini Advanced with 2TB storage and workspace perks.",
    image: "gemini",
    sold: 987,
    isNew: true,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1499, compareAt: 2499, stock: 60, sold: 520 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 13999, compareAt: 29988, sold: 210 },
    ],
  },
  {
    slug: "spotify-premium",
    category: "streaming",
    name: "Spotify Premium",
    description: "Ad-free music, offline listening, and highest quality audio.",
    image: "spotify",
    sold: 5102,
    isFeatured: true,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 899, compareAt: 1399, sold: 2400 },
      { id: "3m", label: { en: "3 months", fr: "3 mois", ar: "3 أشهر" }, price: 2399, sold: 1100 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 7999, compareAt: 16788, stock: 5, sold: 890, badge: "Save 52%" },
    ],
  },
  {
    slug: "netflix-premium",
    category: "streaming",
    name: "Netflix Premium",
    description: "4K Ultra HD, 4 screens, downloads, and full catalog.",
    image: "netflix",
    sold: 4820,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1299, compareAt: 1999, sold: 2100 },
      { id: "6m", label: { en: "6 months", fr: "6 mois", ar: "6 أشهر" }, price: 6999, sold: 980 },
    ],
  },
  {
    slug: "youtube-premium",
    category: "streaming",
    name: "YouTube Premium",
    description: "Ad-free YouTube, background play, and YouTube Music.",
    image: "youtube",
    sold: 3201,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 799, compareAt: 1299, sold: 1800 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 7499, compareAt: 15588, sold: 620 },
    ],
  },
  {
    slug: "canva-pro",
    category: "kreatif",
    name: "Canva Pro",
    description: "Pro templates, brand kit, and magic studio.",
    image: "canva",
    sold: 2844,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1099, compareAt: 1799, sold: 1500 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 8999, compareAt: 21588, sold: 720 },
    ],
  },
  {
    slug: "notion-plus",
    category: "tools",
    name: "Notion Plus",
    description: "Unlimited blocks, version history, and team collaboration.",
    image: "notion",
    sold: 1203,
    isNew: true,
    offers: [{ id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 999, compareAt: 1599, sold: 800 }],
  },
  {
    slug: "nordvpn",
    category: "vpn",
    name: "NordVPN",
    description: "Secure VPN with threat protection and 5600+ servers.",
    image: "nordvpn",
    sold: 2109,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1199, compareAt: 1899, sold: 980 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 5999, compareAt: 22788, sold: 540 },
    ],
  },
  {
    slug: "adobe-creative",
    category: "kreatif",
    name: "Adobe Creative Cloud",
    description: "Photoshop, Illustrator, Premiere, and 20+ apps.",
    image: "adobe",
    sold: 4210,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 3499, compareAt: 5999, sold: 2100 },
      { id: "3m", label: { en: "3 months", fr: "3 mois", ar: "3 أشهر" }, price: 9499, sold: 1200 },
    ],
  },
  {
    slug: "microsoft-365",
    category: "lisensi",
    name: "Microsoft 365",
    description: "Word, Excel, PowerPoint, Outlook, and 1TB OneDrive.",
    image: "microsoft",
    sold: 3104,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 899, compareAt: 1299, sold: 1800 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 6999, compareAt: 15588, sold: 920 },
    ],
  },
  {
    slug: "figma-pro",
    category: "kreatif",
    name: "Figma Professional",
    description: "Design, prototype, and collaborate — team plan.",
    image: "figma",
    sold: 1876,
    offers: [{ id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1499, compareAt: 2299, sold: 1100 }],
  },
];
