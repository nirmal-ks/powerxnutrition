import { ImageResponse } from "next/og";

export const alt = "PowerX Nutrition — Fuel Your Better Tomorrow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          backgroundColor: "#070707",
          backgroundImage: "radial-gradient(circle at 80% 20%, #5a0400 0%, #070707 55%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 120, fontWeight: 900, fontStyle: "italic", letterSpacing: -4 }}>
          POWER<span style={{ color: "#e10600", fontSize: 150, lineHeight: 0.9 }}>X</span>
        </div>
        <div style={{ fontSize: 34, letterSpacing: 18, color: "#f5b700", fontWeight: 700, marginTop: 4 }}>NUTRITION</div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 50 }}>FUEL YOUR BETTER TOMORROW</div>
        <div style={{ fontSize: 30, color: "#a1a1aa", marginTop: 16 }}>
          Whey Protein · Creatine · Mass Gainer · Pre-Workout · Vitamins
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
          {["100% Genuine", "Cash on Delivery", "UPI", "Fast Delivery"].map((t) => (
            <div key={t} style={{ border: "2px solid #f5b700", borderRadius: 999, padding: "10px 24px", fontSize: 24, color: "#f5b700" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
