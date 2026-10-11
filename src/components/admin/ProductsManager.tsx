"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { categories, categoryBySlug, productUrl } from "@/lib/catalog";
import { cn } from "@/lib/format";
import { inr2 } from "@/lib/money";
import type { Product, Variant } from "@/types";
import { SearchIcon } from "../ui/Icons";
import { useCan } from "./SessionContext";
import { api, Badge } from "./ui";

type Filter = "all" | "published" | "draft" | "archived" | "low" | "out" | "photo";

export function ProductsManager({ products: initial }: { products: Product[] }) {
  const sp = useSearchParams();
  const [products, setProducts] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [filter, setFilter] = useState<Filter>((sp.get("filter") as Filter) ?? "all");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filter !== "archived" && p.status === "archived") return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (s && !`${p.name} ${p.brand} ${p.slug} ${p.variants.map((v) => `${v.sku} ${v.barcode} ${v.flavour}`).join(" ")}`.toLowerCase().includes(s)) return false;
      if (filter === "published" && p.status !== "published") return false;
      if (filter === "draft" && p.status !== "draft") return false;
      if (filter === "archived" && p.status !== "archived") return false;
      if (filter === "low" && !p.variants.some((v) => v.stock > 0 && v.stock <= (v.minStock ?? 2))) return false;
      if (filter === "out" && !p.variants.some((v) => v.stock <= 0)) return false;
      if (filter === "photo" && p.imageStatus === "APPROVED") return false;
      return true;
    });
  }, [products, q, cat, filter]);

  const replace = (p: Product) => setProducts((prev) => prev.map((x) => (x.slug === p.slug ? { ...x, ...p } : x)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="relative min-w-0 flex-1 basis-60">
          <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, SKU, barcode, flavour…" className="input pl-10" />
        </label>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input w-auto!">
          <option value="all" className="bg-coal">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-coal">{c.name}</option>)}
        </select>
      </div>
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        {([["all", "All"], ["published", "Online"], ["draft", "Drafts / hidden"], ["photo", "Needs photo"], ["low", "Low stock"], ["out", "Out of stock"], ["archived", "Archived"]] as [Filter, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", filter === id ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400")}>{label}</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-smoke">{list.length} of {products.filter((p) => p.status !== "archived").length} products</p>
      <ul className="space-y-3">
        {list.map((p) => <ProductRow key={p.slug} product={p} onSaved={replace} onRemoved={() => setProducts((prev) => prev.filter((x) => x.slug !== p.slug))} />)}
      </ul>
    </div>
  );
}

function ProductRow({ product, onSaved, onRemoved }: { product: Product; onSaved: (p: Product) => void; onRemoved: () => void }) {
  const can = useCan();
  const [variants, setVariants] = useState<Variant[]>(product.variants);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(variants.map((v) => [v.price, v.mrp])) !== JSON.stringify(product.variants.map((v) => [v.price, v.mrp]));
  const edit = can("products.edit");

  const patch = async (body: Record<string, unknown>, okText = "Saved ✔") => {
    setSaving(true);
    setMsg(null);
    try {
      const d = await api<{ product?: Product }>(`/api/admin/products/${product.slug}`, { method: "PATCH", json: body });
      setMsg({ ok: true, text: okText });
      setTimeout(() => setMsg(null), 1800);
      if (d.product) {
        setVariants(d.product.variants);
        onSaved({ ...d.product, image: product.image });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${product.name}"? Only possible if it was never sold or stocked — otherwise archive it.`)) return;
    try {
      await api(`/api/admin/products/${product.slug}`, { method: "DELETE" });
      onRemoved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const setV = (i: number, k: "price" | "mrp", val: string) => setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, [k]: Math.max(0, Number(val) || 0) } : v)));
  const stock = product.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);

  return (
    <li className={cn("rounded-2xl border bg-coal p-3 sm:p-4", product.status === "published" ? "border-white/8" : "border-dashed border-white/15")}>
      <div className="flex flex-wrap items-start gap-4">
        <Link href={`/admin/images?product=${product.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200" title="Product photo">
          {product.image ? <Image src={product.image} alt="" fill sizes="64px" className={cn("object-contain p-1 mix-blend-multiply", product.imageStatus !== "APPROVED" && "opacity-40")} /> : <span className="flex h-full items-center justify-center text-[0.6rem] font-bold text-zinc-500">NO IMG</span>}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/admin/products/${product.slug}`} className="font-semibold hover:text-gold">{product.name}</Link>
            {product.status !== "published" && <Badge tone={product.status === "archived" ? "red" : "zinc"}>{product.status === "draft" ? "hidden" : product.status}</Badge>}
            {product.featured && <Badge tone="gold">Featured</Badge>}
            {product.imageStatus !== "APPROVED" && <Badge tone={product.imageStatus === "REVIEW_REQUIRED" ? "gold" : "zinc"}>{product.imageStatus === "REVIEW_REQUIRED" ? "photo to review" : "photo pending"}</Badge>}
            {product.gstRate !== null && product.gstRate !== undefined && <Badge>GST {product.gstRate}%</Badge>}
          </div>
          <p className="text-xs text-smoke">{product.brand} · {categoryBySlug(product.category)?.name} · total stock {stock}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs">
              <thead className="text-left text-smoke">
                <tr>
                  <th className="pr-3 font-semibold">Size / flavour</th>
                  <th className="pr-3 font-semibold">SKU</th>
                  <th className="pr-3 font-semibold">Price ₹</th>
                  <th className="pr-3 font-semibold">MRP ₹</th>
                  {variants.some((v) => v.cost !== undefined) && <th className="pr-3 font-semibold">Cost</th>}
                  <th className="font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap py-1 pr-3 text-zinc-300">{v.label}{v.flavour ? ` · ${v.flavour}` : ""}</td>
                    <td className="py-1 pr-3 text-smoke">{v.sku || "—"}</td>
                    {(["price", "mrp"] as const).map((k) => (
                      <td key={k} className="py-1 pr-3">
                        <input type="number" min={0} value={v[k]} onChange={(e) => setV(i, k, e.target.value)} disabled={!edit} className="input w-24! px-2! py-1.5! text-sm" />
                      </td>
                    ))}
                    {v.cost !== undefined && <td className="py-1 pr-3">{v.cost === null ? <span className="text-gold">not set</span> : inr2(v.cost)}</td>}
                    <td className={cn("py-1 font-bold", v.stock <= 0 ? "text-ember" : v.stock <= (v.minStock ?? 2) ? "text-gold" : "text-green-300")}>{v.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {edit && (
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-col sm:items-end">
            {product.status !== "archived" && (
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={product.status === "published"} onChange={(e) => patch({ active: e.target.checked }, e.target.checked ? "Published ✔" : "Hidden ✔")} className="accent-[#e10600]" /> Online
              </label>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={product.featured} onChange={(e) => patch({ featured: e.target.checked })} className="accent-[#f5b700]" /> Featured
            </label>
            <div className="flex gap-2">
              <button disabled={!dirty || saving} onClick={() => patch({ variants: variants.map((v) => ({ id: v.id, price: v.price, mrp: v.mrp })) })} className="btn btn-gold px-3! py-2! text-xs!">
                {saving ? "Saving…" : "Save prices"}
              </button>
              <Link href={`/admin/products/${product.slug}`} className="btn btn-ghost px-3! py-2! text-xs!">Edit</Link>
            </div>
            <div className="flex gap-3 text-[0.7rem]">
              {product.status === "published" && <a href={productUrl(product.slug)} target="_blank" className="text-smoke hover:text-white">View ↗</a>}
              {product.status !== "archived" ? (
                <button onClick={() => window.confirm(`Archive "${product.name}"? It disappears from the store and lists; history is kept.`) && patch({ archive: true }, "Archived").then(onRemoved)} className="text-smoke hover:text-gold">Archive</button>
              ) : (
                <button onClick={() => patch({ status: "draft" }, "Restored as hidden draft")} className="text-smoke hover:text-gold">Restore</button>
              )}
              <button onClick={remove} className="text-smoke hover:text-ember">Delete</button>
            </div>
            {msg && <span className={cn("text-xs", msg.ok ? "text-green-400" : "text-ember")}>{msg.text}</span>}
          </div>
        )}
      </div>
    </li>
  );
}
