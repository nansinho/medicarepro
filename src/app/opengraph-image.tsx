import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Image Open Graph du site (1200×630), générée au build.
 * Utilisée par défaut pour tous les partages (réseaux sociaux, messageries) ;
 * les pages peuvent la surcharger via leur propre metadata openGraph.images.
 * Le pictogramme officiel est lu depuis public/ et incrusté en data URI.
 */
export const alt =
  "MediCare Pro — Tout votre cabinet de podologie dans une seule application";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const iconDataUri = `data:image/png;base64,${readFileSync(
    join(process.cwd(), "public", "icon-192.png"),
  ).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #16304d 0%, #1e457f 55%, #2b6fd6 130%)",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Halo lumineux */}
        <div
          style={{
            position: "absolute",
            top: -220,
            left: 340,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(121,176,234,0.4), rgba(121,176,234,0) 65%)",
          }}
        />
        {/* Pictogramme officiel + marque */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 108,
              height: 108,
              borderRadius: 28,
              background: "#ffffff",
              boxShadow: "0 18px 44px rgba(4, 16, 36, 0.45)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- satori */}
            <img src={iconDataUri} width={82} height={82} alt="" />
          </div>
          <div style={{ fontSize: 64, fontWeight: 700 }}>MediCare Pro</div>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: "rgba(255,255,255,0.88)",
            textAlign: "center",
            maxWidth: 860,
            lineHeight: 1.3,
          }}
        >
          Tout votre cabinet de podologie dans une seule application
        </div>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 18,
            fontSize: 22,
            color: "#79b0ea",
            fontWeight: 600,
          }}
        >
          <span>Facturation auto</span>
          <span>·</span>
          <span>13 bilans</span>
          <span>·</span>
          <span>Agenda</span>
          <span>·</span>
          <span>HDS France</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
