import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories: Array<[string, string, string, string]> = [
  // [slug, en, ar, fr]
  ["ai", "AI", "الذكاء الاصطناعي", "IA"],
  ["streaming", "Streaming", "البث", "Streaming"],
  ["vpn", "VPN", "في بي إن", "VPN"],
  ["accounts", "Accounts", "حسابات", "Comptes"],
  ["social", "Social", "التواصل الاجتماعي", "Réseaux sociaux"],
  ["developer", "Developer", "المطورون", "Développeur"],
  ["creative", "Creative", "الإبداع", "Créatif"],
  ["tools", "Tools", "أدوات", "Outils"],
  ["licenses", "Licenses", "تراخيص", "Licences"],
  ["education", "Education", "التعليم", "Éducation"],
];

const providers: Array<[string, string, string]> = [
  ["qcst", "QCST", "https://api.qcst.tech"],
  ["vbr", "VenteBot", "https://ventetelegrambotrailway-production.up.railway.app"],
  ["canboso", "Canboso", "https://canboso.com"],
];

async function main() {
  for (const [i, [slug, nameEn, nameAr, nameFr]] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { slug, nameEn, nameAr, nameFr, sortOrder: i },
    });
  }
  for (const [code, displayName, baseUrl] of providers) {
    await prisma.provider.upsert({
      where: { code },
      update: {},
      create: { code, displayName, baseUrl },
    });
  }
  await prisma.resellerTier.upsert({
    where: { name: "Standard" },
    update: {},
    create: { name: "Standard", discountPercent: 0 },
  });
  console.log("Seeded", categories.length, "categories,", providers.length, "providers, 1 tier");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
