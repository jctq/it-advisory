'use client';

import type { ReactElement, ReactNode } from 'react';
import { useWorkspaceAppearance } from '@/components/admin/diagnostic-template-editor/use-workspace-appearance';
import {
  readWorkspaceEdgeColors,
  readWorkspaceGuideStrokeColor,
  readWorkspaceRoundSequenceEdgeStyle,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';

type GuideIllustrationProps = {
  readonly className?: string;
};

/** Four-way move cursor (matches OS `cursor: move` when dragging edge endpoints). */
function MoveCursorGlyph(props: { readonly x: number; readonly y: number; readonly scale?: number }): ReactElement {
  const scale = props.scale ?? 1;
  const cursorFill = '#f8fafc';
  const cursorStroke = '#0f172a';
  const offset = 8 * scale;
  return (
    <g transform={`translate(${props.x - offset} ${props.y - offset}) scale(${scale})`} aria-hidden>
      <path
        d="M8 0 L9.8 5.2 L8.2 4.6 L8.2 7.2 L10.8 8.4 L8 9.6 L5.2 8.4 L7.8 7.2 L7.8 4.6 L6.2 5.2 Z"
        fill={cursorFill}
        stroke={cursorStroke}
        strokeWidth="0.85"
        strokeLinejoin="round"
      />
      <path
        d="M8 16 L9.8 10.8 L8.2 11.4 L8.2 8.8 L10.8 7.6 L8 6.4 L5.2 7.6 L7.8 8.8 L7.8 11.4 L6.2 10.8 Z"
        fill={cursorFill}
        stroke={cursorStroke}
        strokeWidth="0.85"
        strokeLinejoin="round"
      />
      <path
        d="M0 8 L5.2 6.2 L4.6 7.8 L7.2 7.8 L8.4 5.2 L9.6 8 L8.4 10.8 L7.2 8.2 L4.6 8.2 L5.2 9.8 Z"
        fill={cursorFill}
        stroke={cursorStroke}
        strokeWidth="0.85"
        strokeLinejoin="round"
      />
      <path
        d="M16 8 L10.8 6.2 L11.4 7.8 L8.8 7.8 L7.6 5.2 L6.4 8 L7.6 10.8 L8.8 8.2 L11.4 8.2 L10.8 9.8 Z"
        fill={cursorFill}
        stroke={cursorStroke}
        strokeWidth="0.85"
        strokeLinejoin="round"
      />
      <rect x="6.75" y="6.75" width="2.5" height="2.5" fill={cursorFill} stroke={cursorStroke} strokeWidth="0.5" />
    </g>
  );
}

function GuideIllustrationFrame(props: {
  readonly className?: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 280 156"
      role="img"
      aria-hidden
      className={props.className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="280" height="156" rx="10" className="fill-muted/40 stroke-border" strokeWidth="1" />
      {props.children}
    </svg>
  );
}

export function AddRoundGuideIllustration(props: GuideIllustrationProps): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  const accent = readWorkspaceGuideStrokeColor(isDark);
  return (
    <GuideIllustrationFrame className={props.className}>
      <rect x="168" y="14" width="100" height="36" rx="8" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="176" y="22" width="20" height="20" rx="6" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.5" />
      <path d="M182 32h8M186 28v8" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="200" y="22" width="20" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="224" y="22" width="20" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="248" y="22" width="12" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
      <path
        d="M186 42v8l-24 18H52a8 8 0 0 1-8-8V44a8 8 0 0 1 8-8h118"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd="url(#add-round-arrow)"
      />
      <defs>
        <marker id="add-round-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={accent} />
        </marker>
      </defs>
      <rect x="24" y="52" width="148" height="88" rx="12" className="fill-card stroke-border" strokeWidth="1.5" />
      <rect x="24" y="52" width="148" height="24" rx="12" className="fill-muted/60" />
      <text x="36" y="68" className="fill-foreground" fontSize="10" fontWeight="600">
        Round 3
      </text>
      <rect x="36" y="86" width="72" height="40" rx="8" className="fill-background stroke-border" strokeWidth="1" />
      <text x="44" y="102" className="fill-muted-foreground" fontSize="8" fontWeight="600">
        QUESTION
      </text>
    </GuideIllustrationFrame>
  );
}

export function AddQuestionGuideIllustration(props: GuideIllustrationProps): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  const accent = readWorkspaceGuideStrokeColor(isDark);
  return (
    <GuideIllustrationFrame className={props.className}>
      <rect x="168" y="14" width="100" height="36" rx="8" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="176" y="22" width="20" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="200" y="22" width="20" height="20" rx="6" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.5" />
      <rect x="206" y="30" width="8" height="4" rx="1" fill={accent} />
      <rect x="224" y="22" width="20" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" opacity="0.5" />
      <rect x="24" y="28" width="148" height="108" rx="12" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="2" />
      <rect x="24" y="28" width="148" height="24" rx="12" className="fill-muted/60" />
      <text x="36" y="44" fill={accent} fontSize="10" fontWeight="600">
        Round 1 (selected)
      </text>
      <rect x="36" y="62" width="72" height="40" rx="8" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="116" y="62" width="44" height="40" rx="8" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M218 42v20l-58 24" fill="none" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" />
    </GuideIllustrationFrame>
  );
}

export function AddOptionGuideIllustration(props: GuideIllustrationProps): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  const accent = readWorkspaceGuideStrokeColor(isDark);
  const ownsColor = readWorkspaceEdgeColors(isDark).owns;
  return (
    <GuideIllustrationFrame className={props.className}>
      <rect x="168" y="14" width="100" height="36" rx="8" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="176" y="22" width="20" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" opacity="0.5" />
      <rect x="200" y="22" width="20" height="20" rx="6" className="fill-muted stroke-border" strokeWidth="1" opacity="0.5" />
      <rect x="224" y="22" width="20" height="20" rx="6" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.5" />
      <rect x="24" y="28" width="148" height="108" rx="12" className="fill-card stroke-border" strokeWidth="1.5" />
      <rect x="36" y="48" width="72" height="40" rx="8" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="2" />
      <text x="44" y="64" fill={accent} fontSize="8" fontWeight="600">
        QUESTION (selected)
      </text>
      <rect x="116" y="58" width="44" height="28" rx="6" className="fill-background stroke-border" strokeWidth="1" />
      <rect x="116" y="94" width="44" height="28" rx="6" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M108 72h8" stroke={ownsColor} strokeWidth="2" />
    </GuideIllustrationFrame>
  );
}

export function ReorderRoundGuideIllustration(props: GuideIllustrationProps): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  const accent = readWorkspaceGuideStrokeColor(isDark);
  return (
    <GuideIllustrationFrame className={props.className}>
      <rect x="156" y="16" width="112" height="124" rx="10" className="fill-card stroke-border" strokeWidth="1.5" />
      <text x="168" y="36" className="fill-foreground" fontSize="11" fontWeight="600">
        Round inspector
      </text>
      <text x="168" y="54" className="fill-muted-foreground" fontSize="9">
        Customer flow order
      </text>
      <text x="168" y="70" className="fill-muted-foreground" fontSize="9">
        Round 2 of 3
      </text>
      <rect x="168" y="82" width="72" height="24" rx="6" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="1" />
      <text x="178" y="98" fill={accent} fontSize="9" fontWeight="600">
        Move earlier
      </text>
      <rect x="248" y="82" width="12" height="24" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="24" y="36" width="112" height="36" rx="10" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="24" y="80" width="112" height="36" rx="10" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="2" />
      <rect x="24" y="124" width="112" height="20" rx="10" className="fill-card stroke-border" strokeWidth="1" opacity="0.6" />
      <path d="M92 72v8" stroke={accent} strokeWidth="1.5" markerEnd="url(#reorder-round-up)" />
      <defs>
        <marker id="reorder-round-up" markerWidth="6" markerHeight="6" refX="3" refY="0" orient="auto">
          <path d="M0,6 L3,0 L6,6 Z" fill={accent} />
        </marker>
      </defs>
    </GuideIllustrationFrame>
  );
}

export function ReorderQuestionGuideIllustration(props: GuideIllustrationProps): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  const accent = readWorkspaceGuideStrokeColor(isDark);
  const seqStyle = readWorkspaceRoundSequenceEdgeStyle(isDark);
  const stroke = typeof seqStyle.stroke === 'string' ? seqStyle.stroke : accent;
  return (
    <GuideIllustrationFrame className={props.className}>
      <rect x="20" y="24" width="240" height="108" rx="12" className="fill-card stroke-border" strokeWidth="1.5" />
      <rect x="36" y="48" width="64" height="44" rx="8" className="fill-background stroke-border" strokeWidth="1" />
      <rect x="116" y="48" width="64" height="44" rx="8" className="fill-background stroke-border" strokeWidth="1" />
      <rect x="196" y="48" width="48" height="44" rx="8" className="fill-background stroke-border" strokeWidth="1" />
      <path
        d="M100 58 C120 40, 108 88, 128 70"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <circle cx="114" cy="54" r="6" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="1.5" />
      <MoveCursorGlyph x={118} y={52} scale={1.2} />
      <text x="36" y="112" className="fill-muted-foreground" fontSize="9">
        Move cursor on the dashed line — drag to another question
      </text>
    </GuideIllustrationFrame>
  );
}

export function MoveQuestionBetweenRoundsGuideIllustration(props: GuideIllustrationProps): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  const accent = readWorkspaceGuideStrokeColor(isDark);
  return (
    <GuideIllustrationFrame className={props.className}>
      <rect x="20" y="88" width="112" height="52" rx="10" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="148" y="24" width="112" height="72" rx="10" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="2.5" />
      <rect x="148" y="24" width="112" height="20" rx="10" className="fill-muted/60" />
      <text x="160" y="38" fill={accent} fontSize="9" fontWeight="600">
        Target round
      </text>
      <rect x="52" y="44" width="56" height="36" rx="8" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="2" />
      <text x="58" y="58" fill={accent} fontSize="8" fontWeight="600">
        QUESTION
      </text>
      <path
        d="M108 62 C128 50, 136 48, 152 52"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <rect x="164" y="52" width="48" height="32" rx="6" className="fill-background stroke-border" strokeWidth="1" strokeDasharray="4 3" />
    </GuideIllustrationFrame>
  );
}
