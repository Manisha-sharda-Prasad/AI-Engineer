import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'

import DismissibleError from '../components/DismissibleError'
import { CloseIcon, WorkspaceIcon } from '../components/Icons'
import { loadPublicPlanDetail } from '../store/publicPlansSlice'

function duration(value) {
  if (!Number.isFinite(value) || value <= 0) return ''
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = Math.floor(value % 60)
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function PublicBrand({ item, fallback }) {
  const source = item?.logo_url || item?.logo
  return source ? <img src={source} alt=""/> : <span>{(fallback || '?').charAt(0).toUpperCase()}</span>
}

function youtubeVideoId(video) {
  const directId = String(video?.video_id || '').trim()
  if (/^[\w-]{11}$/.test(directId)) return directId
  try {
    const url = new URL(video?.url || '')
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || ''
    if (url.hostname.includes('youtube.com')) {
      return url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] || ''
    }
  } catch {
    return ''
  }
  return ''
}

function PublicCourseReader({ plan, course, shareId, navigate }) {
  const modules = React.useMemo(() => course.modules || [], [course])
  const [activeVideo, setActiveVideo] = React.useState(null)
  const [expandedModules, setExpandedModules] = React.useState({})
  const [search, setSearch] = React.useState('')
  const [showOutline, setShowOutline] = React.useState(false)
  const outlineTreeRef = React.useRef(null)
  const activeVideoRowRef = React.useRef(null)

  React.useEffect(() => {
    const firstModule = modules.find(module => module.videos?.length)
    setActiveVideo(firstModule?.videos?.[0] || null)
    setExpandedModules(firstModule ? { [firstModule.id]: true } : {})
    setSearch('')
    setShowOutline(false)
  }, [course.id, modules])

  const normalizedSearch = search.trim().toLowerCase()
  const visibleModules = modules.reduce((items, module) => {
    if (!normalizedSearch) return [...items, module]
    const moduleMatches = `${module.title || ''} ${module.description || ''}`.toLowerCase().includes(normalizedSearch)
    const matchingVideos = (module.videos || []).filter(video =>
      video.video_id === activeVideo?.video_id ||
      `${video.revised_title_from_ai || video.title || ''} ${video.description || ''}`.toLowerCase().includes(normalizedSearch),
    )
    const activeModuleVideo = (module.videos || []).find(video => video.video_id === activeVideo?.video_id)
    if (!moduleMatches && !matchingVideos.length && !activeModuleVideo) return items
    return [...items, { ...module, videos: moduleMatches ? module.videos : matchingVideos }]
  }, [])
  const allExpanded = modules.length > 0 && modules.every(module => expandedModules[module.id])
  const activeYoutubeId = youtubeVideoId(activeVideo)
  const activeTitle = activeVideo?.revised_title_from_ai || activeVideo?.title
  const activeModule = modules.find(module => module.videos?.some(video => video.video_id === activeVideo?.video_id))

  React.useEffect(() => {
    if (!showOutline || !activeModule?.id) return
    setExpandedModules(current => current[activeModule.id] ? current : { ...current, [activeModule.id]: true })
  }, [activeModule?.id, showOutline])

  React.useEffect(() => {
    if (!showOutline || !expandedModules[activeModule?.id]) return undefined
    const animationFrame = window.requestAnimationFrame(() => {
      const tree = outlineTreeRef.current
      const row = activeVideoRowRef.current
      if (!tree || !row) return
      const treeBounds = tree.getBoundingClientRect()
      const rowBounds = row.getBoundingClientRect()
      const top = tree.scrollTop + rowBounds.top - treeBounds.top - Math.max(0, (tree.clientHeight - rowBounds.height) / 2)
      tree.scrollTo({ top: Math.max(0, top) })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [activeModule?.id, activeVideo?.video_id, expandedModules, showOutline])

  const toggleAll = () => {
    setExpandedModules(allExpanded ? {} : Object.fromEntries(modules.map(module => [module.id, true])))
  }

  return <>
    <nav className="public-course-breadcrumb"><button type="button" onClick={() => navigate(`/public/plans/${shareId}`)}>← {plan.name}</button><span>/</span><strong>{course.title}</strong></nav>
    <section className="public-course-hero"><span className="public-course-brand"><PublicBrand item={course} fallback={course.title}/></span><div><small>Read-only course</small><h1>{course.title}</h1><p>{course.description || 'Browse the modules and learning resources in this course.'}</p></div><button type="button" className="public-course-outline-trigger" aria-label="Open course outline" aria-expanded={showOutline} onClick={() => setShowOutline(true)}><WorkspaceIcon name="outline" /></button></section>
    <div className="public-course-workspace">
      <section className="public-video-stage" aria-live="polite">
        <div className={`public-video-frame ${activeYoutubeId ? 'has-active-video' : ''}`}>
          {activeYoutubeId ? <iframe
            key={activeYoutubeId}
            src={`https://www.youtube.com/embed/${encodeURIComponent(activeYoutubeId)}?rel=0`}
            title={activeTitle || 'Course video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          /> : <div className="public-video-placeholder"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/></svg><strong>{activeVideo ? 'Preview unavailable' : 'Select a video'}</strong><p>{activeVideo ? 'This resource cannot be embedded, but you can open it in a new tab.' : 'Choose a video from the course outline.'}</p>{activeVideo?.url && <a href={activeVideo.url} target="_blank" rel="noreferrer">Open resource ↗</a>}</div>}
        </div>
        {activeVideo && <div className="public-active-video-info"><span>{activeModule?.title || 'Course video'}</span><h2>{activeTitle}</h2>{activeVideo.description && <p>{activeVideo.description}</p>}{activeVideo.url && <a href={activeVideo.url} target="_blank" rel="noreferrer">Open on YouTube ↗</a>}</div>}
      </section>
      {showOutline && <button type="button" className="public-course-outline-overlay" aria-label="Close course outline" onClick={() => setShowOutline(false)} />}
      <aside className={`public-course-outline ${showOutline ? 'mobile-open' : ''}`} aria-label="Course modules and videos">
        <header><div><small>Course outline</small><strong>{course.title}</strong></div><b>{modules.length} modules</b><button type="button" className="public-course-outline-close" aria-label="Close course outline" onClick={() => setShowOutline(false)}><CloseIcon /></button></header>
        <div className="public-outline-toolbar">
          <label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search modules or videos..." aria-label="Search modules or videos"/></label>
          <button type="button" onClick={toggleAll} title={allExpanded ? 'Collapse all modules' : 'Expand all modules'} aria-label={allExpanded ? 'Collapse all modules' : 'Expand all modules'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={allExpanded ? 'm7 9 5 5 5-5M7 4l5 5 5-5' : 'm7 15 5-5 5 5m-10 5 5-5 5 5'}/></svg></button>
        </div>
        <div className="public-outline-tree" ref={outlineTreeRef}>
          {visibleModules.map((module, moduleIndex) => {
            const expanded = Boolean(expandedModules[module.id]) || Boolean(normalizedSearch)
            return <section className={`public-outline-module ${expanded ? 'expanded' : ''}`} key={module.id}>
              <button type="button" className="public-outline-module-trigger" onClick={() => setExpandedModules(current => ({ ...current, [module.id]: !current[module.id] }))} aria-expanded={expanded}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
                <span><small>Module {module.sequence || moduleIndex + 1}</small><strong>{module.title}</strong></span>
                <b>{module.videos?.length || 0}</b>
              </button>
              {expanded && <div className="public-outline-videos">{(module.videos || []).map((video, videoIndex) => <button type="button" key={video.video_id || `${module.id}-${videoIndex}`} ref={activeVideo?.video_id === video.video_id ? activeVideoRowRef : null} className={activeVideo?.video_id === video.video_id ? 'active' : ''} onClick={() => { setActiveVideo(video); setShowOutline(false) }}>
                <span className="public-outline-thumbnail">{video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy"/> : <i>▶</i>}{duration(video.duration_secs) && <small>{duration(video.duration_secs)}</small>}</span>
                <span><strong>{video.sequence || videoIndex + 1}. {video.revised_title_from_ai || video.title}</strong><small>{video.published_at ? new Date(video.published_at).toLocaleDateString() : 'Video'}</small></span>
              </button>)}</div>}
            </section>
          })}
          {!visibleModules.length && <p className="public-outline-empty">No modules or videos match “{search}”.</p>}
        </div>
      </aside>
    </div>
  </>
}

export default function PublicPlan() {
  const { shareId, courseId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const detail = useSelector(state => state.publicPlans.details[shareId])
  const plan = detail?.data || null
  const loading = !plan && (!detail || ['idle', 'loading'].includes(detail.status))
  const error = detail?.error || ''

  React.useEffect(() => {
    dispatch(loadPublicPlanDetail(shareId))
  }, [dispatch, shareId])

  if (loading) return <div className="public-plan-status"><span className="spinner"/> Loading published learning plan…</div>
  if (error || !plan) return <div className="public-plan-status is-error"><DismissibleError message={error || 'Published plan not found.'}/><button className="btn btn-secondary" onClick={() => navigate('/public/plans')}>Browse public plans</button></div>

  const courses = plan.courses || []
  const course = courseId ? courses.find(item => item.id === courseId) : null
  const moduleCount = courses.reduce((count, item) => count + (item.modules?.length || 0), 0)
  const videoCount = courses.reduce((count, item) => count + (item.modules || []).reduce((total, module) => total + (module.videos?.length || 0), 0), 0)

  return <div className="public-plan-page">
    <main className={`public-plan-content ${course ? 'is-course-reader' : ''}`}>
      {!course ? <>
        <section className="public-plan-hero"><button type="button" className="public-plan-back-link" onClick={() => navigate('/public/plans')}>← All public plans</button><div className="public-plan-brand"><PublicBrand item={plan} fallback={plan.name}/></div><div><span>Published curriculum</span><h1>{plan.name}</h1><p>{plan.description || 'A public learning plan.'}</p><div className="public-plan-stats"><b>{courses.length}<small>Courses</small></b><b>{moduleCount}<small>Modules</small></b><b>{videoCount}<small>Videos</small></b></div></div></section>
        <section className="public-course-grid" aria-label="Courses">{courses.map(item => { const videos = (item.modules || []).reduce((count, module) => count + (module.videos?.length || 0), 0); return <button type="button" key={item.id} onClick={() => navigate(`/public/plans/${shareId}/courses/${item.id}`)}><span className="public-course-brand"><PublicBrand item={item} fallback={item.title}/></span><span><small>Course {item.sequence || ''}</small><strong>{item.title}</strong><p>{item.description || 'Open this course to browse its modules and videos.'}</p><em>{item.modules?.length || 0} modules · {videos} videos</em></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button> })}</section>
      </> : <PublicCourseReader plan={plan} course={course} shareId={shareId} navigate={navigate}/>} 
    </main>
  </div>
}
