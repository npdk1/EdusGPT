/**
 * The File System Access API, only as much of it as the export button uses.
 *
 * Chrome and Edge ship it; Firefox and Safari do not, which is why every use
 * here is guarded and always has a plain download behind it. The shapes below
 * (the file handle, the writable stream) come from the DOM library itself —
 * only the save dialogue, which is still missing from it, is declared here.
 */

interface FilePickerAcceptType {
  description?: string;
  /** MIME type to extension, e.g. `{ "text/html": [".html"] }`. */
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

declare global {
  interface Window {
    showSaveFilePicker?: (
      options?: SaveFilePickerOptions,
    ) => Promise<FileSystemFileHandle>;
  }
}

export {};