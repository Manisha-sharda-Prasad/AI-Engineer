import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PlanDetail from '../components/PlanDetail'
import { CloseIcon, LabelIcon, WorkspaceIcon } from '../components/Icons'
import { LearningPlanDropdown, CourseViewDropdown, CourseDropdown, ModuleDropdown } from '../components/LearningPathNav'
import { submitCourseRefreshFeed } from '../api/client'
import { updatePlan } from '../store/plansSlice'
import { rememberLearningLocation, selectPlanPageState, selectWorkspaceState, updatePlanPage, updateWorkspace } from '../store/learningUiSlice'
import { getVideoProgress } from '../utils/videoProgress'
import PrivatePlanSyncStatus from '../components/PrivatePlanSyncStatus'
import WorkspaceBookmarksDrawer, { collectBookmarkItems, COURSE_BOOKMARK_TYPES } from '../components/WorkspaceBookmarksDrawer'
import { firebaseAuth } from '../firebase'

export default function CourseWorkspace() {
  const { planId, courseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const allPlans = useSelector(state => state.plans.items)
  const plan = useSelector(state => state.plans.items.find(item => item.id === planId))
  const rememberedWorkspace = useSelector(state => selectWorkspaceState(state, planId, courseId))
  const { courseLabelTab } = useSelector(state => selectPlanPageState(state, planId))
  const syncMetadata = useSelector(state => state.sources.syncMetadata)
  const [showOverview, setShowOverview] = React.useState(false)
  const [isCourseEditing, setIsCourseEditing] = React.useState(false)
  const [refreshLoading, setRefreshLoading] = React.useState(false)
  const [refreshError, setRefreshError] = React.useState('')
  const [showFeedReview, setShowFeedReview] = React.useState(false)
  const [feedReviewTab, setFeedReviewTab] = React.useState('visual')
  const [feedReviewSearch, setFeedReviewSearch] = React.useState('')
  const [feedReviewSort, setFeedReviewSort] = React.useState('name')
  const [showMobileActions, setShowMobileActions] = React.useState(false)
  const [workspaceActionHost, setWorkspaceActionHost] = React.useState(null)
  const [workspaceOutlineHost, setWorkspaceOutlineHost] = React.useState(null)
  const [workspaceToolbarHost, setWorkspaceToolbarHost] = React.useState(null)
  const [moduleSelectionRequest, setModuleSelectionRequest] = React.useState(null)
  const [showBookmarks, setShowBookmarks] = React.useState(false)
  const [bookmarkQuery, setBookmarkQuery] = React.useState('')
  const [bookmarkType, setBookmarkType] = React.useState('all')
  const [isCompactWorkspace, setIsCompactWorkspace] = React.useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches)
  const [authState, setAuthState] = React.useState(() => ({ resolved: !firebaseAuth, user: firebaseAuth?.currentUser || null }))

  React.useEffect(() => {
    if (!firebaseAuth) return undefined
    return firebaseAuth.onIdTokenChanged(user => setAuthState({ resolved: true, user }))
  }, [])

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const updateCompactMode = event => {
      setIsCompactWorkspace(event.matches)
      if (!event.matches) setShowMobileActions(false)
    }
    setIsCompactWorkspace(media.matches)
    media.addEventListener('change', updateCompactMode)
    return () => media.removeEventListener('change', updateCompactMode)
  }, [])

  React.useEffect(() => {
    setShowOverview(false)
    setShowFeedReview(false)
    setIsCourseEditing(false)
    setRefreshError('')
    setModuleSelectionRequest(null)
  }, [planId, courseId])

  React.useEffect(() => {
    dispatch(rememberLearningLocation({
      planId,
      courseId,
      moduleId: rememberedWorkspace.activeModuleId,
      videoId: rememberedWorkspace.activeVideoId,
    }))
  }, [courseId, dispatch, planId, rememberedWorkspace.activeModuleId, rememberedWorkspace.activeVideoId])

  if (!plan || !plan.courses?.some(course => course.id === courseId)) {
    if (!authState.resolved) return <div className="private-course-access-state" role="status"><span className="spinner" /><strong>Checking your learning session…</strong></div>
    if (!authState.user) return <section className="private-course-access-state is-signed-out" aria-labelledby="private-course-sign-in-title">
      <span className="private-course-access-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg></span>
      <div><small>Private learning course</small><h1 id="private-course-sign-in-title">Sign in to continue</h1><p>This course belongs to a private account. Sign in with the same account to restore its cached plan and locally saved progress.</p></div>
      <div className="private-course-access-actions">
        <button type="button" className="btn btn-primary" onClick={() => navigate('/profile', { state: { profileBackgroundLocation: location } })}>Sign in with Google</button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/public/plans')}>Browse public plans</button>
      </div>
    </section>
    return <section className="private-course-access-state"><strong>Course not found</strong><p>This course is not available in your current learning plans.</p><button type="button" className="btn btn-secondary" onClick={() => navigate('/plans')}>Back to learning plans</button></section>
  }

  const course = plan.courses.find(item => item.id === courseId)
  const activeBreadcrumbModule = course.modules?.find(module => module.id === rememberedWorkspace.activeModuleId)
    || course.modules?.find(module => module.videos?.some(video => video.video_id === rememberedWorkspace.activeVideoId))
    || course.modules?.[0]
    || null
  const videos = course.modules?.flatMap(module => module.videos || []) || []
  const { watched, total: progressVideoCount, progress } = getVideoProgress(videos)
  const bookmarked = videos.filter(video => video.labels?.includes('bookmarked')).length
  const markedForDelete = videos.filter(video => video.labels?.includes('mark_for_delete')).length
  const refreshNeeded = course.labels?.includes('refresh_needed')
  const stagedFeeds = course.new_video_feeds || []
  const stagedVideoCount = stagedFeeds.reduce((count, feed) => count + (feed.videos?.length || 0), 0)
  const reviewVideos = stagedFeeds.flatMap(feed => (feed.videos || []).map(video => ({ ...video, feed })))
    .filter(video => `${video.title || ''} ${video.description || ''}`.toLowerCase().includes(feedReviewSearch.trim().toLowerCase()))
    .sort((left, right) => feedReviewSort === 'date'
      ? new Date(right.published_at || 0) - new Date(left.published_at || 0)
      : (left.title || '').localeCompare(right.title || ''))
  const formatDuration = seconds => seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '—'

  async function submitRefresh() {
    setRefreshLoading(true)
    setRefreshError('')
    try {
      const response = await submitCourseRefreshFeed(planId, courseId)
      dispatch(updatePlan(response.plan))
      setShowFeedReview(false)
    } catch (error) {
      setRefreshError(error.message || 'Unable to submit new video feed')
    } finally {
      setRefreshLoading(false)
    }
  }

  const standardCourseTabs = [
    { id: "ALL", label: "All courses", shortLabel: "All Courses" },
    { id: "bookmarked", label: "Bookmarked" },
    { id: "watched", label: "Watched" },
    { id: "mark_for_delete", label: "Marked for delete" },
    { id: "refresh_needed", label: "Refresh needed" },
  ];
  const standardCourseLabelIds = standardCourseTabs
    .map(tab => tab.id)
    .filter(id => id !== "ALL");
  const customCourseLabels = [
    ...new Set((plan?.courses || []).flatMap(course => course.labels || [])),
  ]
    .filter(label => !standardCourseLabelIds.includes(label))
    .sort((left, right) => left.localeCompare(right));
  const courseViewOptions = [
    ...standardCourseTabs.map((tab) => ({
      ...tab,
      group: "built-in",
      count:
        tab.id === "ALL"
          ? plan?.courses?.length || 0
          : plan?.courses?.filter((course) => course.labels?.includes(tab.id)).length || 0,
    })),
    ...customCourseLabels.map(label => ({
      id: label,
      label: label.replaceAll("_", " "),
      group: "custom",
      count:
        plan?.courses?.filter(course => course.labels?.includes(label)).length || 0,
    })),
  ];
  const coursesForView = (value) => [...(plan?.courses || [])]
    .filter((item) => value === "ALL" || item.labels?.includes(value))
    .sort((left, right) => (
      (left.sequence || 0) - (right.sequence || 0)
      || (left.title || "").localeCompare(right.title || "")
    ));
  const visibleBreadcrumbCourses = coursesForView(courseLabelTab);
  const selectedBreadcrumbCourse =
    visibleBreadcrumbCourses.find(item => item.id === courseId)
    || visibleBreadcrumbCourses[0]
    || null;

  const bookmarkItems = collectBookmarkItems([plan], { courseId, includeCourses: false })

  function openBookmark(item) {
    setShowBookmarks(false)
    setShowMobileActions(false)
    const destination = `/plans/${item.plan.id}/courses/${item.course.id}/learn`
    if (item.type === 'course') {
      navigate(destination)
      return
    }

    const videoId = item.video?.video_id || item.module.videos?.[0]?.video_id || null
    if (item.plan.id === planId && item.course.id === courseId) {
      setModuleSelectionRequest(current => ({
        moduleId: item.module.id,
        videoId,
        requestId: (current?.requestId || 0) + 1,
      }))
      return
    }

    dispatch(updateWorkspace({
      planId: item.plan.id,
      courseId: item.course.id,
      changes: {
        activeModuleId: item.module.id,
        activeVideoId: videoId,
        expandedModuleIds: [item.module.id],
      },
    }))
    navigate(destination)
  }

  const renderCourseActions = (className = "") => (
    <div className={`workspace-action-panel ${className}`}>
      <button className="btn btn-secondary btn-sm icon-button workspace-bookmarks-button" title="Open bookmarks" aria-label="Open bookmarks" onClick={() => { setBookmarkQuery(''); setBookmarkType('all'); setShowBookmarks(true) }}><LabelIcon label="bookmarked" />{bookmarkItems.length > 0 && <span className="workspace-bookmarks-count">{bookmarkItems.length}</span>}</button>
      <button className={`btn btn-secondary btn-sm icon-button workspace-course-info-button ${refreshNeeded ? 'refresh-needed' : ''}`} title={refreshNeeded ? 'Course refresh needed' : 'Course overview'} aria-label="Course overview" onClick={() => setShowOverview(true)}><WorkspaceIcon name="info" /></button>
    </div>
  );

  return <div className="course-workspace-page">
    <nav className="plan-detail-breadcrumb" aria-label="Plan and course filter">
      <div className="plan-detail-breadcrumb-path">
        <LearningPlanDropdown
          plans={allPlans}
          selectedPlan={plan}
          includeAll
          showCount
          onSelect={(selectedPlan) => {
            if (selectedPlan) {
              navigate(`/plans/${selectedPlan.id}/courses/${selectedPlan.courses?.[0]?.id || ''}/learn`);
            } else {
              navigate(`/plans/all`);
            }
          }}
        />
        <span className="learning-path-separator" aria-hidden="true">/</span>
        <CourseViewDropdown
          options={courseViewOptions}
          value={courseLabelTab}
          onSelect={(value) => {
            dispatch(updatePlanPage({ planId, changes: { courseLabelTab: value } }));
            if (value === "ALL") {
              navigate(`/plans/${planId}`);
              return;
            }
            const nextCourse = coursesForView(value)[0];
            if (nextCourse && nextCourse.id !== courseId) {
              navigate(`/plans/${planId}/courses/${nextCourse.id}/learn`);
            }
          }}
        />
        <span className="learning-path-separator" aria-hidden="true">/</span>
        <CourseDropdown
          plan={{ ...plan, courses: visibleBreadcrumbCourses }}
          course={selectedBreadcrumbCourse}
          onSelect={(selectedCourse) => {
            navigate(`/plans/${planId}/courses/${selectedCourse.id}/learn`);
          }}
        />
        <span className="learning-path-separator" aria-hidden="true">/</span>
        <ModuleDropdown
          course={course}
          module={activeBreadcrumbModule}
          onSelect={(selectedModule) => setModuleSelectionRequest(current => ({ moduleId: selectedModule.id, requestId: (current?.requestId || 0) + 1 }))}
        />
      </div>
      <PrivatePlanSyncStatus planId={planId} />
    </nav>
    <section className="private-course-workspace-hero" aria-labelledby="private-course-workspace-title">
      <span className="private-course-workspace-brand">
        {course.logo_url || course.logo ? <img src={course.logo_url || course.logo} alt="" /> : <b>{course.title?.charAt(0)?.toUpperCase() || '?'}</b>}
      </span>
      <div>
        <small>Learning course</small>
        <h1 id="private-course-workspace-title">{course.title}</h1>
        <p>{course.description || 'Learn through the modules and videos organized in this course.'}</p>
        <div className="private-course-workspace-counts" aria-label="Course content totals">
          <span><b>{course.modules?.length || 0}</b> modules</span>
          <span><b>{progressVideoCount}</b> videos</span>
        </div>
      </div>
      <div className="private-course-workspace-side">
        {!isCompactWorkspace ? <div className="private-course-workspace-controls">
          {renderCourseActions("private-course-overview-action")}
          <div className="workspace-breadcrumb-actions" ref={setWorkspaceActionHost} />
          <div className="workspace-header-tree-controls" ref={setWorkspaceToolbarHost} />
        </div> : <div className="private-course-mobile-header-actions"><div className="private-course-mobile-outline-host" ref={setWorkspaceOutlineHost} /><button type="button" className="mobile-page-menu-button private-course-mobile-actions-trigger" aria-label="Open course actions" aria-expanded={showMobileActions} onClick={() => setShowMobileActions(true)}><WorkspaceIcon name="menu" /><span>Course actions</span></button></div>}
      </div>
    </section>
    <div className="workspace-plan-detail">
      <PlanDetail key={`${planId}:${courseId}`} plan={plan} workspaceCourseId={courseId} workspaceActionHost={workspaceActionHost} workspaceOutlineHost={workspaceOutlineHost} workspaceToolbarHost={workspaceToolbarHost} requestedModuleSelection={moduleSelectionRequest} isCourseEditing={isCourseEditing} onToggleCourseEditing={() => setIsCourseEditing(value => !value)} onUpdate={updated => dispatch(updatePlan(updated))} onDelete={() => {}} />
    </div>
    {showBookmarks && <WorkspaceBookmarksDrawer items={bookmarkItems} query={bookmarkQuery} onQueryChange={setBookmarkQuery} type={bookmarkType} onTypeChange={setBookmarkType} types={COURSE_BOOKMARK_TYPES} description="Jump directly to saved modules and videos in this course." onOpen={openBookmark} onClose={() => setShowBookmarks(false)} />}
    {showOverview && <><div className="drawer-overlay" onClick={() => setShowOverview(false)} /><aside className="drawer"><div className="drawer-header course-overview-drawer-header"><div><h2>{course.title}</h2>{course.description && <p>{course.description}</p>}</div><button className="btn btn-secondary btn-sm" onClick={() => setShowOverview(false)}><CloseIcon /></button></div><div className="drawer-body">
      {refreshError && <div className="alert alert-error">{refreshError}</div>}
      {stagedVideoCount > 0 && <section className="refresh-review refresh-review-notification"><div><h3>⚠️ New video feed ready</h3><p>{stagedVideoCount} new video{stagedVideoCount === 1 ? '' : 's'} staged across {stagedFeeds.length} source{stagedFeeds.length === 1 ? '' : 's'}.</p></div><button className="btn btn-secondary btn-sm" onClick={() => { setFeedReviewTab('visual'); setFeedReviewSearch(''); setFeedReviewSort('name'); setShowFeedReview(true) }}>Review new videos</button></section>}
      <section className="overview-summary"><div className="overview-progress"><div className="plan-progress-heading"><span>Learning progress</span><strong>{progress}%</strong></div><div className="plan-progress-track"><span style={{ width: `${progress}%` }} /></div></div><div className="plan-card-counters"><span>{course.modules?.length || 0} modules</span><span>{watched}/{progressVideoCount} watched</span><span>{bookmarked} bookmarked</span><span>{markedForDelete} marked</span></div></section>
      <section className="workspace-source-section"><div className="source-section-heading"><h3>Content sources</h3></div><p className="course-source-meta">Last sync: {syncMetadata?.updated_at ? new Date(syncMetadata.updated_at).toLocaleString() : 'Not synced yet'}</p>{course.source_channels?.length ? <div className="course-source-list">{course.source_channels.map(channel => { const logo = channel.thumbnail || channel.logo || channel.logo_url; return <div className="course-source-item" key={channel.channel_id}>{logo ? <img src={logo} alt="" className="course-source-logo" /> : <div className="course-source-logo course-source-logo-fallback">{channel.title?.charAt(0).toUpperCase() || '?'}</div>}<div className="course-source-details"><div className="course-source-title">{channel.url ? <a href={channel.url} target="_blank" rel="noreferrer">{channel.title}</a> : channel.title}</div><div className="course-source-meta">{channel.videos_count ?? channel.video_count ?? 0} videos</div><div className="course-source-playlists"><strong>Playlists</strong>{channel.playlists?.length ? channel.playlists.map(playlist => <div className="course-source-playlist" key={playlist.id || playlist.playlist_id}>{playlist.thumbnail && <img src={playlist.thumbnail} alt="" />}<span>{playlist.title}</span></div>) : <span className="course-source-meta">All channel videos</span>}</div></div></div> })}</div> : <p>No sources recorded.</p>}</section>
    </div></aside></>}
    {showFeedReview && <><div className="drawer-overlay" onClick={() => setShowFeedReview(false)} /><aside className="drawer left-refresh-feed-drawer"><div className="drawer-header"><h2>Review new video feed</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowFeedReview(false)}><CloseIcon /></button></div><div className="refresh-feed-tabs"><button className={feedReviewTab === 'visual' ? 'active' : ''} onClick={() => setFeedReviewTab('visual')}>Visual</button><button className={feedReviewTab === 'json' ? 'active' : ''} onClick={() => setFeedReviewTab('json')}>Raw JSON</button></div><div className="refresh-feed-dialog-body">{feedReviewTab === 'visual' ? <><div className="refresh-feed-toolbar"><input value={feedReviewSearch} onChange={event => setFeedReviewSearch(event.target.value)} placeholder="Search new videos..." /><div className="picker-sort-toggle"><button className={feedReviewSort === 'name' ? 'active' : ''} onClick={() => setFeedReviewSort('name')}>Name</button><button className={feedReviewSort === 'date' ? 'active' : ''} onClick={() => setFeedReviewSort('date')}>Date</button></div></div><div className="refresh-feed-visual-list">{reviewVideos.map(video => <article className="refresh-feed-video-card" key={video.video_id}>{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <div className="refresh-feed-video-thumb" />}<div><strong><em>{video.sequence || '—'}.</em> {video.title || 'Untitled video'}</strong><span>{video.feed.playlist_id ? `Playlist: ${video.feed.playlist_id}` : 'Channel feed'} · {video.published_at ? new Date(video.published_at).toLocaleDateString() : 'Date unavailable'} · {formatDuration(video.duration_secs)}</span>{video.description && <p>{video.description}</p>}</div></article>)}{reviewVideos.length === 0 && <p className="refresh-feed-empty">No videos match this search.</p>}</div></> : <pre className="refresh-feed-json">{JSON.stringify(stagedFeeds, null, 2)}</pre>}</div><div className="drawer-footer"><button className="btn btn-secondary" onClick={() => setShowFeedReview(false)}>Cancel</button><button className="btn btn-success" disabled={refreshLoading} onClick={submitRefresh}>{refreshLoading ? 'Submitting…' : 'Submit to course'}</button></div></aside></>}
    {showMobileActions && (
      <>
        <div className="drawer-overlay mobile-page-actions-overlay" onClick={() => setShowMobileActions(false)} />
        <aside className="drawer mobile-page-actions-drawer">
          <div className="drawer-header">
            <div className="mobile-action-drawer-heading">
              <span className="mobile-action-drawer-icon"><WorkspaceIcon name="menu" /></span>
              <div><small>Learning workspace</small><h2>Course actions</h2></div>
            </div>
            <button className="mobile-action-drawer-close" onClick={() => setShowMobileActions(false)} aria-label="Close"><CloseIcon /></button>
          </div>
          <div className="drawer-body">
            <div className="mobile-course-consolidated-actions">
              {renderCourseActions("mobile-drawer-actions")}
              <div className="workspace-breadcrumb-actions mobile-course-portal-actions" ref={setWorkspaceActionHost} />
              <div className="workspace-header-tree-controls mobile-course-tree-controls" ref={setWorkspaceToolbarHost} />
            </div>
          </div>
        </aside>
      </>
    )}
  </div>
}
