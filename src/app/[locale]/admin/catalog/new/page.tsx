import { prisma } from "@/lib/db";
import { createProduct } from "../actions";
import { redirect } from "next/navigation";

export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, slug: true, nameEn: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New product</h1>

      <form
        action={async (formData: FormData) => {
          "use server";
          const r = await createProduct(formData);
          if ("error" in r) throw new Error(r.error);
          redirect(`/${locale}/admin/catalog`);
        }}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
      >
        <Field label="Name (EN)" name="nameEn" required />
        <Field label="Name (AR)" name="nameAr" required />
        <Field label="Name (FR)" name="nameFr" required />
        <Field label="Slug (optional — auto from EN)" name="slug" placeholder="my-product" />
        <Select label="Category" name="categoryId" required options={categories.map((c) => ({ value: c.id, label: `${c.nameEn} (${c.slug})` }))} />
        <Field label="Description EN" name="descriptionEn" textarea />
        <Field label="Description AR" name="descriptionAr" textarea />
        <Field label="Description FR" name="descriptionFr" textarea />
        <Field label="Sort order" name="sortOrder" type="number" defaultValue="0" />

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isActive" defaultChecked /> Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isFeatured" /> Featured
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isNew" /> New
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="contentLocked" /> Content locked
          </label>
        </div>

        <button className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--accent-hover)]">
          Create product
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
  defaultValue,
  type = "text",
  textarea,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          rows={3}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      )}
    </label>
  );
}

function Select({
  label,
  name,
  required,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        name={name}
        required={required}
        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
