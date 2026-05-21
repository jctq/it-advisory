'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';

type WorkspaceFullscreenContextValue = {
  readonly isFullscreen: boolean;
  readonly enterFullscreen: () => void;
  readonly exitFullscreen: () => void;
  readonly toggleFullscreen: () => void;
};

const WorkspaceFullscreenContext = createContext<WorkspaceFullscreenContextValue | null>(null);

type WorkspaceFullscreenProviderProps = {
  readonly children: ReactNode;
};

export function WorkspaceFullscreenProvider(props: WorkspaceFullscreenProviderProps): ReactElement {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const enterFullscreen = useCallback((): void => {
    setIsFullscreen(true);
  }, []);
  const exitFullscreen = useCallback((): void => {
    setIsFullscreen(false);
  }, []);
  const toggleFullscreen = useCallback((): void => {
    setIsFullscreen((current) => !current);
  }, []);
  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);
  const value = useMemo(
    (): WorkspaceFullscreenContextValue => ({
      isFullscreen,
      enterFullscreen,
      exitFullscreen,
      toggleFullscreen,
    }),
    [enterFullscreen, exitFullscreen, isFullscreen, toggleFullscreen],
  );
  return (
    <WorkspaceFullscreenContext.Provider value={value}>{props.children}</WorkspaceFullscreenContext.Provider>
  );
}

export function useWorkspaceFullscreen(): WorkspaceFullscreenContextValue {
  const context = useContext(WorkspaceFullscreenContext);
  if (context === null) {
    throw new Error('useWorkspaceFullscreen must be used within WorkspaceFullscreenProvider');
  }
  return context;
}

export function useWorkspaceFullscreenEscape(): void {
  const { isFullscreen, exitFullscreen } = useWorkspaceFullscreen();
  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      exitFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitFullscreen, isFullscreen]);
}
