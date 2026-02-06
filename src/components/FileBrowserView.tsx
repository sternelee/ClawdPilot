/**
 * File Browser View
 *
 * P2P file browser component for browsing remote directories and viewing files.
 */

import { Component, For, Show, onMount } from 'solid-js'
import { fileBrowserStore } from '../stores/fileBrowserStore'
import { notificationStore } from '../stores/notificationStore'

// ============================================================================
// Types
// ============================================================================

interface FileBrowserViewProps {
  class?: string
  onPathChange?: (path: string) => void
}

// ============================================================================
// Icons
// ============================================================================

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
)

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
  </svg>
)

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
  </svg>
)

// ============================================================================
// Component
// ============================================================================

export const FileBrowserView: Component<FileBrowserViewProps> = (props) => {
  const { state, navigateToPath, navigateBack, navigateForward, navigateUp, setEntries, setLoading, setError, viewFile, closeFile, setViewMode, canGoBack, canGoForward, canGoUp, getDirectories, getFiles } = fileBrowserStore

  // Load directory content
  const loadDirectory = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      // Call P2P message handler for file browser
      const response = await (window as any).invoke?.('file_browser_list', { path })
      if (response?.success) {
        setEntries(response.entries || [])
        navigateToPath(path)
        props.onPathChange?.(path)
      } else {
        throw new Error(response?.error || 'Failed to load directory')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load directory'
      setError(errorMsg)
      notificationStore.error(errorMsg, 'File Browser Error')
    } finally {
      setLoading(false)
    }
  }

  // Load file content
  const loadFile = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await (window as any).invoke?.('file_browser_read', { path })
      if (response?.success) {
        viewFile(path, response.content || '')
      } else {
        throw new Error(response?.error || 'Failed to read file')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to read file'
      setError(errorMsg)
      notificationStore.error(errorMsg, 'File Read Error')
    } finally {
      setLoading(false)
    }
  }

  // Handle entry click
  const handleEntryClick = (entry: { name: string; isDir: boolean }) => {
    const fullPath = state.currentPath === '.' ? entry.name : `${state.currentPath}/${entry.name}`

    if (entry.isDir) {
      loadDirectory(fullPath)
    } else {
      loadFile(fullPath)
    }
  }

  // Refresh current directory
  const refresh = () => {
    loadDirectory(state.currentPath)
  }

  // Initial load
  onMount(() => {
    loadDirectory(state.currentPath)
  })

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Breadcrumb path segments
  const pathSegments = () => {
    if (state.currentPath === '.') return [{ name: 'Root', path: '.' }]
    return state.currentPath.split('/').map((seg: string, i: number, arr: string[]) => ({
      name: seg || 'Root',
      path: arr.slice(0, i + 1).join('/') || '.',
    }))
  }

  return (
    <div class={`file-browser ${props.class || ''}`}>
      {/* Header */}
      <div class="file-browser-header">
        {/* Navigation Bar */}
        <div class="flex items-center gap-2 p-3 border-b border-base-300">
          {/* Navigation Buttons */}
          <div class="flex gap-1">
            <button
              class="btn btn-ghost btn-sm"
              disabled={!canGoBack()}
              onClick={navigateBack}
              title="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              class="btn btn-ghost btn-sm"
              disabled={!canGoForward()}
              onClick={navigateForward}
              title="Forward"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              class="btn btn-ghost btn-sm"
              disabled={!canGoUp()}
              onClick={navigateUp}
              title="Up"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
              </svg>
            </button>
            <button
              class="btn btn-ghost btn-sm"
              onClick={refresh}
              title="Refresh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              class="btn btn-ghost btn-sm"
              onClick={() => loadDirectory('.')}
              title="Home"
            >
              <HomeIcon />
            </button>
          </div>

          {/* Breadcrumb */}
          <div class="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            <For each={pathSegments()}>
              {(segment, i) => (
                <>
                  <button
                    class="btn btn-ghost btn-sm text-sm truncate max-w-[120px]"
                    onClick={() => loadDirectory(segment.path)}
                  >
                    {segment.name}
                  </button>
                  <Show when={i() < pathSegments().length - 1}>
                    <ChevronRightIcon />
                  </Show>
                </>
              )}
            </For>
          </div>

          {/* View Mode Toggle */}
          <div class="join">
            <button
              class={`btn btn-sm join-item ${state.viewMode === 'list' ? 'btn-active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              class={`btn btn-sm join-item ${state.viewMode === 'grid' ? 'btn-active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div class="file-browser-content">
        {/* Loading State */}
        <Show when={state.isLoading}>
          <div class="flex items-center justify-center h-64">
            <span class="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </Show>

        {/* Error State */}
        <Show when={state.error}>
          <div class="alert alert-error mx-4 mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{state.error}</span>
          </div>
        </Show>

        {/* File List View */}
        <Show when={!state.isLoading && state.viewMode === 'list'}>
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <Show when={getDirectories().length === 0 && getFiles().length === 0}>
                  <tr>
                    <td colspan="3" class="text-center text-base-content/50 py-8">
                      This directory is empty
                    </td>
                  </tr>
                </Show>
                <For each={getDirectories()}>
                  {(entry) => (
                    <tr
                      class="cursor-pointer hover:bg-base-200"
                      onClick={() => handleEntryClick(entry)}
                    >
                      <td class="flex items-center gap-2">
                        <span class="text-primary">
                          <FolderIcon />
                        </span>
                        {entry.name}
                      </td>
                      <td class="text-base-content/50">-</td>
                      <td>
                        <span class="badge badge-ghost">Directory</span>
                      </td>
                    </tr>
                  )}
                </For>
                <For each={getFiles()}>
                  {(entry) => (
                    <tr
                      class="cursor-pointer hover:bg-base-200"
                      onClick={() => handleEntryClick(entry)}
                    >
                      <td class="flex items-center gap-2">
                        <span class="text-base-content/70">
                          <FileIcon />
                        </span>
                        {entry.name}
                      </td>
                      <td>{formatSize(entry.size)}</td>
                      <td>
                        <span class="badge badge-ghost">File</span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        {/* Grid View */}
        <Show when={!state.isLoading && state.viewMode === 'grid'}>
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
            <Show when={getDirectories().length === 0 && getFiles().length === 0}>
              <div class="col-span-full text-center text-base-content/50 py-8">
                This directory is empty
              </div>
            </Show>
            <For each={getDirectories()}>
              {(entry) => (
                <div
                  class="flex flex-col items-center p-4 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
                  onClick={() => handleEntryClick(entry)}
                >
                  <span class="text-primary mb-2">
                    <FolderIcon />
                  </span>
                  <span class="text-sm text-center truncate w-full">{entry.name}</span>
                </div>
              )}
            </For>
            <For each={getFiles()}>
              {(entry) => (
                <div
                  class="flex flex-col items-center p-4 rounded-lg hover:bg-base-200 cursor-pointer transition-colors"
                  onClick={() => handleEntryClick(entry)}
                >
                  <span class="text-base-content/70 mb-2">
                    <FileIcon />
                  </span>
                  <span class="text-sm text-center truncate w-full">{entry.name}</span>
                  <span class="text-xs text-base-content/50">{formatSize(entry.size)}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* File Content Modal */}
      <Show when={state.viewingFile}>
        <div class="modal modal-open">
          <div class="modal-box max-w-4xl h-[80vh] flex flex-col">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-lg truncate">{state.viewingFile?.path}</h3>
              <button class="btn btn-sm btn-circle btn-ghost" onClick={closeFile}>✕</button>
            </div>
            <div class="flex-1 overflow-auto font-mono text-sm bg-base-200 rounded-lg p-4">
              <pre class="whitespace-pre-wrap break-words">{state.viewingFile?.content}</pre>
            </div>
          </div>
          <div class="modal-backdrop" onClick={closeFile}></div>
        </div>
      </Show>
    </div>
  )
}

export default FileBrowserView
