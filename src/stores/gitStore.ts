/**
 * Git Store
 *
 * Manages git operations state for P2P git access including:
 * - Git status
 * - File diffs
 * - Branch information
 * - Loading and error states
 */

import { createStore, produce } from 'solid-js/store'

// ============================================================================
// Types
// ============================================================================

export interface GitStatusEntry {
  x: string // Index status
  y: string // Working tree status
  to: string | null // Original path in case of rename
  from: string // Path
}

export interface GitDiff {
  file: string
  diff: string
  hunks?: GitHunk[]
}

export interface GitHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  header: string
  lines: GitDiffLine[]
}

export interface GitDiffLine {
  type: 'context' | 'add' | 'remove' | 'header'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export type GitViewMode = 'status' | 'diff' | 'history'

// ============================================================================
// Store
// ============================================================================

interface GitState {
  // Git status
  statusOutput: string
  statusEntries: GitStatusEntry[]

  // Current diff being viewed
  currentDiff: GitDiff | null

  // Branch info
  currentBranch: string | null
  branches: string[]

  // View mode
  viewMode: GitViewMode

  // Loading states
  isLoadingStatus: boolean
  isLoadingDiff: boolean

  // Error states
  error: string | null

  // File selection
  selectedFile: string | null

  // Diff options
  contextLines: number
  ignoreWhitespace: boolean
}

const initialState: GitState = {
  statusOutput: '',
  statusEntries: [],
  currentDiff: null,
  currentBranch: null,
  branches: [],
  viewMode: 'status',
  isLoadingStatus: false,
  isLoadingDiff: false,
  error: null,
  selectedFile: null,
  contextLines: 3,
  ignoreWhitespace: false,
}

export const createGitStore = () => {
  const [state, setState] = createStore<GitState>(initialState)

  // ========================================================================
  // Status Operations
  // ========================================================================

  const setStatusOutput = (output: string) => {
    setState('statusOutput', output)
    parseStatusOutput(output)
  }

  const parseStatusOutput = (output: string) => {
    const entries: GitStatusEntry[] = []
    for (const line of output.split('\n').filter(Boolean)) {
      if (line.length >= 3) {
        entries.push({
          x: line[0],
          y: line[1],
          to: line.includes('->') ? line.split('->')[1].trim() : null,
          from: line.slice(3).split('->')[0].trim(),
        })
      }
    }
    setState('statusEntries', entries)
  }

  const setLoadingStatus = (loading: boolean) => {
    setState('isLoadingStatus', loading)
  }

  // ========================================================================
  // Diff Operations
  // ========================================================================

  const setCurrentDiff = (diff: GitDiff | null) => {
    setState('currentDiff', diff)
    if (diff) {
      parseDiffLines(diff.diff)
    }
  }

  const parseDiffLines = (diff: string) => {
    const lines: GitDiffLine[] = []
    const hunks: GitHunk[] = []
    let currentHunk: GitHunk | null = null
    let oldLineNum = 0
    let newLineNum = 0

    const diffLines = diff.split('\n')

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i]

      // Parse hunk header
      const hunkMatch = line.match(/^@@\s+-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s+@@/)
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk)
        }
        oldLineNum = parseInt(hunkMatch[1]) - 1
        newLineNum = parseInt(hunkMatch[3]) - 1
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldCount: parseInt(hunkMatch[2] || '1'),
          newStart: parseInt(hunkMatch[3]),
          newCount: parseInt(hunkMatch[4] || '1'),
          header: line,
          lines: [],
        }
        lines.push({ type: 'header', content: line })
        continue
      }

      // Parse diff lines
      if (line.startsWith('+') && !line.startsWith('+++')) {
        newLineNum++
        lines.push({ type: 'add', content: line.slice(1), newLineNum })
        if (currentHunk) currentHunk.lines.push({ type: 'add', content: line.slice(1), newLineNum })
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        oldLineNum++
        lines.push({ type: 'remove', content: line.slice(1), oldLineNum })
        if (currentHunk) currentHunk.lines.push({ type: 'remove', content: line.slice(1), oldLineNum })
      } else if (line.startsWith(' ')) {
        oldLineNum++
        newLineNum++
        lines.push({ type: 'context', content: line.slice(1), oldLineNum, newLineNum })
        if (currentHunk) currentHunk.lines.push({ type: 'context', content: line.slice(1), oldLineNum, newLineNum })
      } else {
        lines.push({ type: 'header', content: line })
        if (currentHunk) currentHunk.lines.push({ type: 'header', content: line })
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk)
    }

    setState(
      produce((s: GitState) => {
        if (s.currentDiff) {
          s.currentDiff.hunks = hunks
        }
      }),
    )
  }

  const setLoadingDiff = (loading: boolean) => {
    setState('isLoadingDiff', loading)
  }

  // ========================================================================
  // Branch Operations
  // ========================================================================

  const setCurrentBranch = (branch: string | null) => {
    setState('currentBranch', branch)
  }

  const setBranches = (branches: string[]) => {
    setState('branches', branches)
  }

  // ========================================================================
  // View Mode
  // ========================================================================

  const setViewMode = (mode: GitViewMode) => {
    setState('viewMode', mode)
  }

  // ========================================================================
  // Selection
  // ========================================================================

  const setSelectedFile = (file: string | null) => {
    setState('selectedFile', file)
  }

  // ========================================================================
  // Diff Options
  // ========================================================================

  const setContextLines = (lines: number) => {
    setState('contextLines', lines)
  }

  const setIgnoreWhitespace = (ignore: boolean) => {
    setState('ignoreWhitespace', ignore)
  }

  // ========================================================================
  // Error
  // ========================================================================

  const setError = (error: string | null) => {
    setState('error', error)
  }

  // ========================================================================
  // Derived State
  // ========================================================================

  const getStagedFiles = (): GitStatusEntry[] => {
    return state.statusEntries.filter((e) => e.x !== ' ' && e.x !== '?')
  }

  const getModifiedFiles = (): GitStatusEntry[] => {
    return state.statusEntries.filter((e) => e.y !== ' ')
  }

  const getUntrackedFiles = (): GitStatusEntry[] => {
    return state.statusEntries.filter((e) => e.x === '?' && e.y === '?')
  }

  const hasChanges = (): boolean => {
    return state.statusEntries.length > 0
  }

  const getStatusSummary = (): { staged: number; modified: number; untracked: number } => {
    return {
      staged: getStagedFiles().length,
      modified: getModifiedFiles().filter((e) => e.x === ' ').length,
      untracked: getUntrackedFiles().length,
    }
  }

  return {
    // State
    state,

    // Status
    setStatusOutput,
    setLoadingStatus,

    // Diff
    setCurrentDiff,
    setLoadingDiff,

    // Branch
    setCurrentBranch,
    setBranches,

    // View Mode
    setViewMode,

    // Selection
    setSelectedFile,

    // Options
    setContextLines,
    setIgnoreWhitespace,

    // Error
    setError,

    // Derived
    getStagedFiles,
    getModifiedFiles,
    getUntrackedFiles,
    hasChanges,
    getStatusSummary,
  }
}

// Global store instance
export const gitStore = createGitStore()
