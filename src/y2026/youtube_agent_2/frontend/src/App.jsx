import React from 'react'
import { Provider, useDispatch, useSelector } from 'react-redux'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { store } from './store'
import './App.css'
import Plans from './pages/Plans'
import Dashboard from './pages/Dashboard'
import PlanOverview from './pages/PlanOverview'
import CourseOverview from './pages/CourseOverview'
import CourseWorkspace from './pages/CourseWorkspace'
import Profile from './pages/Profile'
import AiRequests from './pages/AiRequests'
import Notes from './pages/Notes'
import PublicPlan from './pages/PublicPlan'
import PublicPlans from './pages/PublicPlans'
import { CloseIcon, WorkspaceIcon } from './components/Icons'
import SourceFeedPreviewDialog from './components/SourceFeedPreviewDialog'
import AiModelConfigDrawer from './components/AiModelConfigDrawer'
import DismissibleError from './components/DismissibleError'
import LoadingBar from './components/LoadingBar'
import { confirmSourceFeedOrganization, createPlan, getPlans, getSourceSyncMetadata, organizeNewSourceFeeds, pushNewSourceFeeds, setAccessTokenProvider, setApiStatusListener, syncSourceMetadata } from './api/client'
import { addPlan, applyPendingPlanProgress, setPlans } from './store/plansSlice'
import { setSourceSyncMetadata } from './store/sourcesSlice'
import { loadAiModels } from './store/aiModelsSlice'
import { endPrivateSyncSession, setApiAvailability, setNetworkOnline, startPrivateSyncSession } from './store/privatePlanSyncSlice'
import { loadPrivatePlanCache, savePrivatePlanCache } from './utils/privatePlanCache'
import { firebaseAuth } from './firebase'
import appLogo from '../app-logo.png'

const AI_ENABLED = import.meta.env.VITE_ENABLE_AI === 'true'

function useTheme() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('yt_theme') || 'light')

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('yt_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(current => current === 'light' ? 'dark' : 'light')

  return { theme, setTheme, toggleTheme }
}

function useFontSize() {
  const [fontSize, setFontSize] = React.useState(() => localStorage.getItem('yt_font_size') || 'medium')

  React.useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
    localStorage.setItem('yt_font_size', fontSize)
  }, [fontSize])

  return { fontSize, setFontSize }
}

function ThemeIcon({ theme }) {
  if (theme === 'dark') return <svg viewBox="0 0 24 24"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg>
  if (theme === 'pale') return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></svg>
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 1v3m0 16v3M1 12h3m16 0h3" /></svg>
}

function SourceInboxIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 14h5l1.5 2h3L15 14h5M12 3v8m0 0-3-3m3 3 3-3" /></svg>
}

function AiModelConfigIcon() {
  return <svg className="ai-model-config-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3M9 12h6M12 9v6"/><circle cx="18.5" cy="5.5" r="2.2"/></svg>
}

function LearningNotesIcon() {
  return <svg className="learning-notes-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="learning-notes-nav-gradient" x1="4" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8b5cf6" />
        <stop offset="0.52" stopColor="#ec4899" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <path className="notes-icon-pages" d="M3.75 5.6c2.75-.95 5.5-.45 8.25 1.48 2.75-1.93 5.5-2.43 8.25-1.48v13.1c-2.75-.8-5.5-.25-8.25 1.65-2.75-1.9-5.5-2.45-8.25-1.65V5.6Z" />
    <path className="notes-icon-fold" d="M12 7.08v13.27M6.5 9.1c1.3-.2 2.4.05 3.4.65M6.5 12.15c1.3-.2 2.4.05 3.4.65M14.1 11.2c1-.6 2.1-.85 3.4-.65M14.1 14.25c1-.6 2.1-.85 3.4-.65" />
    <path className="notes-icon-spark" d="m18.35 2.4.43 1.18 1.18.43-1.18.43-.43 1.18-.43-1.18-1.18-.43 1.18-.43.43-1.18Z" />
  </svg>
}

function PublicPlansIcon() {
  return <svg className="public-plans-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 4.5h10A3.5 3.5 0 0 1 18 8v11H6.5a2 2 0 0 1-2-2V4.5Zm2 0V17a2 2 0 0 0-2-2" />
    <circle cx="15.5" cy="11.5" r="5" />
    <path d="M10.8 10h9.4m-9.4 3h9.4M15.5 6.5c1.2 1.3 1.8 3 1.8 5s-.6 3.7-1.8 5m0-10c-1.2 1.3-1.8 3-1.8 5s.6 3.7 1.8 5" />
  </svg>
}

function formatRelativeAge(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  const units = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (elapsedSeconds >= seconds) {
      const count = Math.floor(elapsedSeconds / seconds)
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

function PlansRoute({ newPlanRequest, onRefresh, refreshing, auth, authResolved }) {
  const plans = useSelector(state => state.plans.items)
  const lastLocation = useSelector(state => state.learningUi.currentLocation)
  const lastPlanId = lastLocation.planId
  const targetPlan = plans.find(plan => plan.id === lastPlanId) || plans[0]
  const targetCourse = targetPlan?.courses?.find(course => course.id === lastLocation.courseId)

  if (lastPlanId === 'all' && plans.length) {
    return <Navigate to="/plans/all" replace />
  }
  if (targetPlan && targetCourse) {
    return <Navigate to={`/plans/${targetPlan.id}/courses/${targetCourse.id}/learn`} replace />
  }
  if (targetPlan) return <Navigate to={`/plans/${targetPlan.id}`} replace />
  return <Plans newPlanRequest={newPlanRequest} onRefresh={onRefresh} refreshing={refreshing} auth={auth} authResolved={authResolved} />
}

const GLOBAL_SEARCH_SCOPE_OPTIONS = [
  { id: 'all', label: 'ALL' },
  { id: 'plan', label: 'Plan' },
  { id: 'course', label: 'Course' },
  { id: 'module', label: 'Module' },
  { id: 'videos', label: 'Videos' },
]

function includesSearchText(values, query) {
  return values.filter(Boolean).join(' ').toLowerCase().includes(query)
}

function GlobalSearchDrawer({ plans, onClose, onNavigate }) {
  const [query, setQuery] = React.useState('')
  const [scopes, setScopes] = React.useState(['all'])
  const [expandedPlans, setExpandedPlans] = React.useState({})
  const [expandedCourses, setExpandedCourses] = React.useState({})
  const normalizedQuery = query.trim().toLowerCase()
  const searches = scope => scopes.includes('all') || scopes.includes(scope)

  const toggleScope = scope => {
    if (scope === 'all') {
      setScopes(['all'])
      return
    }
    setScopes(current => {
      const selected = current.includes('all') ? [] : current
      const next = selected.includes(scope)
        ? selected.filter(item => item !== scope)
        : [...selected, scope]
      return next.length ? next : ['all']
    })
  }

  const results = plans.map(plan => {
    const planMatches = Boolean(
      normalizedQuery &&
      searches('plan') &&
      includesSearchText([plan.name, plan.description], normalizedQuery),
    )
    const courses = [...(plan.courses || [])]
      .sort((left, right) => (left.sequence || 0) - (right.sequence || 0))
      .map(course => {
        const courseMatches = Boolean(
          normalizedQuery &&
          searches('course') &&
          includesSearchText([course.title, course.description], normalizedQuery),
        )
        const modules = [...(course.modules || [])]
          .sort((left, right) => (left.sequence || 0) - (right.sequence || 0))
          .map(module => {
            const moduleMatches = Boolean(
              normalizedQuery &&
              searches('module') &&
              includesSearchText([module.title, module.description], normalizedQuery),
            )
            const videos = [...(module.videos || [])]
              .sort((left, right) => (left.sequence || 0) - (right.sequence || 0))
              .filter(video =>
                !normalizedQuery ||
                (
                  searches('videos') &&
                  includesSearchText([video.title, video.description], normalizedQuery)
                ),
              )
            return {
              ...module,
              _matches: moduleMatches,
              _videos: videos,
              _hasDescendantMatch: Boolean(normalizedQuery && videos.length),
            }
          })
          .filter(module =>
            !normalizedQuery || module._matches || module._hasDescendantMatch,
          )
        return {
          ...course,
          _matches: courseMatches,
          _modules: modules,
          _hasDescendantMatch: Boolean(normalizedQuery && modules.length),
        }
      })
      .filter(course =>
        !normalizedQuery || course._matches || course._hasDescendantMatch,
      )
    return {
      ...plan,
      _matches: planMatches,
      _courses: courses,
      _hasDescendantMatch: Boolean(normalizedQuery && courses.length),
    }
  }).filter(plan =>
    !normalizedQuery || plan._matches || plan._hasDescendantMatch,
  )

  const allExpanded =
    plans.length > 0 && plans.every(plan => expandedPlans[plan.id])
  const toggleAllPlans = () => {
    setExpandedPlans(
      allExpanded ? {} : Object.fromEntries(plans.map(plan => [plan.id, true])),
    )
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer quick-plan-drawer" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
        <div className="drawer-header">
          <div>
            <h2 id="global-search-title">Global search</h2>
            <p>Find learning plans, courses, modules, and videos.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">
          <div className="quick-plan-search-controls">
            <div className="quick-plan-search-toolbar">
              <label className="quick-plan-global-search-field">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m15.5 15.5 5 5" />
                </svg>
                <input
                  className="quick-plan-global-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search titles and descriptions..."
                  aria-label="Search learning content"
                />
              </label>
              <button
                type="button"
                className="quick-plan-tree-button"
                title={`${allExpanded ? 'Collapse' : 'Expand'} all learning plans`}
                aria-label={`${allExpanded ? 'Collapse' : 'Expand'} all learning plans`}
                onClick={toggleAllPlans}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={allExpanded ? 'm7 9 5 5 5-5' : 'm9 6 6 6-6 6'} />
                </svg>
              </button>
            </div>
            <div className="quick-plan-search-scope" role="group" aria-label="Search scope">
              <span>Search scope</span>
              <div>
                {GLOBAL_SEARCH_SCOPE_OPTIONS.map(scope => {
                  const selected = scopes.includes(scope.id)
                  return (
                    <button
                      type="button"
                      key={scope.id}
                      className={selected ? 'active' : ''}
                      aria-pressed={selected}
                      onClick={() => toggleScope(scope.id)}
                    >
                      {scope.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {normalizedQuery && (
              <p className="quick-plan-result-count">
                {results.length} matching learning plan{results.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <div className="quick-plan-list">
            {results.length ? results.map(plan => {
              const planSearchExpanded = normalizedQuery && plan._hasDescendantMatch
              const isExpanded = planSearchExpanded || Boolean(expandedPlans[plan.id])
              const logo = plan.logo_url || plan.logo
              return (
                <section className={`quick-plan-accordion ${plan._matches ? 'search-match' : ''}`} key={plan.id}>
                  <div className="quick-plan-row">
                    <button
                      className="quick-plan-item"
                      onClick={() => {
                        onNavigate(`/plans/${plan.id}`)
                        onClose()
                      }}
                    >
                      <span className="quick-plan-logo-wrap">
                        {logo
                          ? <img className="quick-plan-logo" src={logo} alt="" />
                          : <span className="quick-plan-logo quick-plan-logo-fallback">{plan.name?.charAt(0).toUpperCase() || '?'}</span>}
                      </span>
                      <span className="quick-plan-item-copy">
                        <strong>{plan.name}</strong>
                        <span>{plan.courses?.length || 0} courses</span>
                      </span>
                    </button>
                    <button
                      className={`quick-plan-expand ${isExpanded ? 'expanded' : ''}`}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${plan.name}`}
                      title={isExpanded ? 'Collapse courses' : 'Expand courses'}
                      onClick={() =>
                        setExpandedPlans(current => ({
                          ...current,
                          [plan.id]: !isExpanded,
                        }))
                      }
                    >
                      <span>›</span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="quick-course-list">
                      {plan._courses.length ? plan._courses.map(course => {
                        const courseKey = `${plan.id}:${course.id}`
                        const courseSearchExpanded =
                          normalizedQuery && course._hasDescendantMatch
                        const courseExpanded =
                          courseSearchExpanded || Boolean(expandedCourses[courseKey])
                        return (
                          <section className={`quick-course-accordion ${course._matches ? 'search-match' : ''}`} key={course.id}>
                            <div className="quick-course-row">
                              <button
                                className="quick-course-item"
                                onClick={() => {
                                  onNavigate(`/plans/${plan.id}/courses/${course.id}/learn`)
                                  onClose()
                                }}
                              >
                                <span>{course.sequence || '—'}</span>
                                <div>
                                  <strong>{course.title}</strong>
                                  {course.description && <small>{course.description}</small>}
                                </div>
                              </button>
                              <button
                                className={`quick-course-expand ${courseExpanded ? 'expanded' : ''}`}
                                onClick={() =>
                                  setExpandedCourses(current => ({
                                    ...current,
                                    [courseKey]: !courseExpanded,
                                  }))
                                }
                                title={courseExpanded ? 'Collapse modules' : 'Expand modules'}
                                aria-label={`${courseExpanded ? 'Collapse' : 'Expand'} ${course.title} modules`}
                              >
                                <span>›</span>
                              </button>
                            </div>
                            {courseExpanded && (
                              <div className="quick-module-list">
                                {course._modules.length ? course._modules.map(module => (
                                  <section className={`quick-module-result ${module._matches ? 'search-match' : ''}`} key={module.id}>
                                    <div>
                                      <span>{module.sequence || '—'}</span>
                                      <span>
                                        <strong>{module.title}</strong>
                                        {module.description && <small>{module.description}</small>}
                                      </span>
                                    </div>
                                    {module._videos.length > 0 && normalizedQuery && searches('videos') && (
                                      <div className="quick-video-results">
                                        {module._videos.map(video => (
                                          <button
                                            type="button"
                                            key={video.id || video.video_id}
                                            onClick={() => {
                                              onNavigate(`/plans/${plan.id}/courses/${course.id}/learn`)
                                              onClose()
                                            }}
                                          >
                                            <span>{video.sequence || '•'}</span>
                                            <span>
                                              <strong>{video.title}</strong>
                                              {video.description && <small>{video.description}</small>}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </section>
                                )) : <p>No modules match this search.</p>}
                              </div>
                            )}
                          </section>
                        )
                      }) : <p>No courses match this search.</p>}
                    </div>
                  )}
                </section>
              )
            }) : (
              <div className="quick-plan-no-results">
                <strong>No matching learning content</strong>
                <p>Try another phrase or broaden the selected search scopes.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

function AppLayout() {
  const { theme, setTheme } = useTheme()
  const { fontSize, setFontSize } = useFontSize()
  const dispatch = useDispatch()
  const plans = useSelector(state => state.plans.items)
  const syncMetadata = useSelector(state => state.sources.syncMetadata)
  const privatePlanSync = useSelector(state => state.privatePlanSync)
  const [auth, setAuth] = React.useState(null)
  const [authResolved, setAuthResolved] = React.useState(() => !firebaseAuth)
  const [showCreatePlanDrawer, setShowCreatePlanDrawer] = React.useState(false)
  const [createPlanForm, setCreatePlanForm] = React.useState({ name: '', description: '', logoUrl: 'https://skillicons.dev/icons?i=' })
  const [createPlanError, setCreatePlanError] = React.useState('')
  const [creatingPlan, setCreatingPlan] = React.useState(false)
  const [plansLoading, setPlansLoading] = React.useState(false)
  const [sourcePullingChannelIds, setSourcePullingChannelIds] = React.useState({})
  const [sourcePushLoading, setSourcePushLoading] = React.useState(false)
  const [sourceAiLoading, setSourceAiLoading] = React.useState(false)
  const [sourceSyncError, setSourceSyncError] = React.useState('')
  const [sourceMetadataLoaded, setSourceMetadataLoaded] = React.useState(false)
  const [sourceSyncBootstrapping, setSourceSyncBootstrapping] = React.useState(false)
  const [sourceSyncChannelErrors, setSourceSyncChannelErrors] = React.useState({})
  const [showSourceSyncDrawer, setShowSourceSyncDrawer] = React.useState(false)
  const [sourceSyncSearch, setSourceSyncSearch] = React.useState('')
  const [sourceSyncSort, setSourceSyncSort] = React.useState('name')
  const [sourceSyncFilter, setSourceSyncFilter] = React.useState('all')
  const [sourceSyncTargetsOnly, setSourceSyncTargetsOnly] = React.useState(true)
  const [sourcePreview, setSourcePreview] = React.useState(null)
  const [sourcePreviewError, setSourcePreviewError] = React.useState('')
  const [expandedSyncChannels, setExpandedSyncChannels] = React.useState({})
  const [showPlanSwitcher, setShowPlanSwitcher] = React.useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = React.useState(false)
  const [showAiModelDrawer, setShowAiModelDrawer] = React.useState(false)
  const [showMobileNav, setShowMobileNav] = React.useState(false)
  const sourceBootstrapUserRef = React.useRef(null)
  const privateCacheUserRef = React.useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const profileOpen = location.pathname === '/profile'
  const profileBackgroundLocation = location.state?.profileBackgroundLocation
  const routedLocation = profileOpen
    ? (profileBackgroundLocation || { pathname: '/', search: '', hash: '', state: null, key: 'profile-background' })
    : location

  React.useEffect(() => {
    if (window.matchMedia('(max-width: 900px)').matches) setShowMobileNav(false)
  }, [location.pathname])

  React.useEffect(() => {
    if (!showMobileNav) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape') setShowMobileNav(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [showMobileNav])

  const closeNavigationAfterAction = event => {
    if (!event.target.closest('button')) return
    if (window.matchMedia('(max-width: 900px)').matches) setShowMobileNav(false)
  }

  const openProfile = () => {
    if (profileOpen) return
    navigate('/profile', { state: { profileBackgroundLocation: location } })
  }

  const closeProfile = () => {
    if (profileBackgroundLocation) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  }

  const loadPlans = React.useCallback(async () => {
    setPlansLoading(true)
    try {
      const data = await getPlans()
      const loadedPlans = Array.isArray(data) ? data : data.plans || []
      dispatch(setPlans(loadedPlans))
      const pendingByPlan = store.getState().privatePlanSync.pendingByPlan
      Object.entries(pendingByPlan).forEach(([planId, pending]) => {
        dispatch(applyPendingPlanProgress({ planId, videos: pending.videos }))
      })
    } catch (error) {
      console.error('Unable to load learning plans:', error)
    } finally {
      setPlansLoading(false)
    }
  }, [dispatch])

  const closeCreatePlanDrawer = () => {
    setShowCreatePlanDrawer(false)
    setCreatePlanForm({ name: '', description: '', logoUrl: 'https://skillicons.dev/icons?i=' })
    setCreatePlanError('')
  }

  const submitNewPlan = async () => {
    if (!createPlanForm.name.trim()) {
      setCreatePlanError('Plan name is required')
      return
    }
    setCreatingPlan(true)
    setCreatePlanError('')
    try {
      const response = await createPlan({
        name: createPlanForm.name.trim(),
        description: createPlanForm.description.trim() || null,
        logo_url: createPlanForm.logoUrl.trim(),
        courses: [],
      })
      dispatch(addPlan(response.plan))
      closeCreatePlanDrawer()
      navigate(`/plans/${response.plan.id}`)
    } catch (error) {
      setCreatePlanError(error.message || 'Unable to create learning plan')
    } finally {
      setCreatingPlan(false)
    }
  }

  React.useEffect(() => {
    setApiStatusListener(status => dispatch(setApiAvailability(status)))
    const markOffline = () => dispatch(setNetworkOnline(false))
    const markOnline = () => {
      dispatch(setNetworkOnline(true))
      if (firebaseAuth?.currentUser) {
        firebaseAuth.currentUser.getIdToken(true)
          .then(() => dispatch(setApiAvailability({ networkOnline: true, authAvailable: true, reason: null })))
          .catch(() => dispatch(setApiAvailability({ authAvailable: false, reason: 'auth' })))
      }
    }
    window.addEventListener('offline', markOffline)
    window.addEventListener('online', markOnline)
    return () => {
      setApiStatusListener(null)
      window.removeEventListener('offline', markOffline)
      window.removeEventListener('online', markOnline)
    }
  }, [dispatch])

  React.useEffect(() => {
    if (!firebaseAuth) return undefined
    let active = true
    setAccessTokenProvider(() => firebaseAuth.currentUser?.getIdToken() || Promise.resolve(null))
    const unsubscribe = firebaseAuth.onIdTokenChanged(async user => {
      setAuth(user)
      setAuthResolved(true)
      if (!user) {
        privateCacheUserRef.current = null
        dispatch(endPrivateSyncSession())
        dispatch(setPlans([]))
        return
      }
      dispatch(setApiAvailability({ authAvailable: true, reason: navigator.onLine ? null : 'network' }))
      if (privateCacheUserRef.current === user.uid) return
      privateCacheUserRef.current = user.uid
      try {
        const cached = await loadPrivatePlanCache(user.uid)
        if (!active) return
        if (store.getState().plans.items.length === 0 && cached.plans?.length) {
          dispatch(setPlans(cached.plans))
          Object.entries(cached.pendingByPlan || {}).forEach(([planId, pending]) => {
            dispatch(applyPendingPlanProgress({ planId, videos: pending.videos }))
          })
        }
        dispatch(startPrivateSyncSession({ userId: user.uid, pendingByPlan: cached.pendingByPlan || {} }))
      } catch {
        if (active) dispatch(startPrivateSyncSession({ userId: user.uid, pendingByPlan: {} }))
      }
    })
    return () => { active = false; unsubscribe() }
  }, [dispatch])

  React.useEffect(() => {
    if (!auth?.uid || !privatePlanSync.hydrated || privatePlanSync.userId !== auth.uid) return undefined
    const timeout = window.setTimeout(() => {
      savePrivatePlanCache(auth.uid, plans, privatePlanSync.pendingByPlan).catch(error => console.warn('Unable to persist offline learning-plan state:', error))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [auth?.uid, plans, privatePlanSync.hydrated, privatePlanSync.pendingByPlan, privatePlanSync.userId])

  React.useEffect(() => {
    if (auth) return
    setShowCreatePlanDrawer(false)
    setShowSourceSyncDrawer(false)
    setShowAiModelDrawer(false)
  }, [auth?.uid])

  React.useEffect(() => {
    if (auth && privatePlanSync.hydrated) loadPlans()
  }, [auth?.uid, privatePlanSync.hydrated])

  React.useEffect(() => {
    if (AI_ENABLED && auth) dispatch(loadAiModels())
  }, [auth?.uid, dispatch])

  React.useEffect(() => {
    if (!AI_ENABLED || location.pathname !== '/ai-model-configs') return
    setShowAiModelDrawer(true)
    navigate('/', { replace: true })
  }, [location.pathname, navigate])

  React.useEffect(() => {
    if (!auth) return
    let cancelled = false
    setSourceMetadataLoaded(false)
    getSourceSyncMetadata()
      .then(data => {
        if (!cancelled) dispatch(setSourceSyncMetadata(data))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSourceMetadataLoaded(true)
      })
    return () => { cancelled = true }
  }, [auth?.uid, dispatch])

  React.useEffect(() => {
    if (!auth || !showSourceSyncDrawer) return
    let cancelled = false
    setSourceMetadataLoaded(false)
    getSourceSyncMetadata()
      .then(data => {
        if (!cancelled) dispatch(setSourceSyncMetadata(data))
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Unable to refresh source targets:', error)
          setSourceSyncError(error.message || 'Unable to refresh source targets.')
        }
      })
      .finally(() => {
        if (!cancelled) setSourceMetadataLoaded(true)
      })
    return () => { cancelled = true }
  }, [auth?.uid, dispatch, showSourceSyncDrawer])

  React.useEffect(() => {
    if (
      !showSourceSyncDrawer
      || !sourceMetadataLoaded
      || (syncMetadata?.channels?.length || 0) > 0
      || !auth
    ) return

    const userKey = auth.uid
    if (sourceBootstrapUserRef.current === userKey) return
    sourceBootstrapUserRef.current = userKey
    let cancelled = false

    const bootstrapSourceInbox = async () => {
      setSourceSyncBootstrapping(true)
      setSourceSyncError('')
      try {
        const metadata = await syncSourceMetadata()
        if (cancelled) return
        setSourceSyncBootstrapping(false)
        dispatch(setSourceSyncMetadata(metadata))
        await loadPlans()
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to initialize source metadata:', error)
          setSourceSyncError(error.message || 'Unable to load subscribed channels.')
        }
      } finally {
        if (!cancelled) setSourceSyncBootstrapping(false)
      }
    }

    bootstrapSourceInbox()
    return () => { cancelled = true }
  }, [
    auth?.uid,
    dispatch,
    loadPlans,
    showSourceSyncDrawer,
    sourceMetadataLoaded,
    syncMetadata?.channels?.length,
  ])

  const refreshSourceMetadata = async channelId => {
    setSourcePullingChannelIds(current => ({ ...current, [channelId]: true }))
    setSourceSyncChannelErrors(current => ({ ...current, [channelId]: '' }))
    try {
      const metadata = await syncSourceMetadata({ channelId })
      dispatch(setSourceSyncMetadata(metadata))
      await loadPlans()
    } catch (error) {
      console.error('Unable to refresh source metadata:', error)
      setSourceSyncChannelErrors(current => ({ ...current, [channelId]: error.message || 'Unable to check this channel.' }))
    } finally {
      setSourcePullingChannelIds(current => ({ ...current, [channelId]: false }))
    }
  }

  const pushSourceFeeds = async (scope = {}) => {
    setSourcePushLoading(true)
    setSourcePreviewError('')
    try {
      const response = await pushNewSourceFeeds(scope)
      dispatch(setSourceSyncMetadata(response.metadata))
      await loadPlans()
      if (response.remaining_videos?.length) {
        setSourcePreview(current => current
          ? { ...current, videos: response.remaining_videos }
          : current)
      } else {
        setSourcePreview(null)
      }
    } catch (error) {
      setSourcePreviewError(error.message || 'Unable to push this feed to the selected module.')
    } finally {
      setSourcePushLoading(false)
    }
  }

  const previewSourceFeed = (channel, playlist = null) => {
    const scope = playlist || channel
    setSourcePreviewError('')
    setSourcePreview({
      channelId: channel.channel_id,
      playlistId: playlist ? (playlist.playlist_id || playlist.id) : null,
      title: playlist ? `${channel.title} · ${playlist.title}` : `${channel.title} · Channel feed`,
      targets: scope.target_courses || [],
      videos: scope.new_videos || [],
    })
  }

  const organizeSourceFeeds = async request => {
    setSourceAiLoading(true)
    try {
      return await organizeNewSourceFeeds(request)
    } finally {
      setSourceAiLoading(false)
    }
  }

  const confirmSourceOrganization = async request => {
    setSourceAiLoading(true)
    try {
      const response = await confirmSourceFeedOrganization(request)
      dispatch(setSourceSyncMetadata(response.metadata))
      await loadPlans()
      if (response.remaining_videos?.length) {
        setSourcePreview(current => current
          ? { ...current, videos: response.remaining_videos }
          : current)
      } else {
        setSourcePreview(null)
      }
      return response
    } finally {
      setSourceAiLoading(false)
    }
  }

  const pendingVideosForChannel = channel => (channel.new_videos?.length || 0) + (channel.playlists || []).reduce((count, playlist) => count + (playlist.new_videos?.length || 0), 0)
  const targetsForChannel = channel => (channel.target_courses?.length || 0) + (channel.playlists || []).reduce((count, playlist) => count + (playlist.target_courses?.length || 0), 0)
  const renderTargetCourses = (targets = [], label = 'target course') => {
    const names = [...new Set(targets.map(target => {
      const plan = plans.find(item => item.id === target.plan_id)
      const course = plan?.courses?.find(item => item.id === target.course_id)
      if (plan && course) return `${plan.name} → ${course.title}`
      if (course) return course.title
      return `Plan ${target.plan_id || 'unknown'} → Course ${target.course_id || 'unknown'}`
    }))]
    const count = targets.length
    return <span className={`source-sync-target-tooltip ${count ? 'has-targets' : ''}`}><span className="source-sync-target-trigger">{count} {label}{count === 1 ? '' : 's'}</span>{count > 0 && <span className="source-sync-target-tooltip-content" role="tooltip"><strong>Targets</strong>{names.map(name => <span key={name}>• {name}</span>)}</span>}</span>
  }
  const sourceSyncPendingCount = (syncMetadata?.channels || []).reduce((count, channel) => count + pendingVideosForChannel(channel), 0)
  const sourceChannelPulling = Object.values(sourcePullingChannelIds).some(Boolean)
  const sourceInboxLoading = !sourceMetadataLoaded || sourceSyncBootstrapping || sourceChannelPulling
  const sourceInboxLoadingLabel = sourceChannelPulling
    ? 'Pulling new course feeds…'
    : sourceSyncBootstrapping
      ? 'Preparing your course feed inbox…'
      : 'Loading course feed inbox…'
  const sourceSyncChannels = [...(syncMetadata?.channels || [])]
    .filter(channel => `${channel.title || ''} ${(channel.playlists || []).map(playlist => playlist.title || '').join(' ')}`.toLowerCase().includes(sourceSyncSearch.trim().toLowerCase()))
    .filter(channel => sourceSyncFilter === 'all' || pendingVideosForChannel(channel) > 0)
    .filter(channel => !sourceSyncTargetsOnly || targetsForChannel(channel) > 0)
    .sort((left, right) => sourceSyncSort === 'date'
      ? new Date(right.last_synced_at || 0) - new Date(left.last_synced_at || 0)
      : (left.title || '').localeCompare(right.title || ''))

  return (
    <div className="app-layout">
      <aside className={`right-nav ${showMobileNav ? 'mobile-nav-open' : ''}`}>
        <div className="right-nav-actions">
          <div className="right-nav-mobile-bar">
            <button type="button" className="app-logo-nav-button" title="YouTube Learning home" aria-label="YouTube Learning home" onClick={() => navigate('/')}><img src={appLogo} alt="" /></button>
            <button type="button" className={`mobile-nav-menu-button ${showMobileNav ? 'expanded' : ''}`} aria-label={showMobileNav ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={showMobileNav} onClick={() => setShowMobileNav(value => !value)}>
              <svg className="navigation-slide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
          <div className="right-nav-menu-panel" aria-label="Application navigation" onClick={closeNavigationAfterAction}>
          <button type="button" className="mobile-nav-drawer-close" aria-label="Collapse navigation" onClick={() => setShowMobileNav(false)}><svg className="navigation-slide-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
          <button type="button" className="mobile-nav-home-item" onClick={() => navigate('/')}><img src={appLogo} alt="" /><span className="mobile-nav-item-label">Home</span></button>
          <div className="right-nav-top">
          <div className="right-nav-workspace-group" role="group" aria-label="Learning workspace" title="Learning workspace">
            <span className="mobile-nav-group-title">Learning workspace</span>
            <button type="button" className={`home-nav-button nav-color-plans ${location.pathname.startsWith('/plans') ? 'active' : ''}`} title="Learning Plans" aria-label="Learning Plans" onClick={() => navigate('/plans')}><svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H7a2 2 0 0 1-2-2V4Zm2 0v14a2 2 0 0 0-2-2m4-7h5m-5 4h5" /></svg><span className="mobile-nav-item-label">Learning plans</span></button>
            <button type="button" className="quick-plan-button nav-color-search" onClick={() => setShowPlanSwitcher(true)} aria-label="Open global search" title="Global search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg><span className="mobile-nav-item-label">Global search</span></button>
            {auth && <button type="button" className="add-plan-nav-button nav-color-create" title="Create learning plan" aria-label="Create learning plan" onClick={() => { setCreatePlanError(''); setShowCreatePlanDrawer(true) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span className="mobile-nav-item-label">Create learning plan</span></button>}
            {auth && <button type="button" className="refresh-plans nav-color-inbox" onClick={() => { setSourceSyncError(''); setShowSourceSyncDrawer(true) }} aria-label="Open source feed inbox" title="Source feed inbox">
              <SourceInboxIcon /><span className="mobile-nav-item-label">Source feed inbox</span>
            </button>}
          </div>
          <div className="right-nav-public-group" role="group" aria-label="Public learning library" title="Public learning library">
            <span className="mobile-nav-group-title">Public learning library</span>
            <button type="button" className={`home-nav-button nav-color-public-plans ${location.pathname.startsWith('/public/plans') ? 'active' : ''}`} title="Public learning plans" aria-label="Public learning plans" onClick={() => navigate('/public/plans')}><PublicPlansIcon /><span className="mobile-nav-item-label">Public learning plans</span></button>
            <button type="button" className={`home-nav-button nav-color-notes ${location.pathname.startsWith('/notes') ? 'active' : ''}`} title="Learning Notes" aria-label="Learning Notes" onClick={() => navigate('/notes')}><LearningNotesIcon /><span className="mobile-nav-item-label">Learning notes</span></button>
          </div>
          </div>
          <div className="right-nav-bottom">
          <span className="mobile-nav-group-title">Account and settings</span>
          {AI_ENABLED && auth && <button type="button" className={`home-nav-button nav-color-ai ${showAiModelDrawer ? 'active' : ''}`} title="AI model configurations" aria-label="AI model configurations" onClick={() => setShowAiModelDrawer(true)}><AiModelConfigIcon /><span className="mobile-nav-item-label">AI model configurations</span></button>}
          <button type="button" className="home-nav-button settings-nav-button nav-color-settings" title="Settings" aria-label="Settings" onClick={() => setShowSettingsDrawer(true)}><WorkspaceIcon name="settings" /><span className="mobile-nav-item-label">Settings</span></button>
          <button type="button" className={`profile-nav-button ${profileOpen ? 'active' : ''}`} title={auth?.displayName || auth?.email || 'Profile'} aria-label="Profile" aria-expanded={profileOpen} onClick={openProfile}>{auth?.photoURL ? <img src={auth.photoURL} alt="" /> : <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}<span className="mobile-nav-item-label">{auth?.displayName || auth?.email || 'Profile'}</span></button>
          </div>
          </div>
        </div>
      </aside>
      {showMobileNav && <button type="button" className="mobile-nav-overlay" aria-label="Close navigation menu" onClick={() => setShowMobileNav(false)} />}
      {profileOpen && <><div className="drawer-overlay profile-drawer-overlay" onClick={closeProfile} /><aside className="drawer profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-drawer-title"><div className="drawer-header"><div><h2 id="profile-drawer-title">Profile</h2><p>Manage your account and connected services.</p></div><button className="btn btn-secondary btn-sm" onClick={closeProfile} aria-label="Close"><CloseIcon /></button></div><div className="drawer-body"><Profile showTitle={false} /></div></aside></>}
      {auth && showCreatePlanDrawer && <><div className="drawer-overlay" onClick={closeCreatePlanDrawer} /><aside className="drawer create-plan-drawer" role="dialog" aria-modal="true" aria-labelledby="create-plan-title">
        <div className="drawer-header"><h2 id="create-plan-title">Create Learning Plan</h2><button className="btn btn-secondary btn-sm" onClick={closeCreatePlanDrawer} aria-label="Close"><CloseIcon /></button></div>
        <div className="drawer-body">
          <DismissibleError message={createPlanError} />
          <div className="form-group"><label>Plan Name *</label><input value={createPlanForm.name} onChange={event => setCreatePlanForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Kubernetes Deep Dive" /></div>
          <div className="form-group"><label>Description</label><textarea rows={3} value={createPlanForm.description} onChange={event => setCreatePlanForm(current => ({ ...current, description: event.target.value }))} placeholder="What will this plan cover?" /></div>
          <div className="form-group"><label>Logo URL (optional)</label><div className="logo-upload"><input value={createPlanForm.logoUrl} onChange={event => setCreatePlanForm(current => ({ ...current, logoUrl: event.target.value }))} placeholder="https://skillicons.dev/icons?i=" />{createPlanForm.logoUrl && <img src={createPlanForm.logoUrl} alt="Logo preview" className="logo-preview" />}</div></div>
        </div>
        <div className="drawer-footer"><button className="btn btn-secondary" onClick={closeCreatePlanDrawer} disabled={creatingPlan}>Cancel</button><button className="btn btn-primary" onClick={submitNewPlan} disabled={creatingPlan}>{creatingPlan ? <><span className="spinner" /> Creating...</> : 'Create Plan'}</button></div>
      </aside></>}
      {AI_ENABLED && auth && showAiModelDrawer && <AiModelConfigDrawer onClose={() => setShowAiModelDrawer(false)} />}
      {showSettingsDrawer && <><div className="drawer-overlay" onClick={() => setShowSettingsDrawer(false)} /><aside className="drawer settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-drawer-title"><div className="drawer-header"><div><h2 id="settings-drawer-title">Settings</h2><p>Personalize your learning workspace.</p></div><button className="btn btn-secondary btn-sm" onClick={() => setShowSettingsDrawer(false)} aria-label="Close"><CloseIcon /></button></div><div className="drawer-body settings-drawer-body"><section className="settings-section"><div><h3>Font size</h3><p>Adjust text sizing across the application.</p></div><div className="settings-option-grid" role="group" aria-label="Global font size">{[['small', 'Small', 'Aa'], ['medium', 'Medium', 'Aa'], ['large', 'Large', 'Aa']].map(([size, label, sample]) => <button type="button" key={size} className={fontSize === size ? 'active' : ''} onClick={() => setFontSize(size)} aria-pressed={fontSize === size}><span className={`settings-font-sample ${size}`}>{sample}</span><strong>{label}</strong></button>)}</div></section><section className="settings-section"><div><h3>Theme</h3><p>Choose the color theme used throughout the application.</p></div><div className="settings-option-grid" role="group" aria-label="Theme">{['light', 'pale', 'dark'].map(value => <button type="button" key={value} className={theme === value ? 'active' : ''} onClick={() => setTheme(value)} aria-pressed={theme === value}><span className={`settings-theme-preview ${value}`}><ThemeIcon theme={value} /></span><strong>{value}</strong></button>)}</div></section></div><div className="drawer-footer"><button className="btn btn-primary" onClick={() => setShowSettingsDrawer(false)}>Done</button></div></aside></>}
      {auth && showSourceSyncDrawer && <><div className="drawer-overlay" onClick={() => setShowSourceSyncDrawer(false)} /><aside className="drawer source-sync-drawer"><div className="drawer-header"><div><h2>Source feed inbox</h2><p>Pull new YouTube feeds, then route them to a course for review.</p></div><button className="btn btn-secondary btn-sm" onClick={() => setShowSourceSyncDrawer(false)} aria-label="Close"><CloseIcon /></button></div><LoadingBar active={sourceInboxLoading} label={sourceInboxLoadingLabel} className="drawer-loading-wait-bar" /><div className="drawer-body source-sync-body">
        <DismissibleError message={sourceSyncError} />
        <section className="source-sync-channel-section">
          <div className="source-sync-channel-controls"><input value={sourceSyncSearch} onChange={event => setSourceSyncSearch(event.target.value)} placeholder="Search channels or playlists..." aria-label="Search content sources" /><div className="picker-sort-toggle"><button className={sourceSyncFilter === 'all' ? 'active' : ''} onClick={() => setSourceSyncFilter('all')}>All ({syncMetadata?.channels?.length || 0})</button><button className={sourceSyncFilter === 'pending' ? 'active' : ''} onClick={() => setSourceSyncFilter('pending')}>Pending ({sourceSyncPendingCount})</button></div><label className="source-sync-target-switch"><input type="checkbox" checked={sourceSyncTargetsOnly} onChange={event => setSourceSyncTargetsOnly(event.target.checked)} /><span className="source-sync-target-switch-track" aria-hidden="true" /><span>Targets only</span></label><div className="picker-sort-toggle"><button className={sourceSyncSort === 'name' ? 'active' : ''} onClick={() => setSourceSyncSort('name')}>Name</button><button className={sourceSyncSort === 'date' ? 'active' : ''} onClick={() => setSourceSyncSort('date')}>Last sync</button></div></div>
          <div className="source-sync-channel-list">{(!sourceMetadataLoaded || sourceSyncBootstrapping) ? <div className="source-sync-loading-placeholder" aria-hidden="true" /> : sourceSyncChannels.length ? sourceSyncChannels.map(channel => {
            const expanded = Boolean(expandedSyncChannels[channel.channel_id])
            const channelNewCount = channel.new_videos?.length || 0
            const pendingCount = pendingVideosForChannel(channel)
            const channelPulling = Boolean(sourcePullingChannelIds[channel.channel_id])
            const visiblePlaylists = (channel.playlists || []).filter(playlist => !sourceSyncTargetsOnly || (playlist.target_courses?.length || 0) > 0)
            return <article className={`source-sync-channel-card ${pendingCount ? 'has-pending-feed' : ''}`} key={channel.channel_id}>
              <button className="source-sync-channel-heading" onClick={() => setExpandedSyncChannels(current => ({ ...current, [channel.channel_id]: !current[channel.channel_id] }))} aria-expanded={expanded}>{channel.thumbnail ? <img src={channel.thumbnail} alt="" /> : <span className="source-sync-fallback">{channel.title?.charAt(0).toUpperCase() || '?'}</span>}<span className="source-sync-channel-title"><strong>{channel.title || 'Untitled channel'}</strong><small>{channel.videos_count ?? 0} videos · {renderTargetCourses(channel.target_courses, 'direct target course')}</small><small className="source-sync-last-sync">Last sync: {channel.last_synced_at ? new Date(channel.last_synced_at).toLocaleString() : 'not yet'}{channel.last_synced_at && <span className="source-sync-age-badge">{formatRelativeAge(channel.last_synced_at)}</span>}</small></span>{pendingCount > 0 && <span className="source-sync-pending-badge" aria-label={`${pendingCount} new videos`}>{pendingCount} new</span>}<span className={`source-sync-expand ${expanded ? 'expanded' : ''}`} aria-hidden="true">›</span></button>
              {expanded && <div className="source-sync-channel-details">
                <div className="source-sync-push-row"><span>{channelNewCount} new channel-feed videos</span><div className="source-sync-channel-quick-actions"><button className="btn btn-primary btn-sm" disabled={channelPulling} onClick={() => refreshSourceMetadata(channel.channel_id)}>{channelPulling ? 'Pulling…' : 'Pull new feeds'}</button>{channel.url && <a className="btn btn-secondary btn-sm" href={channel.url} target="_blank" rel="noreferrer">Open YouTube ↗</a>}<button className="btn btn-secondary btn-sm" disabled={!channelNewCount} onClick={() => previewSourceFeed(channel)}>Preview</button></div></div>
                <DismissibleError message={sourceSyncChannelErrors[channel.channel_id]} />
                {visiblePlaylists.length > 0 && <div className="source-sync-playlists"><strong>Playlists</strong>{visiblePlaylists.map(playlist => { const playlistId = playlist.playlist_id || playlist.id; const newCount = playlist.new_videos?.length || 0; return <div key={playlistId}><span>{playlist.title || 'Untitled playlist'}<small>{playlist.videos_count ?? 0} videos · {newCount} ready · {renderTargetCourses(playlist.target_courses)}</small></span><button className="btn btn-secondary btn-sm" disabled={!newCount} onClick={() => previewSourceFeed(channel, playlist)}>Preview</button></div> })}</div>}
                <small className="source-sync-checkpoint">Last source check: {channel.last_feed_checked_at ? new Date(channel.last_feed_checked_at).toLocaleString() : 'not yet'}</small>
              </div>}
            </article>
          }) : <p className="source-sync-empty">{syncMetadata?.channels?.length ? 'No channels match this filter.' : 'No subscribed-channel metadata is stored yet. Pull new feeds from YouTube to start.'}</p>}</div>
        </section>
      </div></aside></>}
      {sourcePreview && <SourceFeedPreviewDialog preview={sourcePreview} plans={plans} loading={sourcePushLoading} aiLoading={sourceAiLoading} aiEnabled={AI_ENABLED} error={sourcePreviewError} onClose={() => { setSourcePreview(null); setSourcePreviewError('') }} onPush={pushSourceFeeds} onOrganize={organizeSourceFeeds} onConfirmOrganization={confirmSourceOrganization} />}
      {showPlanSwitcher && <GlobalSearchDrawer plans={plans} onClose={() => setShowPlanSwitcher(false)} onNavigate={navigate} />}
      <main className="main-content">
        <Routes location={routedLocation}>
          <Route path="/" element={<Dashboard aiEnabled={AI_ENABLED} onOpenAiModels={() => setShowAiModelDrawer(true)} />} />
          <Route path="/plans" element={<PlansRoute newPlanRequest={0} onRefresh={loadPlans} refreshing={plansLoading} auth={auth} authResolved={authResolved} />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/public/plans" element={<PublicPlans />} />
          <Route path="/public/plans/:shareId" element={<PublicPlan />} />
          <Route path="/public/plans/:shareId/courses/:courseId" element={<PublicPlan />} />
          <Route path="/ai-model-configs" element={<Navigate to="/" replace />} />
          <Route path="/plans/:planId" element={<PlanOverview loading={plansLoading} />} />
          {AI_ENABLED && <Route path="/plans/:planId/ai-requests" element={<AiRequests />} />}
          <Route path="/plans/:planId/courses/:courseId" element={<CourseOverview />} />
          <Route path="/plans/:planId/courses/:courseId/learn" element={<CourseWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter><AppLayout /></BrowserRouter>
    </Provider>
  )
}
