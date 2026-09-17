export type Category = {
  slug: string;
  name: Record<string, string>;
  count?: number;
};
export type Offer = {
  id: string;
  label: Record<string, string>;
  price: number; // minor USD cents for display; real pricing is cost+markup later
  compareAt?: number;
  stock?: number;
  badge?: string;
};
export type Product = {
  slug: string;
  category: string;
  name: string;
  description: string;
  image: string;
  rating: number;
  reviews: number;
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

// Placeholder images via picsum-style gradients — no external dependency
export const products: Product[] = [
  {
    slug: "chatgpt-plus",
    category: "ai",
    name: "ChatGPT Plus",
    description: "Official OpenAI ChatGPT Plus — GPT-5 access, priority, and plugins.",
    image: "chatgpt",
    rating: 4.9,
    reviews: 3421,
    isFeatured: true,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1999, compareAt: 2999, stock: 48 },
      { id: "3m", label: { en: "3 months", fr: "3 mois", ar: "3 أشهر" }, price: 5499, compareAt: 8997, badge: "Popular" },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 18999, compareAt: 35988 },
    ],
  },
  {
    slug: "claude-pro",
    category: "ai",
    name: "Claude Pro",
    description: "Anthropic Claude Pro — extended context, faster, and priority.",
    image: "claude",
    rating: 4.9,
    reviews: 2144,
    isFeatured: true,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 2199, compareAt: 3299, stock: 22 },
      { id: "6m", label: { en: "6 months", fr: "6 mois", ar: "6 أشهر" }, price: 11999 },
    ],
  },
  {
    slug: "gemini-pro",
    category: "ai",
    name: "Gemini Advanced",
    description: "Google Gemini Advanced with 2TB storage and workspace perks.",
    image: "gemini",
    rating: 4.8,
    reviews: 987,
    isNew: true,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1499, compareAt: 2499, stock: 60 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 13999, compareAt: 29988 },
    ],
  },
  {
    slug: "spotify-premium",
    category: "streaming",
    name: "Spotify Premium",
    description: "Ad-free music, offline listening, and highest quality audio.",
    image: "spotify",
    rating: 4.9,
    reviews: 5102,
    isFeatured: true,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 899, compareAt: 1399 },
      { id: "3m", label: { en: "3 months", fr: "3 mois", ar: "3 أشهر" }, price: 2399 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 7999, compareAt: 16788, stock: 5, badge: "Save 52%" },
    ],
  },
  {
    slug: "netflix-premium",
    category: "streaming",
    name: "Netflix Premium",
    description: "4K Ultra HD, 4 screens, downloads, and full catalog.",
    image: "netflix",
    rating: 4.8,
    reviews: 4820,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1299, compareAt: 1999 },
      { id: "6m", label: { en: "6 months", fr: "6 mois", ar: "6 أشهر" }, price: 6999 },
    ],
  },
  {
    slug: "youtube-premium",
    category: "streaming",
    name: "YouTube Premium",
    description: "Ad-free YouTube, background play, and YouTube Music.",
    image: "youtube",
    rating: 4.8,
    reviews: 3201,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 799, compareAt: 1299 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 7499, compareAt: 15588 },
    ],
  },
  {
    slug: "canva-pro",
    category: "kreatif",
    name: "Canva Pro",
    description: "Pro templates, brand kit, and magic studio.",
    image: "canva",
    rating: 4.9,
    reviews: 2844,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1099, compareAt: 1799 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 8999, compareAt: 21588 },
    ],
  },
  {
    slug: "notion-plus",
    category: "tools",
    name: "Notion Plus",
    description: "Unlimited blocks, version history, and team collaboration.",
    image: "notion",
    rating: 4.7,
    reviews: 1203,
    isNew: true,
    offers: [{ id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 999, compareAt: 1599 }],
  },
  {
    slug: "nordvpn",
    category: "vpn",
    name: "NordVPN",
    description: "Secure VPN with threat protection and 5600+ servers.",
    image: "nordvpn",
    rating: 4.8,
    reviews: 2109,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1199, compareAt: 1899 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 5999, compareAt: 22788 },
    ],
  },
  {
    slug: "adobe-creative",
    category: "kreatif",
    name: "Adobe Creative Cloud",
    description: "Photoshop, Illustrator, Premiere, and 20+ apps.",
    image: "adobe",
    rating: 4.9,
    reviews: 4210,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 3499, compareAt: 5999 },
      { id: "3m", label: { en: "3 months", fr: "3 mois", ar: "3 أشهر" }, price: 9499 },
    ],
  },
  {
    slug: "microsoft-365",
    category: "lisensi",
    name: "Microsoft 365",
    description: "Word, Excel, PowerPoint, Outlook, and 1TB OneDrive.",
    image: "microsoft",
    rating: 4.7,
    reviews: 3104,
    offers: [
      { id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 899, compareAt: 1299 },
      { id: "12m", label: { en: "12 months", fr: "12 mois", ar: "12 شهراً" }, price: 6999, compareAt: 15588 },
    ],
  },
  {
    slug: "figma-pro",
    category: "kreatif",
    name: "Figma Professional",
    description: "Design, prototype, and collaborate — team plan.",
    image: "figma",
    rating: 4.8,
    reviews: 1876,
    offers: [{ id: "1m", label: { en: "1 month", fr: "1 mois", ar: "شهر واحد" }, price: 1499, compareAt: 2299 }],
  },
];
