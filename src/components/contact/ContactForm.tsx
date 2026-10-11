"use client";

import { useState } from "react";
import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "../ui/Icons";

/** No backend needed: the message opens in WhatsApp, pre-filled. */
export function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("Product enquiry");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = [`*${topic}*`, `Name: ${name}`, phone ? `Phone: ${phone}` : "", message].filter(Boolean).join("\n");
    window.open(whatsappLink(text), "_blank", "noopener");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Mobile</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" inputMode="tel" autoComplete="tel" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Topic</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="input">
          {["Product enquiry", "Order status", "Wholesale / gym enquiry", "Supplement advice", "Return / refund", "Other"].map((t) => (
            <option key={t} className="bg-coal">{t}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Message</span>
        <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="input resize-none" placeholder="How can we help?" />
      </label>
      <button className="btn btn-whatsapp shine w-full py-4!">
        <WhatsAppIcon size={20} /> Send on WhatsApp
      </button>
    </form>
  );
}
