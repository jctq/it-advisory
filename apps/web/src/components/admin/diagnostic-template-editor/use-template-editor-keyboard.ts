'use client';

import { useEffect } from 'react';
import { useTemplateEditor } from '@/components/admin/diagnostic-template-editor/template-editor-context';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return target.isContentEditable;
}

export function useTemplateEditorKeyboard(): void {
  const { canUndo, canRedo, executeUndo, executeRedo } = useTemplateEditor();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) {
        return;
      }
      const isShift = event.shiftKey;
      if (event.key === 'z' && !isShift && canUndo) {
        event.preventDefault();
        executeUndo();
        return;
      }
      if ((event.key === 'z' && isShift) || event.key === 'y') {
        if (!canRedo) {
          return;
        }
        event.preventDefault();
        executeRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, executeRedo, executeUndo]);
}
