'use client';

import { ViewportPortal, useViewport } from '@xyflow/react';
import type { ReactElement } from 'react';
import type { SnapGuideLines } from '@/components/admin/diagnostic-template-editor/workspace-node-snap';
import { useWorkspaceAppearance } from '@/components/admin/diagnostic-template-editor/use-workspace-appearance';
import { readWorkspaceGuideStrokeColor } from '@/components/admin/diagnostic-template-editor/workspace-theme';

type WorkspaceSnapGuidesProps = {
  readonly guides: SnapGuideLines | null;
};

const GUIDE_EXTENT = 100_000;

export function WorkspaceSnapGuides(props: WorkspaceSnapGuidesProps): ReactElement | null {
  const { zoom } = useViewport();
  const { isDark } = useWorkspaceAppearance();
  const guideStroke = readWorkspaceGuideStrokeColor(isDark);
  if (props.guides === null) {
    return null;
  }
  const { horizontal, vertical } = props.guides;
  if (horizontal === null && vertical === null) {
    return null;
  }
  const strokeWidth = 1 / zoom;
  return (
    <ViewportPortal>
      <svg
        className="pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          overflow: 'visible',
        }}
        aria-hidden
      >
        {vertical !== null ? (
          <line
            x1={vertical}
            y1={-GUIDE_EXTENT}
            x2={vertical}
            y2={GUIDE_EXTENT}
            stroke={guideStroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            opacity={0.85}
          />
        ) : null}
        {horizontal !== null ? (
          <line
            x1={-GUIDE_EXTENT}
            y1={horizontal}
            x2={GUIDE_EXTENT}
            y2={horizontal}
            stroke={guideStroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            opacity={0.85}
          />
        ) : null}
      </svg>
    </ViewportPortal>
  );
}
