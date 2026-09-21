import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateProduct } from "../actions";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }], select: { id: true, slug: true, nameEn: true } }),
  ]);
  if (!product) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit — {product.nameEn}</h1>

      <form
        action={async (formData: FormData) => {
          "use server";
          const r = await updateProduct(id, formData);
          if ("error" in r) throw new Error(r.error);
          redirect(`/${locale}/admin/catalog`);
        }}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
      >
        <Field label="Name (EN)" name="nameEn" required defaultValue={product.nameEn} />
        <Field label="Name (AR)" name="nameAr" required defaultValue={product.nameAr} />
        <Field label="Name (FR)" name="nameFr" required defaultValue={product.nameFr} />
        <Field label="Slug" name="slug" required defaultValue={product.slug} />
        <Select
          label="Category"
          name="categoryId"
          required
          defaultValue={product.categoryId}
          options={categories.map((c) => ({ value: c.id, label: `${c.nameEn} (${c.slug})` }))}
        />
        <Field label="Description EN" name="descriptionEn" textarea defaultValue={product.descriptionEn} />
        <Field label="Description AR" name="descriptionAr" textarea defaultValue={product.descriptionAr} />
        <Field label="Description FR" name="descriptionFr" textarea defaultValue={product.descriptionFr} />
        <Field label="Short EN" name="shortEn" defaultValue={product.shortEn} />
        <Field label="Short AR" name="shortAr" defaultValue={product.shortAr} />
        <Field label="Short FR" name="shortFr" defaultValue={product.shortFr} />
        <Field label="Sort order" name="sortOrder" type="number" defaultValue={String(product.sortOrder)} />
        <Field label="Logo image URL (optional)" name="image" placeholder="https://… or /logos/…" defaultValue={product.image ?? ""} />

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isActive" defaultChecked={product.isActive} /> Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isFeatured" defaultChecked={product.isFeatured} /> Featured
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isNew" defaultChecked={product.isNew} /> New
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="contentLocked" defaultChecked={product.contentLocked} /> Content locked
          </label>
        </div>

        <button className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--accent-hover)]">
          Save
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
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} selected={o.value === defaultValue ? true : undefined}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
