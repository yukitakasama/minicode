import { api } from './client'

type DirEntry = {
  name: string
  path: string
  isDirectory: boolean
  relativePath?: string
}

export type FileSearchMode = 'exact' | 'fuzzy' | 'auto'

type BrowseResult = {
  currentPath: string
  parentPath: string
  entries: DirEntry[]
  query?: string
  searchMode?: FileSearchMode
}

export const filesystemApi = {
  browse(path?: string, options?: { includeFiles?: boolean }) {
    const q = new URLSearchParams()
    if (path) q.set('path', path)
    if (options?.includeFiles) q.set('includeFiles', 'true')
    const qs = q.toString()
    return api.get<BrowseResult>(`/api/filesystem/browse${qs ? `?${qs}` : ''}`)
  },

  search(query: string, cwd?: string, options?: { searchMode?: FileSearchMode }) {
    const q = new URLSearchParams({ search: query, maxResults: '200', includeFiles: 'true' })
    if (cwd) q.set('path', cwd)
    q.set('searchMode', options?.searchMode ?? 'auto')
    return api.get<BrowseResult>(`/api/filesystem/browse?${q}`)
  },
}
