"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { categories } from "@/lib/catalog";
import { discountPercent } from "@/lib/format";
import { slugify } from "@/lib/product-input";
import { GST_RATES } from "@/lib/settings-types";
import type { CategorySlug, Product, PublicationStatus } from "@/types";
import { PlusIcon, TrashIcon } from "../ui/Icons";
import { useCan } from "./SessionContext";
import { Alert, api } from "./ui";

type VariantDraft = { id?: string; label: string; flavour: string; sku: string; barcode: string; price: string; mrp: string; stock: string; minStock: string; cost: string; existing: boolean; currentStock: number };

const toDraft = (p?: Product) => ({
  name: p?.name ?? "",
  slug: p?.slug ?? "",
  brand: p?.brand ?? "",
  category: (p?.category ?? "whey-protein") as CategorySlug,
  description: p?.description ?? "",
  image: p?.image ?? "",
  featured: p?.featured ?? false,
  status: (p?.status ?? "published") as PublicationStatus,
  sort: String(p?.sort ?? 999),
  hsn: p?.hsn ?? "",
  gstRate: p?.gstRate === null || p?.gstRate === undefined ? "" : String(p.gstRate),
  supplierId: p?.supplierId ?? "",
  trackExpiry: p?.trackExpiry ?? false,
  variants: (p?.variants ?? ([{ id: "", label: "1 kg", flavour: "", price: 0, mrp: 0, stock: 0 }] as Product["variants"])).map((v) => ({
    id: v.id || undefined,
    label: v.label,
    flavour: v.flavour ?? "",
    sku: v.sku ?? "",
    barcode: v.barcode ?? "",
    price: String(v.price || ""),
    mrp: String(v.mrp || ""),
    stock: "0",
    minStock: String(v.minStock ?? 2),
    cost: v.cost === null || v.cost === undefined ? "" : String(v.cost),
    existing: Boolean(p),
    currentStock: v.stock ?? 0,
  })) as VariantDraft[],
});

export function ProductForm({ product, suppliers = [] }: { product?: Product; suppliers?: { id: string; name: string }[] }) {
  const router = useRouter();
  const can = useCan();
  const [d, setD] = useState(toDraft(product));
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const seeCost = can("products.cost");
  const canOpening = can("inventory.adjust");
  const canPhoto = can("images.review");

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const setVariant = (i: number, k: keyof VariantDraft, v: string) => setD((prev) => ({ ...prev, variants: prev.variants.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)) }));

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", d.slug || slugify(d.name));
      const data = await api<{ url: string }>("/api/admin/upload", { method: "POST", body: fd });
      set("image", data.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...d,
      slug: d.slug || slugify(d.name),
      sort: Number(d.sort),
      gstRate: d.gstRate === "" ? null : Number(d.gstRate),
      supplierId: d.supplierId || null,
      variants: d.variants.map((v) => ({
        id: v.id,
        label: v.label,
        flavour: v.flavour,
        sku: v.sku,
        barcode: v.barcode,
        price: Number(v.price),
        mrp: Number(v.mrp) || Number(v.price),
        stock: v.existing ? 0 : Number(v.stock) || 0,
        minStock: v.minStock,
        ...(seeCost && v.cost !== "" ? { cost: Number(v.cost) } : {}),
      })),
    };
    try {
      await api(product ? `/api/admin/products/${product.slug}` : "/api/admin/products", { method: product ? "PUT" : "POST", json: body });
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const label = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400";

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-5 rounded-2xl border border-white/8 bg-coal p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={label}>Product name *</span>
            <input
              required
              value={d.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              className="input"
              placeholder="e.g. ON Gold Standard 100% Whey"
            />
          </label>
          <label className="block">
            <span className={label}>Brand *</span>
            <input required value={d.brand} onChange={(e) => set("brand", e.target.value)} className="input" placeholder="e.g. Optimum Nutrition" />
          </label>
          <label className="block">
            <span className={label}>Category *</span>
            <select value={d.category} onChange={(e) => set("category", e.target.value as CategorySlug)} className="input">
              {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-coal">{c.name}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Page URL</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-smoke">/product/</span>
              <input
                value={d.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
                className="input"
                placeholder="auto from name"
              />
            </div>
            {product && d.slug !== product.slug && <span className="mt-1 block text-xs text-gold">Changing the URL breaks old links shared on WhatsApp/Google.</span>}
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Description</span>
            <textarea value={d.description} onChange={(e) => set("description", e.target.value)} rows={4} className="input" placeholder="What it is, key benefits, how to use…" />
          </label>
        </div>

        <div>
          <p className={label}>Sizes / flavours *</p>
          <div className="space-y-2">
            {d.variants.map((v, i) => {
              const off = discountPercent(Number(v.price), Number(v.mrp));
              return (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 p-3 sm:grid-cols-4">
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">Size / pack *</span>
                    <input required value={v.label} onChange={(e) => setVariant(i, "label", e.target.value)} className="input py-2!" placeholder="1 kg" />
                  </label>
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">Flavour</span>
                    <input value={v.flavour} onChange={(e) => setVariant(i, "flavour", e.target.value)} className="input py-2!" placeholder="e.g. Chocolate" />
                  </label>
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">SKU</span>
                    <input value={v.sku} onChange={(e) => setVariant(i, "sku", e.target.value.toUpperCase())} className="input py-2!" />
                  </label>
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">Barcode</span>
                    <input value={v.barcode} onChange={(e) => setVariant(i, "barcode", e.target.value)} inputMode="numeric" className="input py-2!" />
                  </label>
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">Selling price ₹ *</span>
                    <input required type="number" min={1} step="0.01" value={v.price} onChange={(e) => setVariant(i, "price", e.target.value)} className="input py-2!" />
                  </label>
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">MRP ₹ {off > 0 && <b className="text-green-400">({off}% off)</b>}</span>
                    <input type="number" min={0} step="0.01" value={v.mrp} onChange={(e) => setVariant(i, "mrp", e.target.value)} className="input py-2!" />
                  </label>
                  <label className="block">
                    <span className="text-[0.65rem] text-smoke">Low-stock alert at</span>
                    <input type="number" min={0} value={v.minStock} onChange={(e) => setVariant(i, "minStock", e.target.value)} className="input py-2!" />
                  </label>
                  {seeCost && (
                    <label className="block">
                      <span className="text-[0.65rem] text-smoke">Purchase cost ₹ (avg)</span>
                      <input type="number" min={0} step="0.01" value={v.cost} onChange={(e) => setVariant(i, "cost", e.target.value)} className="input py-2!" placeholder="not set" />
                    </label>
                  )}
                  <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-4">
                    {v.existing ? (
                      <span className="text-xs text-smoke">Stock: <b className="text-white">{v.currentStock}</b> — changes via sales, <Link href="/admin/inventory/stock-in" className="text-gold underline">receiving stock</Link> or <Link href="/admin/inventory" className="text-gold underline">adjustments</Link></span>
                    ) : canOpening ? (
                      <label className="flex items-center gap-2 text-xs text-smoke">
                        Opening stock
                        <input type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, "stock", e.target.value)} className="input w-24! py-1.5!" />
                      </label>
                    ) : (
                      <span className="text-xs text-smoke">Stock is added by receiving a purchase.</span>
                    )}
                    <button
                      type="button"
                      aria-label="Remove size"
                      disabled={d.variants.length === 1}
                      onClick={() => set("variants", d.variants.filter((_, idx) => idx !== i))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-smoke hover:text-ember disabled:opacity-30"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => set("variants", [...d.variants, { label: "", flavour: "", sku: "", barcode: "", price: "", mrp: "", stock: "0", minStock: "2", cost: "", existing: false, currentStock: 0 }])}
            className="btn btn-ghost mt-3 py-2! text-xs!"
          >
            <PlusIcon size={14} /> Add size / flavour
          </button>
          {product && <p className="mt-2 text-[0.7rem] text-smoke">Removing a size that was ever sold or stocked only hides it — its history stays. Price changes never alter past bills.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={label}>HSN code</span>
            <input value={d.hsn} onChange={(e) => set("hsn", e.target.value.replace(/\D/g, ""))} className="input" maxLength={8} placeholder="e.g. 2106" />
          </label>
          <label className="block">
            <span className={label}>GST rate</span>
            <select value={d.gstRate} onChange={(e) => set("gstRate", e.target.value)} className="input">
              <option value="" className="bg-coal">Not set</option>
              {GST_RATES.map((r) => <option key={r} value={r} className="bg-coal">{r}%</option>)}
            </select>
            <span className="mt-1 block text-[0.7rem] text-smoke">Needed only if GST billing is on. Confirm the rate with your accountant.</span>
          </label>
          <label className="block">
            <span className={label}>Main supplier</span>
            <select value={d.supplierId} onChange={(e) => set("supplierId", e.target.value)} className="input">
              <option value="" className="bg-coal">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-coal">{s.name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-white/8 bg-coal p-5">
          <p className={label}>Product photo</p>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200">
            {d.image ? (
              <Image src={d.image} alt="" fill sizes="280px" className="object-contain p-3 mix-blend-multiply" unoptimized={d.image.startsWith("http")} />
            ) : (
              <span className="flex h-full items-center justify-center p-4 text-center text-xs font-bold text-zinc-500">No photo — a clean placeholder is shown (never a fake photo)</span>
            )}
          </div>
          {product?.imageStatus && product.imageStatus !== "APPROVED" && d.image === (product.image ?? "") && d.image && <p className="mt-2 text-xs text-gold">This photo is not approved yet — it is NOT shown on the website.</p>}
          {canPhoto ? (
            <>
              <label className="btn btn-ghost mt-3 w-full cursor-pointer py-2.5! text-xs!">
                {uploading ? "Uploading…" : "Upload genuine photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              <p className="mt-2 text-[0.7rem] text-smoke">A photo you upload or set here is published when you save. Must show the exact size & flavour. Auto-resized to WebP.</p>
            </>
          ) : (
            <p className="mt-2 text-[0.7rem] text-smoke">Photos are approved by the owner/manager in Product photos.</p>
          )}
          {product?.id && <Link href={`/admin/images?product=${product.id}`} className="mt-2 block text-center text-xs font-bold text-gold underline">Find / review photos →</Link>}
        </div>

        <div className="space-y-3 rounded-2xl border border-white/8 bg-coal p-5 text-sm">
          <label className="block">
            <span className={label}>Publication</span>
            <select value={d.status} onChange={(e) => set("status", e.target.value as PublicationStatus)} className="input">
              <option value="published" className="bg-coal">Published (online store + shop)</option>
              <option value="draft" className="bg-coal">Hidden (shop billing only)</option>
              <option value="archived" className="bg-coal">Archived</option>
            </select>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} className="h-4 w-4 accent-[#f5b700]" />
            Featured / bestseller
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={d.trackExpiry} onChange={(e) => set("trackExpiry", e.target.checked)} className="h-4 w-4 accent-[#f5b700]" />
            Track expiry dates
          </label>
          <label className="block">
            <span className={label}>Sort order</span>
            <input type="number" value={d.sort} onChange={(e) => set("sort", e.target.value)} className="input py-2!" />
            <span className="mt-1 block text-[0.7rem] text-smoke">Lower numbers show first.</span>
          </label>
        </div>

        {error && <Alert>{error}</Alert>}
        <button disabled={saving || uploading} className="btn btn-red w-full">
          {saving ? "Saving…" : product ? "Save changes" : "Create product"}
        </button>
        <Link href="/admin/products" className="block text-center text-xs font-bold uppercase tracking-widest text-smoke hover:text-white">
          Cancel
        </Link>
      </div>
    </form>
  );
}
