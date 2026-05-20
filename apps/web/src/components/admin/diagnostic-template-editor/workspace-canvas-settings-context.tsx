'use client';

import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import type { WorkspaceStructuralConnectionOrientation } from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';

export type WorkspaceCanvasSettings = {
  readonly structuralConnectionOrientation: WorkspaceStructuralConnectionOrientation;
};

const DEFAULT_SETTINGS: WorkspaceCanvasSettings = {
  structuralConnectionOrientation: 'auto',
};

const WorkspaceCanvasSettingsContext = createContext<WorkspaceCanvasSettings>(DEFAULT_SETTINGS);

type WorkspaceCanvasSettingsProviderProps = {
  readonly settings: WorkspaceCanvasSettings;
  readonly children: ReactNode;
};

export function WorkspaceCanvasSettingsProvider(props: WorkspaceCanvasSettingsProviderProps): ReactElement {
  return (
    <WorkspaceCanvasSettingsContext.Provider value={props.settings}>
      {props.children}
    </WorkspaceCanvasSettingsContext.Provider>
  );
}

export function useWorkspaceCanvasSettings(): WorkspaceCanvasSettings {
  return useContext(WorkspaceCanvasSettingsContext);
}
