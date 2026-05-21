import {
  markdown$,
  markdownSourceEditorValue$,
  realmPlugin,
  viewMode$,
  type ViewMode,
} from '@mdxeditor/editor';

type BlogEditorViewSyncPluginParams = {
  readonly onMarkdownSync: (markdown: string) => void;
};

/**
 * Keeps parent markdown state aligned when toggling between rich text and source.
 */
export const blogEditorViewSyncPlugin = realmPlugin<BlogEditorViewSyncPluginParams>({
  init(realm, params): void {
    if (params === undefined) {
      return;
    }
    let previousViewMode: ViewMode = realm.getValue(viewMode$);
    realm.sub(viewMode$, (nextViewMode: ViewMode) => {
      if (previousViewMode === nextViewMode) {
        return;
      }
      const markdownToSync =
        previousViewMode === 'source'
          ? realm.getValue(markdownSourceEditorValue$)
          : realm.getValue(markdown$);
      params.onMarkdownSync(markdownToSync);
      previousViewMode = nextViewMode;
    });
  },
});
