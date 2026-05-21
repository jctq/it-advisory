import { useId, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

export type MarketingSectionArtVariant =
  | 'metrics'
  | 'spotlight'
  | 'process'
  | 'services-rescue'
  | 'services-vendor'
  | 'services-automation'
  | 'engagement'
  | 'story'
  | 'resources';

type MarketingSectionArtProps = {
  readonly variant: MarketingSectionArtVariant;
  readonly className?: string;
};

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 320;

/**
 * Decorative abstract topology art aligned with the marketing hero — theme-aware via CSS tokens.
 */
export function MarketingSectionArt(props: MarketingSectionArtProps): ReactElement {
  const instanceId = useId().replace(/:/g, '');
  const gradientId = `section-art-${props.variant}-${instanceId}`;
  return (
    <svg
      className={cn('marketing-section-art h-full w-full', props.className)}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="marketing-hero-stop-primary" stopOpacity="0.85" />
          <stop offset="100%" className="marketing-hero-stop-primary" stopOpacity="0.08" />
        </linearGradient>
        <filter id={`${gradientId}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <g className="marketing-hero-grid marketing-section-art-grid" opacity="0.35">
        {[80, 160, 240].map((y) => (
          <line key={`h-${y}`} x1="0" y1={y} x2={VIEW_WIDTH} y2={y} />
        ))}
        {[120, 240, 360].map((x) => (
          <line key={`v-${x}`} x1={x} y1="0" x2={x} y2={VIEW_HEIGHT} />
        ))}
      </g>
      {renderVariantArt(props.variant, gradientId)}
    </svg>
  );
}

function renderVariantArt(variant: MarketingSectionArtVariant, gradientId: string): ReactElement {
  switch (variant) {
    case 'metrics':
      return (
        <g opacity="0.9">
          <circle cx="360" cy="120" r="52" className="marketing-hero-fill-soft" filter={`url(#${gradientId}-blur)`} />
          <circle cx="360" cy="120" r="9" className="marketing-hero-fill-primary" />
          <circle cx="300" cy="180" r="5" className="marketing-hero-fill-primary" />
          <circle cx="400" cy="200" r="5" className="marketing-hero-fill-primary" />
          <circle cx="320" cy="240" r="4" className="marketing-hero-fill-primary" />
          <path
            d="M360 120 L300 180 M360 120 L400 200 M360 120 L320 240"
            className="marketing-hero-stroke-primary"
            strokeWidth="1.25"
            opacity="0.55"
          />
          <path
            d="M40 260 Q180 80 360 120"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            opacity="0.65"
          />
        </g>
      );
    case 'spotlight':
      return (
        <g opacity="0.85">
          <path
            d="M420 40 C320 120 200 140 80 200"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
          />
          <path
            d="M400 280 C300 220 180 200 60 160"
            className="marketing-hero-stroke"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <circle cx="420" cy="40" r="6" className="marketing-hero-fill-primary" />
          <circle cx="80" cy="200" r="5" className="marketing-hero-fill-primary" />
          <circle cx="60" cy="160" r="4" className="marketing-hero-fill-primary" />
        </g>
      );
    case 'process':
      return (
        <g opacity="0.88">
          <path
            d="M60 200 L180 120 L300 180 L420 100"
            className="marketing-hero-stroke-primary"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <circle cx="60" cy="200" r="7" className="marketing-hero-fill-primary" />
          <circle cx="180" cy="120" r="7" className="marketing-hero-fill-primary" />
          <circle cx="300" cy="180" r="7" className="marketing-hero-fill-primary" />
          <circle cx="420" cy="100" r="7" className="marketing-hero-fill-primary" />
          <path
            d="M420 100 Q460 60 440 40"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            opacity="0.7"
          />
        </g>
      );
    case 'services-rescue':
      return (
        <g opacity="0.9">
          <path
            d="M80 240 L200 160 L320 200 L400 120"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
          />
          <path d="M200 160 L200 80 L280 100" className="marketing-hero-stroke" strokeWidth="1.25" opacity="0.45" />
          <circle cx="200" cy="160" r="10" className="marketing-hero-fill-soft" filter={`url(#${gradientId}-blur)`} />
          <circle cx="200" cy="160" r="6" className="marketing-hero-fill-primary" />
          <path d="M120 280 L360 280" className="marketing-hero-grid" strokeWidth="1" opacity="0.5" />
        </g>
      );
    case 'services-vendor':
      return (
        <g opacity="0.9">
          <path d="M100 80 L220 80 L220 200 L100 200 Z" className="marketing-hero-fill-soft" opacity="0.5" />
          <path d="M260 120 L380 120 L380 240 L260 240 Z" className="marketing-hero-fill-soft" opacity="0.35" />
          <path
            d="M220 140 L260 180"
            className="marketing-hero-stroke-primary"
            strokeWidth="1.5"
          />
          <circle cx="160" cy="140" r="5" className="marketing-hero-fill-primary" />
          <circle cx="320" cy="180" r="5" className="marketing-hero-fill-primary" />
          <path
            d="M160 140 Q240 60 320 180"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            opacity="0.75"
          />
        </g>
      );
    case 'services-automation':
      return (
        <g opacity="0.9">
          <circle cx="120" cy="200" r="6" className="marketing-hero-fill-primary" />
          <circle cx="240" cy="140" r="8" className="marketing-hero-fill-primary" />
          <circle cx="360" cy="200" r="6" className="marketing-hero-fill-primary" />
          <path
            d="M120 200 L240 140 L360 200"
            className="marketing-hero-stroke-primary"
            strokeWidth="1.5"
            opacity="0.55"
          />
          <path
            d="M240 140 L240 60 M240 140 L320 100"
            className="marketing-hero-stroke"
            strokeWidth="1.25"
            opacity="0.45"
          />
          <ellipse
            cx="240"
            cy="140"
            rx="64"
            ry="40"
            className="marketing-hero-fill-soft"
            filter={`url(#${gradientId}-blur)`}
          />
          <path
            d="M60 80 Q180 40 360 80"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            opacity="0.65"
          />
        </g>
      );
    case 'engagement':
      return (
        <g opacity="0.85">
          <path
            d="M100 220 C180 120 300 120 380 220"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
          />
          <circle cx="100" cy="220" r="5" className="marketing-hero-fill-primary" />
          <circle cx="240" cy="150" r="7" className="marketing-hero-fill-primary" />
          <circle cx="380" cy="220" r="5" className="marketing-hero-fill-primary" />
        </g>
      );
    case 'story':
      return (
        <g opacity="0.88">
          <circle cx="320" cy="160" r="72" className="marketing-hero-fill-soft" filter={`url(#${gradientId}-blur)`} />
          <circle cx="320" cy="160" r="10" className="marketing-hero-fill-primary" />
          <path
            d="M320 160 L200 100 M320 160 L380 80 M320 160 L280 260"
            className="marketing-hero-stroke-primary"
            strokeWidth="1.25"
            opacity="0.5"
          />
          <path
            d="M60 260 Q200 40 320 160"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            opacity="0.7"
          />
        </g>
      );
    case 'resources':
      return (
        <g opacity="0.88">
          <path d="M80 100 H200 V220 H80 Z" className="marketing-hero-fill-soft" opacity="0.4" />
          <path d="M220 80 H340 V200 H220 Z" className="marketing-hero-fill-soft" opacity="0.28" />
          <path d="M260 240 H380 V300 H260 Z" className="marketing-hero-fill-soft" opacity="0.22" />
          <path
            d="M200 160 L260 200"
            className="marketing-hero-stroke-primary"
            strokeWidth="1.25"
            opacity="0.55"
          />
          <path
            d="M340 140 Q400 200 260 240"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            opacity="0.65"
          />
        </g>
      );
  }
}
