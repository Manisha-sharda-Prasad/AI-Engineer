import React from 'react'
import { CloseIcon, LabelIcon } from './Icons'

export const ALL_BOOKMARK_TYPES = [
  ['all', 'All'],
  ['course', 'Courses'],
  ['module', 'Modules'],
  ['video', 'Videos'],
]

export const COURSE_BOOKMARK_TYPES = [
  ['all', 'All'],
  ['module', 'Modules'],
  ['video', 'Videos'],
]

export function collectBookmarkItems(plans, { courseId = null, includeCourses = true } = {}) {
  return (plans || []).flatMap(plan => (plan?.courses || [])
    .filter(course => !courseId || course.id === courseId)
    .flatMap(course => {
      const courseItems = includeCourses && course.labels?.includes('bookmarked')
        ? [{ type: 'course', title: course.title, plan, course }]
        : []
      const contentItems = (course.modules || []).flatMap(module => {
        const moduleItems = module.labels?.includes('bookmarked')
          ? [{ type: 'module', title: module.title, plan, course, module }]
          : []
        const videoItems = (module.videos || [])
          .filter(video => video.labels?.includes('bookmarked'))
          .map(video => ({ type: 'video', title: video.title, plan, course, module, video }))
        return [...moduleItems, ...videoItems]
      })
      return [...courseItems, ...contentItems]
    }))
}

export default function WorkspaceBookmarksDrawer({
  items,
  query,
  onQueryChange,
  type,
  onTypeChange,
  onOpen,
  onClose,
  types = ALL_BOOKMARK_TYPES,
  description = 'Jump directly to saved courses, modules, and videos.',
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const visibleItems = items.filter(item => (type === 'all' || item.type === type)
    && (!normalizedQuery || `${item.title} ${item.plan.name} ${item.course.title} ${item.module?.title || ''}`.toLowerCase().includes(normalizedQuery)))
  const groups = visibleItems.reduce((result, item) => {
    const group = result.find(entry => entry.plan.id === item.plan.id)
    if (group) group.items.push(item)
    else result.push({ plan: item.plan, items: [item] })
    return result
  }, [])
  const count = value => value === 'all' ? items.length : items.filter(item => item.type === value).length

  return <><div className="drawer-overlay workspace-bookmarks-overlay" onClick={onClose}/><aside className="drawer workspace-bookmarks-drawer" role="dialog" aria-modal="true" aria-labelledby="workspace-bookmarks-title">
    <header className="drawer-header workspace-bookmarks-header"><div><span><LabelIcon label="bookmarked"/></span><div><small>Learning navigator</small><h2 id="workspace-bookmarks-title">Bookmarks</h2><p>{description}</p></div></div><button type="button" className="btn btn-secondary btn-sm icon-button" onClick={onClose} aria-label="Close bookmarks"><CloseIcon/></button></header>
    <div className="workspace-bookmarks-toolbar">
      <label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search bookmarks..." aria-label="Search bookmarks"/></label>
      <div className="workspace-bookmark-tabs" style={{ '--bookmark-tab-count': types.length }} role="tablist" aria-label="Bookmark type">{types.map(([value, label]) => <button type="button" role="tab" aria-selected={type === value} className={type === value ? 'active' : ''} key={value} onClick={() => onTypeChange(value)}><span>{label}</span><small>{count(value)}</small></button>)}</div>
    </div>
    <div className="drawer-body workspace-bookmarks-body">{groups.map(group => <section className="workspace-bookmark-group" key={group.plan.id}><header><span>{group.plan.logo_url || group.plan.logo ? <img src={group.plan.logo_url || group.plan.logo} alt=""/> : group.plan.name?.charAt(0)?.toUpperCase()}</span><div><small>Learning plan</small><strong>{group.plan.name}</strong></div><em>{group.items.length}</em></header><div>{group.items.map(item => <button type="button" className={`workspace-bookmark-result is-${item.type}`} key={`${item.type}:${item.course.id}:${item.module?.id || ''}:${item.video?.video_id || ''}`} onClick={() => onOpen(item)}><span className="workspace-bookmark-type-icon"><LabelIcon label="bookmarked"/></span><span className="workspace-bookmark-copy"><small>{item.type}</small><strong>{item.title}</strong><span>{item.type === 'course' ? group.plan.name : item.type === 'module' ? item.course.title : `${item.course.title} / ${item.module.title}`}</span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>)}</div></section>)}{!visibleItems.length && <div className="workspace-bookmarks-empty"><span><LabelIcon label="bookmarked"/></span><strong>{items.length ? 'No bookmarks match' : 'No bookmarks yet'}</strong><p>{items.length ? 'Try another search or bookmark type.' : 'Bookmark an item and it will appear here.'}</p></div>}</div>
  </aside></>
}
