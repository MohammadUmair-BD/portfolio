import { ImageResponse } from "next/og";
import { profile } from "@/lib/profile";

/** The preview card shown when the site is shared on LinkedIn, WhatsApp, X, Slack, etc. */
export const alt = `${profile.name}, ${profile.headline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const topSkills = profile.skills.filter((s) => s.category !== "familiar").slice(0, 6).map((s) => s.name);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1b1714", color: "#f3ecd9", padding: 72, fontFamily: "serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: "#e68a5c", textTransform: "uppercase", fontFamily: "sans-serif" }}>{profile.location}</div>
          <div style={{ fontSize: 88, fontWeight: 700, marginTop: 12, lineHeight: 1.05 }}>{profile.name}</div>
          <div style={{ fontSize: 40, marginTop: 16, color: "#c2b5a7", fontFamily: "sans-serif" }}>{profile.headline}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 40, fontFamily: "sans-serif" }}>
            {topSkills.map((s) => (
              <div key={s} style={{ fontSize: 24, padding: "8px 20px", borderRadius: 999, border: "2px solid #4a3f37", color: "#f3ecd9" }}>{s}</div>
            ))}
          </div>
        </div>
        {/* Miso */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 300 }}>
          <svg width="260" height="260" viewBox="0 0 64 64">
            <path d="M15 27 18 9l11 10zM49 27 46 9 35 19z" fill="#e59a5c" />
            <path d="M18.5 22 20 14l5 5zM45.5 22 44 14l-5 5z" fill="#f2b7a0" />
            <circle cx="32" cy="35" r="19" fill="#e59a5c" />
            <path d="M23 34q3-3.5 6 0M35 34q3-3.5 6 0" fill="none" stroke="#1b1714" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M30 40h4l-2 2.4z" fill="#c45a6a" />
            <path d="M28 44q4 3.5 8 0" fill="none" stroke="#1b1714" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
