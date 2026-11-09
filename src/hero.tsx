import icon from "../icon.svg"
import { Wordmark } from "./wordmark.tsx"

// A late sun on the horizon. The rings around it are echoes: solid close in,
// then breaking into dots as they dry out on the way to the edge.
const rings = [
  { r: 124, dash: "", opacity: 0.55, width: 1.5 },
  { r: 156, dash: "10 7", opacity: 0.42, width: 1.5 },
  { r: 192, dash: "3 9", opacity: 0.32, width: 1.75 },
  { r: 232, dash: "0 11", opacity: 0.26, width: 2.25 },
  { r: 276, dash: "0 16", opacity: 0.18, width: 2.25 },
]

const bands = [
  { y: 96, h: 3 },
  { y: 110, h: 4 },
  { y: 123, h: 5 },
  { y: 135, h: 6 },
]

export function Hero() {
  return (
    <header className="relative isolate h-36 overflow-hidden rounded-3xl bg-[linear-gradient(180deg,var(--hero-from),var(--hero-to))] shadow-sm max-sm:h-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_76%_100%,var(--hero-glow),transparent_70%)]" />
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto max-sm:-right-28"
        viewBox="0 0 640 144"
        aria-hidden
      >
        <defs>
          <linearGradient id="dryer-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--hero-sun-from)" />
            <stop offset="1" stopColor="var(--hero-sun-to)" />
          </linearGradient>
          <mask id="dryer-bands">
            <rect width="640" height="144" fill="white" />
            {bands.map((band) => (
              <rect key={band.y} y={band.y} width="640" height={band.h} fill="black" />
            ))}
          </mask>
        </defs>
        {rings.map((ring) => (
          <circle
            key={ring.r}
            cx="452"
            cy="160"
            r={ring.r}
            fill="none"
            stroke="var(--hero-line)"
            strokeOpacity={ring.opacity}
            strokeWidth={ring.width}
            strokeDasharray={ring.dash || undefined}
            strokeLinecap="round"
          />
        ))}
        <circle cx="452" cy="160" r="100" fill="url(#dryer-sun)" mask="url(#dryer-bands)" />
      </svg>
      <Grain />
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-3/4 bg-[linear-gradient(90deg,var(--hero-from)_55%,transparent)] max-sm:block" />
      <div className="relative flex h-full flex-col justify-center gap-2.5 px-8 max-sm:px-6">
        <h1 className="flex items-center gap-3 text-(--hero-ink)">
          <img src={icon} alt="" className="size-10 rounded-[10px] shadow-sm" />
          <Wordmark />
        </h1>
        <p className="text-sm text-(--hero-muted)">Take the room out of a recording.</p>
      </div>
    </header>
  )
}

// A fine film grain. It gives the band its sun-bleached texture and keeps the gradients from banding.
function Grain() {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full opacity-[0.14] mix-blend-soft-light" aria-hidden>
      <filter id="dryer-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#dryer-grain)" />
    </svg>
  )
}
