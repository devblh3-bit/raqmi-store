import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import type { Locale } from "@/i18n";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = (locale as Locale) || "en";

  const isAr = loc === "ar";
  const isFr = loc === "fr";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] p-6 shadow-[var(--elev-1)] sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <span>⚖️</span>
          <span>
            {isAr
              ? "ضوابط المعاملات وعقد الوكالة بأجر (معيار أيوفي رقم 23)"
              : isFr
                ? "Conformité Shariah & Contrat de Mandat (AAOIFI Standard 23)"
                : "Islamic Agency Agreement & Terms (AAOIFI Standard 23)"}
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl text-[var(--fg)]">
          {isAr
            ? "عقد الوكالة التجارية والشروط والأحكام"
            : isFr
              ? "Conditions Générales & Contrat de Mandat Rémunéré"
              : "Terms of Service & Agency Agreement"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">
          {isAr
            ? "تخضع كافة التعاملات والطلبات على منصة رقمي لعقد الوكالة بأجر (الوكالة في الشراء)، وفق الضوابط الشرعية المعتمدة دولياً، بما يضمن الشفافية المطلقة والعدالة التعاقدية."
            : isFr
              ? "Toutes les opérations et commandes sur la plateforme Raqmi sont régies par un contrat de mandat rémunéré (Al-Wikalah bi-Ajr), garantissant une transparence totale et l'intégrité contractuelle."
              : "All transactions and procurement requests on Raqmi operate under the Islamic Agency / Brokerage model (Al-Wikalah bi-Ajr), ensuring absolute pricing transparency and contractual fairness."}
        </p>
      </div>

      {/* Main Content Articles */}
      <div className="mt-8 space-y-6">
        {/* Article 1 */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-bold text-blue-600 dark:text-blue-400">
              1
            </span>
            <h2 className="text-lg font-bold text-[var(--fg)]">
              {isAr
                ? "التكييف الفقهي وطبيعة العقد (عقد الوكالة بأجر)"
                : isFr
                  ? "Qualification Juridique & Nature du Contrat (Mandat)"
                  : "Contractual Relationship & Paid Agency Model"}
            </h2>
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--fg-muted)] space-y-3">
            {isAr ? (
              <>
                <p>
                  <strong>العميل (المُوكِّل):</strong> يفوّض العميل منصة رقمي بصفتها وكيلاً مفوضاً للشراء والتنفيذ، للقيام بشراء وتفعيل الاشتراكات والتراخيص الرقمية المحددة في طلبه من شبكات التوزيع المعتمدة فور تأكيد الطلب.
                </p>
                <p>
                  <strong>المنصة (الوكيل بأجر):</strong> تعمل منصة رقمي كوسيط تقني ووكيل شراء مؤتمن ومفوض بموجب توكيل صريح من العميل، ولا تبيع المنصة منتجات رقمية أو اشتراكات من ملك سابق غير محاز (نفياً لمحذور بيع ما لا يملك)، بل تباشر الشراء والتنفيذ الفوري لحساب الموكِّل.
                </p>
              </>
            ) : isFr ? (
              <>
                <p>
                  <strong>Le Client (Le Mandant) :</strong> En confirmant sa commande, le client donne formellement mandat à la plateforme Raqmi pour acquérir en son nom et pour son compte les abonnements et licences numériques spécifiés.
                </p>
                <p>
                  <strong>La Plateforme (Le Mandataire) :</strong> Raqmi agit strictement en qualité de mandataire rémunéré et d&apos;agent d&apos;approvisionnement automatisé, éliminant ainsi toute revente spéculative sans détention préalable.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>The Customer (The Principal / Al-Muwakkil):</strong> By placing an order, the customer explicitly commissions and appoints Raqmi as their purchasing agent to procure, configure, and activate digital subscriptions and licenses on their behalf from authorized wholesale channels.
                </p>
                <p>
                  <strong>The Platform (The Agent / Al-Wakil bil-Ajr):</strong> Raqmi acts strictly as a paid purchasing agent. The platform does not practice unhedged dropshipping or sell unowned assets (Bay&apos; ma la Yamlik), but rather executes real-time procurement on behalf of the customer upon formal authorization.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Article 2 */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              2
            </span>
            <h2 className="text-lg font-bold text-[var(--fg)]">
              {isAr
                ? "شفافية الأسعار وأجرة الوكالة المعلومة"
                : isFr
                  ? "Structure des Coûts & Rémunération du Mandat"
                  : "Transparent Pricing & Disclosed Agency Fee"}
            </h2>
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--fg-muted)] space-y-3">
            {isAr ? (
              <>
                <p>
                  عملاً بالمعايير الشرعية الصادرة عن هيئة المحاسبة والمراجعة للمؤسسات المالية الإسلامية (أيوفي - معيار رقم 23)، فإن المبلغ الإجمالي المصرح به ينقسم بوضوح إلى:
                </p>
                <ul className="list-disc ps-5 space-y-1">
                  <li><strong>تكلفة التوريد الأصلية:</strong> وهي أموال أمانة تُحوّل مباشرة لشراء الاشتراك من قنوات التوريد والتوزيع.</li>
                  <li><strong>أجرة الوكالة والخدمة:</strong> وهي المقابل المالي المتفق عليه مسبقاً والمعلن في صفحة الدفع مقابل خدمة الوساطة والربط التقني والتنفيذ والمتابعة.</li>
                </ul>
              </>
            ) : isFr ? (
              <>
                <p>
                  Conformément aux normes Shariah (AAOIFI Standard 23), le montant total autorisé se décompose en toute transparence :
                </p>
                <ul className="list-disc ps-5 space-y-1">
                  <li><strong>Le Coût d&apos;Approvisionnement :</strong> Montant fiduciaire (Amanah) transféré directement aux canaux d&apos;activation.</li>
                  <li><strong>Les Honoraires de Mandat & Automatisation :</strong> Rémunération forfaitaire convenue à l&apos;avance pour l&apos;exécution technique et le service.</li>
                </ul>
              </>
            ) : (
              <>
                <p>
                  In accordance with AAOIFI Shariah Standard No. 23 (Agency), the total authorized amount is separated into:
                </p>
                <ul className="list-disc ps-5 space-y-1">
                  <li><strong>Base Procurement Cost:</strong> Pass-through capital (Amanah) directed to authorized distributors for real-time activation.</li>
                  <li><strong>Agency & Execution Fee (Ujrah):</strong> Pre-agreed, transparent service compensation for the automated brokerage, API integration, and customer support.</li>
                </ul>
              </>
            )}
          </div>
        </section>

        {/* Article 3 */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-sm font-bold text-purple-600 dark:text-purple-400">
              3
            </span>
            <h2 className="text-lg font-bold text-[var(--fg)]">
              {isAr
                ? "ضمان الدرك والاسترداد الفوري عند تعذر التنفيذ"
                : isFr
                  ? "Garantie d&apos;Exécution & Remboursement Intégral"
                  : "Execution Guarantee & Instant Restitution"}
            </h2>
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--fg-muted)] space-y-3">
            {isAr ? (
              <p>
                تلتزم المنصة بضمان تسليم الخدمة وتنفيذ الوكالة على الوجه المطلوب (ضمان الدرك). في حال تعذر التوريد من المصدر الخارجي أو حدوث خلل تقني يحول دون تفعيل الاشتراك خلال الوقت المحدد، يُعاد كامل المبلغ المفوض (تكلفة التوريد وأجرة الوكالة) فوراً إلى رصيد محفظة العميل أو وسيلة دفعه دون أي خصومات.
              </p>
            ) : isFr ? (
              <p>
                La plateforme s&apos;engage à une garantie d&apos;exécution absolue. En cas d&apos;indisponibilité du fournisseur amont ou d&apos;échec technique d&apos;activation, la totalité des fonds autorisés (coût fournisseur + honoraires d&apos;agence) est intégralement et immédiatement restituée au client.
              </p>
            ) : (
              <p>
                The platform provides an execution guarantee (Daman al-Durk). If upstream procurement fails due to provider downtime, stock depletion, or technical activation error, 100% of the authorized funds (both the base procurement cost and the agency fee) are instantly refunded to the customer&apos;s wallet balance without deductions.
              </p>
            )}
          </div>
        </section>

        {/* Article 4 */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-sm font-bold text-amber-600 dark:text-amber-400">
              4
            </span>
            <h2 className="text-lg font-bold text-[var(--fg)]">
              {isAr
                ? "ضبط الصفة وسرية شبكات التوريد"
                : isFr
                  ? "Spécifications & Confidentialité des Canaux"
                  : "Specification Standard & Supply Neutrality"}
            </h2>
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--fg-muted)] space-y-3">
            {isAr ? (
              <p>
                تلتزم المنصة بضبط صفة المنتج الرقمي ومواصفاته ومدته بدقة متناهية تنفي للجهالة والغرر. ولأغراض حماية أمن الأنظمة وسرية الشراكات التجارية، تحتفظ المنصة بحق اختيار شبكات التوزيع والتزويد البرمجية المعتمدة المستقلة دون الإلزام بالإفصاح عن الهويات البرمجية المحددة لمزودي الواجهات (APIs).
              </p>
            ) : isFr ? (
              <p>
                La plateforme garantit la description précise et rigoureuse des caractéristiques, durées et fonctionnalités des licences numériques. Afin de préserver la sécurité technique et les accords commerciaux, l&apos;identité spécifique des API d&apos;approvisionnement amont reste confidentielle.
              </p>
            ) : (
              <p>
                All digital goods and licenses are described with strict accuracy regarding their duration, capabilities, and tier (Dhabtu al-Sifah), eliminating ambiguity (Gharar). To preserve system security and trade integrity, upstream wholesale distribution endpoints and API identifiers remain proprietary to the platform.
              </p>
            )}
          </div>
        </section>

        {/* Article 5 */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-sm font-bold text-rose-600 dark:text-rose-400">
              5
            </span>
            <h2 className="text-lg font-bold text-[var(--fg)]">
              {isAr
                ? "مدة الضمان وخدمات الدعم الفني"
                : isFr
                  ? "Période de Garantie & Assistance"
                  : "Warranty Period & Technical Support"}
            </h2>
          </div>
          <div className="mt-4 text-sm leading-7 text-[var(--fg-muted)] space-y-3">
            {isAr ? (
              <p>
                تخضع التراخيص والاشتراكات للضمان المعلن في صفحة كل منتج. وفي حال توقف الخدمة خلال فترة الضمان المحددة، تلتزم المنصة بمتابعة استبدال الاشتراك أو إعادة ضبطه لدى المزود خلال أقصر مدة ممكنة وفق سياسة الضمان.
              </p>
            ) : isFr ? (
              <p>
                Chaque abonnement bénéficie de la durée de garantie mentionnée sur sa fiche produit. En cas d&apos;interruption inattendue durant la période couverte, l&apos;équipe de support intervient pour réparer ou remplacer la licence.
              </p>
            ) : (
              <p>
                All procured subscriptions carry the warranty duration indicated on their product page. If a subscription encounters unexpected disruption during the active warranty period, our support team actively procures a replacement or resolves the issue under our warranty policy.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Back to Products CTA */}
      <div className="mt-10 text-center">
        <Link
          href={`/${locale}/products`}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-all"
        >
          <span>{isAr ? "العودة لتصفح المنتجات" : isFr ? "Retour aux produits" : "Browse Products"}</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
