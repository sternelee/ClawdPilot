/**
 * File Browser View
 *
 * P2P file browser using @pierre/trees for the directory tree
 * and @pierre/diffs File renderer for syntax-highlighted file preview.
 */

import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { FileTree } from "@pierre/trees";
import { File as PierreFile } from "@pierre/diffs";
import { fileBrowserStore } from "../stores/fileBrowserStore";
import type { FileEntry } from "../stores/fileBrowserStore";
import { notificationStore } from "../stores/notificationStore";
import type { SessionMode } from "../stores/sessionStore";
import { Alert } from "./ui/primitives";
import { Button } from "./ui/primitives";
import { Dialog } from "./ui/primitives";
import { Spinner } from "./ui/primitives";

// ============================================================================
// Types
// ============================================================================

interface FileBrowserViewProps {
  class?: string;
  projectPath?: string;
  sessionMode?: SessionMode;
  controlSessionId?: string;
  onPathChange?: (path: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build @pierre/trees path list from a flat FileEntry array.
 * Trailing slash on directories tells the tree they are folders
 * (per normalizeInputPath spec: "Trailing slashes explicitly mark directories").
 */
const buildTreePaths = (entries: FileEntry[]): string[] =>
  entries.map((e) => (e.isDir ? `${e.name}/` : e.name));

// ============================================================================
// Icons
// ============================================================================

const HomeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-4 w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-3.5 w-3.5 sm:h-4 sm:w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fill-rule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
      clip-rule="evenodd"
    />
  </svg>
);

const FileIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fill-rule="evenodd"
      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
      clip-rule="evenodd"
    />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

export const FileBrowserView: Component<FileBrowserViewProps> = (props) => {
  const {
    state,
    navigateToPath,
    setEntries,
    setLoading,
    setError,
    viewFile,
    closeFile,
    clearOpenRequest,
  } = fileBrowserStore;

  let lastRootPath: string | null = null;
  let treeContainerRef: HTMLDivElement | undefined;

  // Use a signal for the file preview container so createEffect can react
  // when the Dialog's Show block renders and sets the ref.
  const [filePreviewContainer, setFilePreviewContainer] = createSignal<
    HTMLDivElement | undefined
  >(undefined);
  const [targetLine, setTargetLine] = createSignal<number | undefined>(
    undefined,
  );

  // Pierre instances — stable across re-renders
  let fileTreeInstance: FileTree;
  let pierreFileInstance: PierreFile;

  // ============================================================================
  // Path helpers
  // ============================================================================

  const rootPath = createMemo(() => {
    const raw = (props.projectPath || ".").trim();
    if (!raw) return ".";
    if (raw === "/") return raw;
    return raw.replace(/\/+$/, "");
  });

  const resolvePath = (path: string): string =>
    path === "." ? rootPath() : path;

  const joinPath = (base: string, name: string): string =>
    base === "/" ? `/${name}` : `${base}/${name}`;

  const getRemoteControlSessionId = (): string => {
    if (!props.controlSessionId)
      throw new Error("Remote control session is not available");
    return props.controlSessionId;
  };

  // ============================================================================
  // Data fetching
  // ============================================================================

  const loadDirectory = async (path: string) => {
    const resolvedPath = resolvePath(path);
    setLoading(true);
    setError(null);

    try {
      const response =
        props.sessionMode === "remote"
          ? await invoke<{
              success: boolean;
              entries?: FileEntry[];
              error?: string;
            }>("remote_file_browser_list", {
              controlSessionId: getRemoteControlSessionId(),
              path: resolvedPath,
            })
          : await invoke<{
              success: boolean;
              entries?: FileEntry[];
              error?: string;
            }>("file_browser_list", { path: resolvedPath });

      if (response?.success) {
        setEntries(response.entries || []);
        navigateToPath(resolvedPath);
        props.onPathChange?.(resolvedPath);
      } else {
        throw new Error(response?.error || "Failed to load directory");
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load directory";
      setError(errorMsg);
      notificationStore.error(errorMsg, "File Browser Error");
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (path: string, jumpToLine?: number) => {
    setLoading(true);
    setError(null);

    try {
      const response =
        props.sessionMode === "remote"
          ? await invoke<{
              success: boolean;
              content?: string;
              error?: string;
            }>("remote_file_browser_read", {
              controlSessionId: getRemoteControlSessionId(),
              path,
            })
          : await invoke<{
              success: boolean;
              content?: string;
              error?: string;
            }>("file_browser_read", { path });

      if (response?.success) {
        viewFile(path, response.content || "");
        setTargetLine(
          typeof jumpToLine === "number" &&
            Number.isFinite(jumpToLine) &&
            jumpToLine > 0
            ? Math.floor(jumpToLine)
            : undefined,
        );
      } else {
        throw new Error(response?.error || "Failed to read file");
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to read file";
      setError(errorMsg);
      notificationStore.error(errorMsg, "File Read Error");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // @pierre/trees selection handler
  // ============================================================================

  /**
   * Fired by FileTree when the user selects an item.
   * Paths ending with "/" are directories (per @pierre/trees normalizeInputPath).
   */
  const handleTreeSelection = (selectedPaths: readonly string[]) => {
    if (!selectedPaths.length) return;
    const selected = selectedPaths[0];
    const basePath = resolvePath(state.currentPath);

    if (selected.endsWith("/")) {
      // Directory — navigate into it
      const dirName = selected.slice(0, -1);
      void loadDirectory(joinPath(basePath, dirName));
    } else {
      // File — open preview
      void loadFile(joinPath(basePath, selected));
    }
  };

  // ============================================================================
  // Navigation helpers
  // ============================================================================

  const refresh = () => void loadDirectory(resolvePath(state.currentPath));

  const goUp = () => {
    const current = resolvePath(state.currentPath);
    const root = rootPath();
    if (current === root) return;
    const parts = current.split("/").filter(Boolean);
    parts.pop();
    const parentPath = current.startsWith("/")
      ? `/${parts.join("/")}` || "/"
      : parts.join("/") || ".";
    void loadDirectory(parentPath);
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    // Create the FileTree instance with whatever entries are already cached
    fileTreeInstance = new FileTree({
      paths: buildTreePaths(state.entries),
      icons: "complete",
      onSelectionChange: handleTreeSelection,
      // Show all items expanded (flat directory listing mode)
      initialExpansion: "open",
      // Directories have no pre-loaded children, so keep them as-is
      flattenEmptyDirectories: false,
    });
    if (treeContainerRef) {
      fileTreeInstance.render({ containerWrapper: treeContainerRef });
    }

    // Create the Pierre File renderer for syntax-highlighted file preview
    pierreFileInstance = new PierreFile({
      theme: "pierre-dark",
      disableFileHeader: false,
    });

    // Load the initial directory
    const pathToLoad =
      state.entries.length > 0 ? resolvePath(state.currentPath) : rootPath();
    void loadDirectory(pathToLoad);
  });

  onCleanup(() => {
    fileTreeInstance?.cleanUp();
    pierreFileInstance?.cleanUp();
  });

  // Sync FileTree paths whenever store entries change
  createEffect(() => {
    const paths = buildTreePaths(state.entries);
    fileTreeInstance?.resetPaths(paths);
  });

  // Render file preview using @pierre/diffs File whenever the file or container changes
  createEffect(() => {
    const vf = state.viewingFile;
    const container = filePreviewContainer();
    if (!vf || !container || !pierreFileInstance) return;
    const fileName = vf.path.split("/").pop() || "file";
    pierreFileInstance.render({
      file: { name: fileName, contents: vf.content },
      containerWrapper: container,
    });
  });

  // Scroll to target line after the preview renders
  createEffect(() => {
    const line = targetLine();
    const container = filePreviewContainer();
    if (!state.viewingFile || !line || !container) return;
    const lineHeight = 20;
    container.scrollTo({ top: Math.max((line - 1) * lineHeight - 80, 0), behavior: "smooth" });
  });

  // React to projectPath changes (re-load from new root)
  createEffect(() => {
    const nextRoot = rootPath();
    if (lastRootPath === null) {
      lastRootPath = nextRoot;
      return;
    }
    if (lastRootPath !== nextRoot) {
      lastRootPath = nextRoot;
      void loadDirectory(nextRoot);
    }
  });

  // Handle external open-file requests (e.g. from chat card click)
  createEffect(() => {
    const req = state.openRequest;
    if (!req) return;

    const openRequestedFile = async () => {
      const normalizedPath = req.path;
      const lastSlash = normalizedPath.lastIndexOf("/");
      const parentPath =
        lastSlash > 0
          ? normalizedPath.slice(0, lastSlash)
          : normalizedPath.startsWith("/")
            ? "/"
            : ".";
      try {
        await loadDirectory(parentPath);
        await loadFile(normalizedPath, req.line);
      } finally {
        clearOpenRequest();
      }
    };

    void openRequestedFile();
  });

  // ============================================================================
  // Breadcrumb
  // ============================================================================

  const pathSegments = () => {
    const root = rootPath();
    const current = resolvePath(state.currentPath);
    if (current === root) return [];
    const rootWithSlash = root.endsWith("/") ? root : `${root}/`;
    if (!current.startsWith(rootWithSlash)) return [];
    const relative = current.slice(rootWithSlash.length);
    const segments = relative.split("/").filter(Boolean);
    return segments.map((seg, i) => ({
      name: seg,
      path: joinPath(root, segments.slice(0, i + 1).join("/")),
    }));
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div class={`flex flex-col h-full bg-base-200 ${props.class || ""}`}>
      {/* Header — navigation bar + breadcrumb */}
      <div class="flex-none border-b border-border/50 bg-base-200/80 backdrop-blur-sm">
        <div class="flex items-center gap-1.5 p-2 sm:p-3">
          {/* Up / Refresh / Home buttons */}
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              class="h-7 w-7 rounded-lg"
              disabled={resolvePath(state.currentPath) === rootPath()}
              onClick={goUp}
              title="Go up one level"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="xs"
              class="h-7 w-7 rounded-lg"
              onClick={refresh}
              title="Refresh"
            >
              <Show
                when={state.isLoading}
                fallback={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clip-rule="evenodd"
                    />
                  </svg>
                }
              >
                <Spinner size="sm" />
              </Show>
            </Button>
            <Button
              variant="ghost"
              size="xs"
              class="h-7 w-7 rounded-lg"
              onClick={() => loadDirectory(rootPath())}
              title="Go to root"
            >
              <HomeIcon />
            </Button>
          </div>

          <div class="h-4 w-px bg-border/50 mx-1" />

          {/* Breadcrumb */}
          <div class="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-hide gap-0.5">
            <button
              class="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => loadDirectory(rootPath())}
              title="Root"
            >
              <HomeIcon />
            </button>
            <For each={pathSegments()}>
              {(segment) => (
                <div class="flex items-center shrink-0">
                  <span class="text-muted-foreground/40">
                    <ChevronRightIcon />
                  </span>
                  <button
                    class="max-w-28 truncate rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={() => loadDirectory(segment.path)}
                  >
                    {segment.name}
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Main content — @pierre/trees fills this area */}
      <div class="flex-1 overflow-hidden relative">
        {/* Loading overlay (only on initial load with no cached data) */}
        <Show when={state.isLoading && !state.entries.length}>
          <div class="absolute inset-0 flex items-center justify-center bg-base-200/70 z-10">
            <Spinner size="lg" class="text-primary" />
          </div>
        </Show>

        {/* Error banner */}
        <Show when={state.error}>
          <Alert variant="destructive" class="m-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm">{state.error}</span>
          </Alert>
        </Show>

        {/* @pierre/trees container — FileTree renders its shadow DOM here */}
        <div ref={treeContainerRef} class="h-full" />
      </div>

      {/* File preview Dialog — uses @pierre/diffs File renderer */}
      <Show when={state.viewingFile}>
        <Dialog
          open={!!state.viewingFile}
          onClose={closeFile}
          contentClass="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background rounded-2xl"
        >
          <div class="flex flex-col h-full min-h-0">
            {/* Dialog header */}
            <div class="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-base-200/50 shrink-0">
              <h3 class="font-medium text-sm text-foreground flex items-center gap-2 min-w-0">
                <span class="shrink-0">
                  <FileIcon />
                </span>
                <span class="truncate">
                  {state.viewingFile?.path.split("/").pop() || "File"}
                </span>
                <span class="text-muted-foreground/50 font-normal text-xs hidden sm:block truncate">
                  {state.viewingFile?.path}
                </span>
              </h3>
            </div>

            {/* @pierre/diffs File renderer container */}
            <div
              ref={setFilePreviewContainer}
              class="flex-1 overflow-auto"
            />
          </div>
        </Dialog>
      </Show>
    </div>
  );
};

export default FileBrowserView;
