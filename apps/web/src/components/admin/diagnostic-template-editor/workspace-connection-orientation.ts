export type WorkspaceStructuralConnectionOrientation = 'vertical' | 'horizontal' | 'auto';

export const OWNS_SOURCE_VERTICAL_HANDLE_ID = 'owns-source-v';

export const OWNS_TARGET_VERTICAL_HANDLE_ID = 'owns-target-v';

export const OWNS_SOURCE_HORIZONTAL_HANDLE_ID = 'owns-source-h';

export const OWNS_TARGET_HORIZONTAL_HANDLE_ID = 'owns-target-h';

export const CHILD_SOURCE_VERTICAL_HANDLE_ID = 'child-source-v';

export const CHILD_TARGET_VERTICAL_HANDLE_ID = 'child-target-v';

export const CHILD_SOURCE_HORIZONTAL_HANDLE_ID = 'child-source-h';

export const CHILD_TARGET_HORIZONTAL_HANDLE_ID = 'child-target-h';

export type WorkspaceNodeRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function resolveStructuralConnectionOrientation(params: {
  readonly preference: WorkspaceStructuralConnectionOrientation;
  readonly sourceRect: WorkspaceNodeRect;
  readonly targetRect: WorkspaceNodeRect;
}): 'vertical' | 'horizontal' {
  if (params.preference !== 'auto') {
    return params.preference;
  }
  const sourceCenterX = params.sourceRect.x + params.sourceRect.width / 2;
  const sourceCenterY = params.sourceRect.y + params.sourceRect.height / 2;
  const targetCenterX = params.targetRect.x + params.targetRect.width / 2;
  const targetCenterY = params.targetRect.y + params.targetRect.height / 2;
  const deltaX = Math.abs(targetCenterX - sourceCenterX);
  const deltaY = Math.abs(targetCenterY - sourceCenterY);
  return deltaY >= deltaX ? 'vertical' : 'horizontal';
}

export function buildStructuralHandleIds(params: {
  readonly orientation: 'vertical' | 'horizontal';
  readonly kind: 'owns' | 'child';
}): { readonly sourceHandle: string; readonly targetHandle: string } {
  if (params.kind === 'owns') {
    return params.orientation === 'vertical'
      ? { sourceHandle: OWNS_SOURCE_VERTICAL_HANDLE_ID, targetHandle: OWNS_TARGET_VERTICAL_HANDLE_ID }
      : { sourceHandle: OWNS_SOURCE_HORIZONTAL_HANDLE_ID, targetHandle: OWNS_TARGET_HORIZONTAL_HANDLE_ID };
  }
  return params.orientation === 'vertical'
    ? { sourceHandle: CHILD_SOURCE_VERTICAL_HANDLE_ID, targetHandle: CHILD_TARGET_VERTICAL_HANDLE_ID }
    : { sourceHandle: CHILD_SOURCE_HORIZONTAL_HANDLE_ID, targetHandle: CHILD_TARGET_HORIZONTAL_HANDLE_ID };
}
