import { ImageResponse } from "next/og";

// Image files can't read CSS variables, so these mirror day --ground and
// --accent in tokens.css. The icon is a placeholder: [✓] on paper.
const GROUND = "#F2EBDD";
const ACCENT = "#A83B2A";

/**
 * Drawn as paths rather than text: the font has no ✓. Everything sits inside
 * the central 80% circle, so the same drawing is safe as a maskable icon.
 */
export function renderIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: GROUND,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 100 100">
          <path
            d="M30 25 H22 V75 H30 M70 25 H78 V75 H70 M36 51 L46 61 L64 40"
            fill="none"
            stroke={ACCENT}
            strokeWidth={7}
            strokeLinecap="square"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
