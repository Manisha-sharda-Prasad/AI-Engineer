import { NOTE_INDEX_CACHE_MS, NOTE_REPOSITORIES } from '../config/noteRepositories'

const memoryCache = new Map()
const CACHE_PREFIX = 'learning-notes-index:v1:'

function repositoryById(repositoryId) {
  const repository = NOTE_REPOSITORIES.find(item => item.id === repositoryId)
  if (!repository) throw new Error('Notes repository is not configured.')
  return repository
}

function cacheKey(repository) {
  return `${CACHE_PREFIX}${repository.id}:${repository.branch}:${repository.path}`
}

function readCache(repository) {
  const key = cacheKey(repository)
  const memory = memoryCache.get(key)
  if (memory && Date.now() - memory.cachedAt < NOTE_INDEX_CACHE_MS) return memory.data
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null')
    if (stored && Date.now() - stored.cachedAt < NOTE_INDEX_CACHE_MS) {
      memoryCache.set(key, stored)
      return stored.data
    }
  } catch {
    // Storage may be unavailable or contain an older invalid value.
  }
  return null
}

function writeCache(repository, data) {
  const entry = { cachedAt: Date.now(), data }
  const key = cacheKey(repository)
  memoryCache.set(key, entry)
  try { localStorage.setItem(key, JSON.stringify(entry)) } catch { /* Memory cache remains available. */ }
}

function displayTitle(path) {
  const filename = path.split('/').at(-1).replace(/\.(md|markdown)$/i, '')
  return filename.replace(/^\d+[_. -]*/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) || filename
}

function publicRepository(repository, noteCount) {
  return {
    ...repository,
    root_path: repository.path,
    note_count: noteCount,
    repository_url: `https://github.com/${repository.owner}/${repository.repo}`,
  }
}

function rawUrl(repository, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${encodeURIComponent(repository.branch)}/${encodedPath}`
}

export async function getNotes(repositoryId) {
  const repository = repositoryById(repositoryId)
  const cached = readCache(repository)
  if (cached) return cached

  const treeUrl = `https://api.github.com/repos/${repository.owner}/${repository.repo}/git/trees/${encodeURIComponent(repository.branch)}?recursive=1`
  const response = await fetch(treeUrl)
  if (!response.ok) throw new Error(`GitHub could not load ${repository.name} (HTTP ${response.status}).`)
  const payload = await response.json()
  if (payload.truncated) throw new Error(`${repository.name} is too large for GitHub to list completely.`)

  const prefix = repository.path.replace(/^\/+|\/+$/g, '')
  const notes = (payload.tree || []).filter(item => {
    const path = item.path || ''
    const filename = path.split('/').at(-1).replace(/\.(md|markdown)$/i, '')
    return item.type === 'blob'
      && path.startsWith(`${prefix}/`)
      && /\.(md|markdown)$/i.test(path)
      && !filename.toLowerCase().endsWith('__x')
  }).map(item => ({
    path: item.path,
    title: displayTitle(item.path),
    folder: item.path.split('/').slice(0, -1).join('/'),
    size: item.size || 0,
    sha: item.sha || '',
    github_url: `https://github.com/${repository.owner}/${repository.repo}/blob/${repository.branch}/${item.path}`,
  })).sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }))

  const result = { ...publicRepository(repository, notes.length), notes }
  writeCache(repository, result)
  return result
}

export async function getNoteRepositories() {
  const results = await Promise.allSettled(NOTE_REPOSITORIES.map(repository => getNotes(repository.id)))
  return {
    repositories: results.map((result, index) => result.status === 'fulfilled'
      ? publicRepository(NOTE_REPOSITORIES[index], result.value.notes.length)
      : { ...publicRepository(NOTE_REPOSITORIES[index], 0), error: result.reason?.message || 'Unable to load repository.' }),
  }
}

export async function getNoteContent(repositoryId, path) {
  const repository = repositoryById(repositoryId)
  const index = await getNotes(repositoryId)
  const selected = index.notes.find(note => note.path === path)
  if (!selected) throw new Error('Markdown note was not found in the configured docs directory.')

  const url = rawUrl(repository, path)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GitHub could not load this note (HTTP ${response.status}).`)
  return {
    repository_id: repositoryId,
    path,
    title: selected.title,
    content: await response.text(),
    raw_url: url,
    github_url: selected.github_url,
  }
}
