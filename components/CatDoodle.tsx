/** Flat SVG version of the cat, for pages without the 3D scene. */
export function CatDoodle({ mood = "happy", className = "" }: { mood?: "happy" | "confused"; className?: string }) {
  return (
    <svg viewBox="0 0 200 170" className={className} role="img" aria-label={mood === "confused" ? "A confused cat" : "A friendly cat"}>
      <path d="M150 140c30-5 40-40 20-55" fill="none" stroke="#d98a4e" strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="100" cy="125" rx="55" ry="38" fill="#e59a5c" />
      <ellipse cx="100" cy="135" rx="30" ry="22" fill="#f6d7b4" />
      <path d="M58 60 64 22l26 26zM142 60l-6-38-26 26z" fill="#e59a5c" />
      <path d="M66 52 69 33l12 13zM134 52l-3-19-12 13z" fill="#f2b7a0" />
      <circle cx="100" cy="72" r="42" fill="#e59a5c" />
      {mood === "confused" ? (
        <>
          <circle cx="84" cy="70" r="6" fill="#2a2320" />
          <path d="M110 70h12" stroke="#2a2320" strokeWidth="4" strokeLinecap="round" />
          <path d="M92 92q8-5 16 0" fill="none" stroke="#2a2320" strokeWidth="3" strokeLinecap="round" />
          <text x="150" y="40" fontSize="34" fontWeight="700" fill="#c8643b">?</text>
          <text x="168" y="62" fontSize="22" fontWeight="700" fill="#c8643b">?</text>
        </>
      ) : (
        <>
          <path d="M78 70q6-7 12 0M110 70q6-7 12 0" fill="none" stroke="#2a2320" strokeWidth="4" strokeLinecap="round" />
          <path d="M93 86q7 7 14 0" fill="none" stroke="#2a2320" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      <path d="M97 80h6l-3 4z" fill="#c45a6a" />
      <path d="M60 82h-22M60 88l-20 5M140 82h22M140 88l20 5" stroke="#2a2320" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
