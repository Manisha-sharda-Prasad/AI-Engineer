import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import AddCourseModal from './AddCourseModal'
import AiCourseModal from './AiCourseModal'
import DismissibleError from './DismissibleError'
import { deleteCourses, getPlan, isApiUnavailableError, movePlanVideos, reorderCourseVideos, updateCourseLabels, updateCourseMetadata, updateModuleLabels, updateVideoLabels, updateVideoPlayback } from '../api/client'
import { CloseIcon, LabelIcon, WorkspaceIcon } from './Icons'
import { FeedDestinationDropdown } from './SourceFeedPreviewDialog'
import {
  DEFAULT_WORKSPACE_STATE,
  rememberLearningLocation,
  selectWorkspaceState,
  updateWorkspace,
} from '../store/learningUiSlice'
import { getVideoProgress } from '../utils/videoProgress'
import { applyLocalVideoProgress } from '../store/plansSlice'
import { queueProgressUpdate, selectPrivateApiAvailable } from '../store/privatePlanSyncSlice'

function WorkspaceFilterDrawer({ modules, videoLabels, moduleIds, setVideoLabels, setModuleIds, deletedVideoVisibility, setDeletedVideoVisibility, onClose }) {
  const toggle = (values, value, setter) => setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value])
  return <><div className="drawer-overlay workspace-filter-overlay" onClick={onClose} /><aside className="drawer workspace-filter-drawer"><div className="drawer-header"><h2>Filters</h2><button className="btn btn-secondary btn-sm" onClick={onClose}><CloseIcon /></button></div><div className="drawer-body"><section className="workspace-filter-section"><label>Deleted videos</label><div className="sort-toggle"><button className={deletedVideoVisibility === 'hide' ? 'active' : ''} onClick={() => setDeletedVideoVisibility('hide')}>Hide</button><button className={deletedVideoVisibility === 'include' ? 'active' : ''} onClick={() => setDeletedVideoVisibility('include')}>Include</button><button className={deletedVideoVisibility === 'only' ? 'active' : ''} onClick={() => setDeletedVideoVisibility('only')}>Only marked</button></div></section><section className="workspace-filter-section"><label>Filter by video label</label>{[['watched', 'Watched'], ['unwatched', 'Unwatched'], ['bookmarked', 'Bookmarked']].map(([value, text]) => <label className="filter-checkbox" key={value}><input type="checkbox" checked={videoLabels.includes(value)} onChange={() => toggle(videoLabels, value, setVideoLabels)} />{text}</label>)}</section><section className="workspace-filter-section workspace-module-filter"><label>Filter by modules</label>{modules.map((module, index) => <label className="filter-checkbox" key={module.id}><input type="checkbox" checked={moduleIds.includes(module.id)} onChange={() => toggle(moduleIds, module.id, setModuleIds)} /><span className="module-filter-label"><small>Module {module.sequence || index + 1}</small>{module.title}</span></label>)}</section></div><div className="drawer-footer"><button className="btn btn-secondary" onClick={() => { setVideoLabels([]); setModuleIds([]); setDeletedVideoVisibility('hide') }}>Clear</button><button className="btn btn-primary" onClick={onClose}>Apply</button></div></aside></>
}

let youtubeApiPromise
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise
  youtubeApiPromise = new Promise(resolve => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { previousReady?.(); resolve(window.YT) }
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })
  return youtubeApiPromise
}

function YouTubePlayer({ videoId, startSeconds = 0, onPause, onComplete }) {
  const hostRef = useRef(null)
  useEffect(() => {
    let player
    let disposed = false
    loadYouTubeApi().then(YT => {
      if (disposed || !hostRef.current) return
      player = new YT.Player(hostRef.current, {
        videoId,
        playerVars: { autoplay: 0, start: Math.floor(startSeconds), enablejsapi: 1, origin: window.location.origin },
        events: {
          onStateChange: event => {
            if (event.data === YT.PlayerState.PAUSED) onPause?.(event.target.getCurrentTime())
            if (event.data === YT.PlayerState.ENDED) onComplete?.()
          },
        },
      })
    })
    return () => { disposed = true; player?.destroy() }
  }, [videoId])
  return <div ref={hostRef} className="youtube-player-host" />
}

function CollapsedVideoDescription({ description, onShowMore }) {
  const descriptionRef = useRef(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const element = descriptionRef.current
    if (!element) {
      setIsOverflowing(false)
      return undefined
    }

    const measureOverflow = () => {
      setIsOverflowing(element.scrollHeight > element.clientHeight + 1)
    }
    const animationFrame = window.requestAnimationFrame(measureOverflow)
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measureOverflow)
    resizeObserver?.observe(element)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
    }
  }, [description])

  if (!description) return null

  return <>
    <p ref={descriptionRef}>{description}</p>
    {isOverflowing && <button className="video-description-more" onClick={onShowMore}>Show more</button>}
  </>
}

export default function PlanDetail({ plan, onUpdate, onDelete, workspaceCourseId, workspaceActionHost, workspaceOutlineHost, workspaceToolbarHost, isCourseEditing = false, onToggleCourseEditing, onActiveModuleChange, onActiveVideoChange }) {
  const dispatch = useDispatch()
  const rememberedWorkspace = useSelector(state => workspaceCourseId
    ? selectWorkspaceState(state, plan.id, workspaceCourseId)
    : DEFAULT_WORKSPACE_STATE)
  const privateApiAvailable = useSelector(selectPrivateApiAvailable)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeCourseId, setActiveCourseId] = useState(workspaceCourseId || null)
  const [expandedModules, setExpandedModules] = useState(() => Object.fromEntries(rememberedWorkspace.expandedModuleIds.map(id => [id, true])))
  const [activeVideo, setActiveVideo] = useState(() => plan.courses
    ?.flatMap(course => course.modules || [])
    .flatMap(module => module.videos || [])
    .find(video => video.video_id === rememberedWorkspace.activeVideoId) || null)
  const [courseSearch, setCourseSearch] = useState(rememberedWorkspace.search)
  const [selectedVideoIds, setSelectedVideoIds] = useState([])
  const [workspaceBulkAction, setWorkspaceBulkAction] = useState('select_all')
  const [workspaceBulkMenuOpen, setWorkspaceBulkMenuOpen] = useState(false)
  const [bulkVideoUpdating, setBulkVideoUpdating] = useState(false)
  const [labelError, setLabelError] = useState('')
  const [videoLabelFilters, setVideoLabelFilters] = useState(rememberedWorkspace.videoLabelFilters)
  const [deletedVideoVisibility, setDeletedVideoVisibility] = useState(rememberedWorkspace.deletedVideoVisibility)
  const [showVideoFilter, setShowVideoFilter] = useState(false)
  const [moduleFilters, setModuleFilters] = useState(rememberedWorkspace.moduleFilters)
  const [showDescriptionDrawer, setShowDescriptionDrawer] = useState(false)
  const [showModuleTree, setShowModuleTree] = useState(false)
  const [revealedVideoActions, setRevealedVideoActions] = useState(null)
  const [revealedModuleActions, setRevealedModuleActions] = useState(null)
  const moduleTreeRef = useRef(null)
  const activeVideoRowRef = useRef(null)
  const videoSwipeRef = useRef(null)
  const moduleSwipeRef = useRef(null)
  const suppressVideoClickRef = useRef(false)
  const suppressModuleClickRef = useRef(false)
  const [draggedVideo, setDraggedVideo] = useState(null)
  const draggedVideoRef = useRef(null)
  const [pendingVideoMove, setPendingVideoMove] = useState(null)
  const [showBulkMove, setShowBulkMove] = useState(false)
  const [bulkMoveCourseId, setBulkMoveCourseId] = useState('')
  const [bulkMoveModuleId, setBulkMoveModuleId] = useState('')

  useEffect(() => {
    if (!isCourseEditing) {
      setSelectedVideoIds([])
      setWorkspaceBulkAction('select_all')
      setWorkspaceBulkMenuOpen(false)
    }
    setRevealedVideoActions(null)
    setRevealedModuleActions(null)
  }, [isCourseEditing])

  useEffect(() => {
    setRevealedVideoActions(null)
    setRevealedModuleActions(null)
  }, [activeCourseId])

  // Build tab list: Overview + each course
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(plan.courses || []).map(c => ({ id: c.id, label: c.title }))
  ]
  const [activeTab, setActiveTab] = useState(workspaceCourseId || 'overview')

  const activeCourse = plan.courses?.find(c => c.id === activeCourseId) || null
  function saveProgressLocally(course, module, video, changes) {
    const changedAt = new Date().toISOString()
    const payload = {
      planId: plan.id,
      baseUpdatedAt: plan.updated_at,
      courseId: course.id,
      moduleId: module.id,
      videoId: video.video_id,
      changedAt,
      ...changes,
    }
    dispatch(applyLocalVideoProgress(payload))
    dispatch(queueProgressUpdate(payload))
    setActiveVideo(current => {
      if (current?.video_id !== video.video_id) return current
      const updated = { ...current }
      if (typeof changes.watched === 'boolean') {
        updated.watched = changes.watched
        const labels = (updated.labels || []).filter(label => label !== 'watched')
        updated.labels = changes.watched ? [...labels, 'watched'] : labels
      }
      if (Number.isFinite(changes.positionSecs)) {
        updated.last_played_position_secs = changes.positionSecs
        updated.last_played_at = changedAt
      }
      return updated
    })
  }

  useEffect(() => {
    if (!activeVideo) return
    const current = plan.courses?.flatMap(course => course.modules || []).flatMap(module => module.videos || []).find(video => video.video_id === activeVideo.video_id)
    if (current && current !== activeVideo) setActiveVideo(current)
  }, [plan])

  useEffect(() => {
    if (!workspaceCourseId || activeVideo || !activeCourse?.last_played_video_id) return
    const lastPlayedVideo = activeCourse.modules
      ?.flatMap(module => module.videos || [])
      .find(video => video.video_id === activeCourse.last_played_video_id)
    if (lastPlayedVideo) {
      setActiveVideo(lastPlayedVideo)
      const module = activeCourse.modules?.find(item => item.videos?.some(video => video.video_id === lastPlayedVideo.video_id))
      if (module) {
        setExpandedModules(previous => ({ ...previous, [module.id]: true }))
        window.setTimeout(() => document.querySelector('.module-video-item.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0)
      }
      onActiveModuleChange?.(module ? { sequence: module.sequence || activeCourse.modules.indexOf(module) + 1, total: activeCourse.modules.length, title: module.title } : null)
      onActiveVideoChange?.(module ? { sequence: lastPlayedVideo.sequence || module.videos.indexOf(lastPlayedVideo) + 1, total: module.videos.length, title: lastPlayedVideo.title } : null)
    }
  }, [workspaceCourseId, activeCourse, activeVideo, onActiveModuleChange])
  const normalizedCourseSearch = courseSearch.trim().toLowerCase()
  const visibleModules = activeCourse?.modules
    ?.map(module => {
      const moduleMatches = module.title?.toLowerCase().includes(normalizedCourseSearch)
      const matchingVideos = module.videos?.filter(video => {
        if (video.video_id === activeVideo?.video_id) return true
        const markedForDelete = video.labels?.includes('mark_for_delete')
        const watched = video.labels?.includes('watched')
        const filterWatched = videoLabelFilters.includes('watched')
        const filterUnwatched = videoLabelFilters.includes('unwatched')
        const labelFilters = videoLabelFilters.filter(label => !['watched', 'unwatched'].includes(label))
        const matchesWatchStatus = (!filterWatched && !filterUnwatched) || (filterWatched && filterUnwatched) || (filterWatched ? watched : !watched)
        const matchesDeleteVisibility = deletedVideoVisibility === 'include' || (deletedVideoVisibility === 'only' ? markedForDelete : !markedForDelete)
        return (!normalizedCourseSearch || moduleMatches || video.title?.toLowerCase().includes(normalizedCourseSearch)) &&
          matchesDeleteVisibility &&
          matchesWatchStatus &&
          labelFilters.every(label => video.labels?.includes(label))
      }) || []
      return { ...module, videos: matchingVideos }
    })
    .filter(module => module.videos?.length > 0 && (
      moduleFilters.length === 0 ||
      moduleFilters.includes(module.id) ||
      module.videos.some(video => video.video_id === activeVideo?.video_id)
    )) || []
  const visibleVideoIds = [...new Set(
    visibleModules.flatMap(module => (module.videos || []).map(video => video.video_id))
  )]
  const allVisibleVideosSelected = visibleVideoIds.length > 0 &&
    visibleVideoIds.every(videoId => selectedVideoIds.includes(videoId))

  function handleCourseCreated(updatedPlan) {
    onUpdate(updatedPlan)
  }

  function withToggledLabel(labels = [], label) {
    return labels.includes(label) ? labels.filter(item => item !== label) : [...labels, label]
  }

  async function refreshPlanAfterChange() {
    const savedPlan = await getPlan(plan.id)
    onUpdate(savedPlan)
    if (activeVideo) {
      const refreshedVideo = savedPlan.courses.flatMap(course => course.modules).flatMap(module => module.videos)
        .find(video => video.video_id === activeVideo.video_id)
      if (refreshedVideo) setActiveVideo(refreshedVideo)
    }
  }

  function toggleModule(moduleId) {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
    const module = activeCourse?.modules?.find(item => item.id === moduleId)
    onActiveModuleChange?.(module ? { sequence: module.sequence || activeCourse.modules.indexOf(module) + 1, total: activeCourse.modules.length, title: module.title } : null)
  }

  function expandAllModules() {
    setExpandedModules(Object.fromEntries((activeCourse?.modules || []).map(module => [module.id, true])))
  }

  function collapseAllModules() {
    setExpandedModules({})
  }

  function toggleVideoSelection(videoId) {
    setSelectedVideoIds(previous =>
      previous.includes(videoId)
        ? previous.filter(id => id !== videoId)
        : [...previous, videoId]
    )
  }

  function toggleAllVisibleVideos() {
    setSelectedVideoIds(allVisibleVideosSelected ? [] : visibleVideoIds)
  }

  function openBulkMove() {
    const destinationCourse = (plan.courses || []).find(course => course.id !== activeCourse?.id && course.modules?.length)
      || (plan.courses || []).find(course => course.modules?.length)
    setBulkMoveCourseId(destinationCourse?.id || '')
    setBulkMoveModuleId(destinationCourse?.modules?.[0]?.id || '')
    setShowBulkMove(true)
  }

  function selectBulkMoveCourse(courseId) {
    const destinationCourse = plan.courses?.find(course => course.id === courseId)
    setBulkMoveCourseId(courseId)
    setBulkMoveModuleId(destinationCourse?.modules?.[0]?.id || '')
  }

  async function applyBulkVideoMove() {
    if (!activeCourse || !selectedVideoIds.length || !bulkMoveCourseId || !bulkMoveModuleId || bulkVideoUpdating) return
    setBulkVideoUpdating(true)
    try {
      setLabelError('')
      const response = await movePlanVideos(plan.id, {
        video_ids: selectedVideoIds,
        source_course_id: activeCourse.id,
        target_course_id: bulkMoveCourseId,
        target_module_id: bulkMoveModuleId,
      })
      onUpdate(response.plan)
      if (activeVideo && selectedVideoIds.includes(activeVideo.video_id)) {
        setActiveVideo(null)
        onActiveModuleChange?.(null)
        onActiveVideoChange?.(null)
      }
      setSelectedVideoIds([])
      setShowBulkMove(false)
    } catch (error) {
      setLabelError(error.message || 'Unable to move selected videos')
    } finally {
      setBulkVideoUpdating(false)
    }
  }

  async function applyBulkVideoLabel(label) {
    if (selectedVideoIds.length === 0 || bulkVideoUpdating) return
    const selectedIds = new Set(selectedVideoIds)
    const selectedVideos = plan.courses.flatMap(course => course.modules.flatMap(module =>
      module.videos.filter(video => selectedIds.has(video.video_id)).map(video => ({ course, module, video })),
    ))
    if (!privateApiAvailable) {
      if (label !== 'watched') {
        setLabelError('Only learning progress can be changed while offline.')
        return
      }
      selectedVideos.forEach(({ course, module, video }) => saveProgressLocally(course, module, video, { watched: !video.labels?.includes('watched') }))
      setSelectedVideoIds([])
      return
    }
    setBulkVideoUpdating(true)
    try {
      setLabelError('')
      for (const course of plan.courses) {
        for (const module of course.modules) {
          for (const video of module.videos) {
            if (selectedIds.has(video.video_id)) {
              await updateVideoLabels(plan.id, course.id, module.id, video.video_id, withToggledLabel(video.labels, label))
            }
          }
        }
      }
      onUpdate(await getPlan(plan.id))
      setSelectedVideoIds([])
    } catch (error) {
      if (label === 'watched' && isApiUnavailableError(error)) {
        selectedVideos.forEach(({ course, module, video }) => saveProgressLocally(course, module, video, { watched: !video.labels?.includes('watched') }))
        setSelectedVideoIds([])
      } else setLabelError(error.message || 'Unable to update video labels')
    } finally {
      setBulkVideoUpdating(false)
    }
  }

  function runWorkspaceBulkAction() {
    if (workspaceBulkAction === 'select_all') {
      toggleAllVisibleVideos()
      return
    }
    if (workspaceBulkAction === 'clear_selection') {
      setSelectedVideoIds([])
      return
    }
    if (workspaceBulkAction === 'move') {
      openBulkMove()
      return
    }
    if (workspaceBulkAction === 'bookmark') {
      applyBulkVideoLabel('bookmarked')
      return
    }
    if (workspaceBulkAction === 'complete') {
      applyBulkVideoLabel('watched')
      return
    }
    if (workspaceBulkAction === 'delete') applyBulkVideoLabel('mark_for_delete')
  }

  async function toggleVideoLabel(video, label) {
    const location = plan.courses.flatMap(course => course.modules.map(module => ({ course, module })))
      .find(({ module }) => module.videos.some(item => item.video_id === video.video_id))
    if (!location) return
    const nextWatched = !video.labels?.includes('watched')
    if (!privateApiAvailable) {
      if (label === 'watched') saveProgressLocally(location.course, location.module, video, { watched: nextWatched })
      else setLabelError('Only learning progress can be changed while offline.')
      return
    }
    try {
      setLabelError('')
      const response = await updateVideoLabels(plan.id, location.course.id, location.module.id, video.video_id, withToggledLabel(video.labels, label))
      onUpdate(response.plan)
    } catch (error) {
      if (label === 'watched' && isApiUnavailableError(error)) saveProgressLocally(location.course, location.module, video, { watched: nextWatched })
      else setLabelError(error.message || 'Unable to update video labels')
    }
  }

  async function toggleCourseLabel(label) {
    if (!activeCourse) return
    try {
      setLabelError('')
      const response = await updateCourseLabels(plan.id, activeCourse.id, withToggledLabel(activeCourse.labels, label))
      onUpdate(response.plan)
    } catch (error) {
      setLabelError(error.message || 'Unable to update course labels')
    }
  }

  async function toggleModuleLabel(module, label) {
    try {
      setLabelError('')
      const response = await updateModuleLabels(plan.id, activeCourse.id, module.id, withToggledLabel(module.labels, label))
      onUpdate(response.plan)
    } catch (error) {
      setLabelError(error.message || 'Unable to update module labels')
    }
  }

  async function handleDeleteCourse(courseId) {
    try {
      setLabelError('')
      const response = await deleteCourses(plan.id, [courseId])
      onUpdate(response.plan)
      setActiveTab('overview')
      setActiveCourseId(null)
    } catch (error) {
      setLabelError(error.message || 'Unable to delete course')
    }
  }

  async function handleVideoSelect(video) {
    setRevealedVideoActions(null)
    setActiveVideo(video)
    setShowModuleTree(false)
    const course = plan.courses?.find(c =>
      c.modules?.some(m => m.videos?.some(v => v.video_id === video.video_id))
    )
    if (course) {
      setActiveTab(course.id)
      setActiveCourseId(course.id)
      const module = course.modules?.find(item => item.videos?.some(item => item.video_id === video.video_id))
      onActiveModuleChange?.(module ? { sequence: module.sequence || course.modules.indexOf(module) + 1, total: course.modules.length, title: module.title } : null)
      onActiveVideoChange?.(module ? { sequence: video.sequence || module.videos.indexOf(video) + 1, total: module.videos.length, title: video.title } : null)
    }
  }

  function handleVideoTouchStart(event, videoId) {
    const touch = event.touches?.[0]
    if (!touch) return
    videoSwipeRef.current = { videoId, x: touch.clientX, y: touch.clientY }
  }

  function handleVideoTouchEnd(event, videoId) {
    const start = videoSwipeRef.current
    const touch = event.changedTouches?.[0]
    videoSwipeRef.current = null
    if (!start || start.videoId !== videoId || !touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    suppressVideoClickRef.current = true
    setRevealedModuleActions(null)
    setRevealedVideoActions(deltaX < 0 ? videoId : null)
    window.setTimeout(() => { suppressVideoClickRef.current = false }, 0)
  }

  function handleModuleTouchStart(event, moduleId) {
    const touch = event.touches?.[0]
    if (!touch) return
    moduleSwipeRef.current = { moduleId, x: touch.clientX, y: touch.clientY }
  }

  function handleModuleTouchEnd(event, moduleId) {
    const start = moduleSwipeRef.current
    const touch = event.changedTouches?.[0]
    moduleSwipeRef.current = null
    if (!start || start.moduleId !== moduleId || !touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    suppressModuleClickRef.current = true
    setRevealedVideoActions(null)
    setRevealedModuleActions(deltaX < 0 ? moduleId : null)
    window.setTimeout(() => { suppressModuleClickRef.current = false }, 0)
  }

  async function savePlaybackPosition(seconds) {
    if (!activeCourse || !activeModule || !activeVideo) return
    const positionSecs = Math.max(0, Math.floor(seconds || 0))
    if (!privateApiAvailable) {
      saveProgressLocally(activeCourse, activeModule, activeVideo, { positionSecs })
      return
    }
    try {
      const response = await updateVideoPlayback(plan.id, activeCourse.id, activeModule.id, activeVideo.video_id, positionSecs)
      onUpdate(response.plan)
    } catch (error) {
      if (isApiUnavailableError(error)) saveProgressLocally(activeCourse, activeModule, activeVideo, { positionSecs })
      else setLabelError(error.message || 'Unable to save playback position')
    }
  }

  async function markActiveVideoWatched() {
    if (!activeCourse || !activeModule || !activeVideo || activeVideo.labels?.includes('watched')) return
    if (!privateApiAvailable) {
      saveProgressLocally(activeCourse, activeModule, activeVideo, { watched: true })
      return
    }
    try {
      const response = await updateVideoLabels(plan.id, activeCourse.id, activeModule.id, activeVideo.video_id, [...(activeVideo.labels || []), 'watched'])
      onUpdate(response.plan)
    } catch (error) {
      if (isApiUnavailableError(error)) saveProgressLocally(activeCourse, activeModule, activeVideo, { watched: true })
      else setLabelError(error.message || 'Unable to mark video as watched')
    }
  }

  function handleVideoDragStart(event, sourceModuleId, video) {
    const drag = { sourceModuleId, video }
    draggedVideoRef.current = drag
    setDraggedVideo(drag)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', video.video_id)
  }

  function clearDraggedVideo() {
    draggedVideoRef.current = null
    setDraggedVideo(null)
  }

  async function persistVideoMove(move) {
    if (!activeCourse) return
    try {
      setLabelError('')
      const response = await reorderCourseVideos(plan.id, activeCourse.id, {
        video_id: move.video.video_id,
        source_module_id: move.sourceModuleId,
        target_module_id: move.targetModuleId,
        target_index: move.targetIndex,
      })
      onUpdate(response.plan)
    } catch (error) {
      setLabelError(error.message || 'Unable to reorder video')
    } finally {
      clearDraggedVideo()
      setPendingVideoMove(null)
    }
  }

  function handleVideoDrop(event, targetModuleId, targetIndex) {
    event.preventDefault()
    event.stopPropagation()
    const currentDrag = draggedVideoRef.current || draggedVideo
    if (!currentDrag || currentDrag.sourceModuleId === targetModuleId && currentDrag.video.video_id === activeCourse?.modules?.find(module => module.id === targetModuleId)?.videos?.[targetIndex]?.video_id) return
    const move = { ...currentDrag, targetModuleId, targetIndex }
    if (move.sourceModuleId === targetModuleId) {
      persistVideoMove(move)
    } else {
      setPendingVideoMove(move)
    }
  }

  function handleVideoRowDrop(event, targetModuleId, visibleVideoIndex) {
    const visibleModule = visibleModules.find(module => module.id === targetModuleId)
    const targetVideo = visibleModule?.videos?.[visibleVideoIndex]
    const fullVideos = activeCourse?.modules?.find(module => module.id === targetModuleId)?.videos || []
    const anchorIndex = fullVideos.findIndex(video => video.video_id === targetVideo?.video_id)
    if (anchorIndex < 0) {
      handleVideoDrop(event, targetModuleId, fullVideos.length)
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const insertAfter = event.clientY >= bounds.top + bounds.height / 2
    handleVideoDrop(event, targetModuleId, anchorIndex + (insertAfter ? 1 : 0))
  }

  function moveVideoByOffset(event, moduleId, video, offset) {
    event.stopPropagation()
    const videos = activeCourse?.modules?.find(module => module.id === moduleId)?.videos || []
    const sourceIndex = videos.findIndex(item => item.video_id === video.video_id)
    if (sourceIndex < 0 || sourceIndex + offset < 0 || sourceIndex + offset >= videos.length) return
    persistVideoMove({
      sourceModuleId: moduleId,
      video,
      targetModuleId: moduleId,
      targetIndex: offset < 0 ? sourceIndex - 1 : sourceIndex + 2,
    })
  }

  function getYoutubeVideoId(url) {
    if (!url) return null
    let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    if (url.match(/^[a-zA-Z0-9_-]{11}$/)) return url
    return null
  }

  function formatDuration(secs) {
    if (!secs || secs <= 0) return ''
    const hours = Math.floor(secs / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    const seconds = secs % 60
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const activeCourseVideos = activeCourse?.modules?.flatMap(module => module.videos || []) || []
  const { watched: activeCourseWatched, total: activeCourseVideoCount, progress: activeCourseProgress } = getVideoProgress(activeCourseVideos)

  const youtubeVideoId = activeVideo ? getYoutubeVideoId(activeVideo.url || activeVideo.video_id) : null
  const restorePosition = activeVideo?.last_played_position_secs || (activeVideo?.video_id === activeCourse?.last_played_video_id ? activeCourse.last_played_position_secs || 0 : 0)
  const activeModule = activeCourse?.modules?.find(module => module.videos?.some(video => video.video_id === activeVideo?.video_id))
  const activeModuleSequence = activeModule ? (activeModule.sequence || activeCourse.modules.indexOf(activeModule) + 1) : null
  const activeVideoSequence = activeVideo && activeModule ? (activeVideo.sequence || activeModule.videos.findIndex(video => video.video_id === activeVideo.video_id) + 1) : null
  useEffect(() => {
    if (!activeModule?.id) return
    const desktopTreeVisible = window.matchMedia('(min-width: 901px)').matches
    if (!desktopTreeVisible && !showModuleTree) return
    setExpandedModules(current => current[activeModule.id] ? current : { ...current, [activeModule.id]: true })
  }, [activeModule?.id, showModuleTree])

  useEffect(() => {
    if (!activeVideo?.video_id || !expandedModules[activeModule?.id]) return undefined
    const desktopTreeVisible = window.matchMedia('(min-width: 901px)').matches
    if (!desktopTreeVisible && !showModuleTree) return undefined
    const animationFrame = window.requestAnimationFrame(() => {
      const tree = moduleTreeRef.current
      const row = activeVideoRowRef.current
      if (!tree || !row) return
      const treeBounds = tree.getBoundingClientRect()
      const rowBounds = row.getBoundingClientRect()
      const top = tree.scrollTop + rowBounds.top - treeBounds.top - Math.max(0, (tree.clientHeight - rowBounds.height) / 2)
      tree.scrollTo({ top: Math.max(0, top) })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [activeModule?.id, activeVideo?.video_id, expandedModules, showModuleTree])

  useEffect(() => {
    if (!workspaceCourseId) return
    const activeModuleId = activeModule?.id || rememberedWorkspace.activeModuleId || null
    dispatch(updateWorkspace({
      planId: plan.id,
      courseId: workspaceCourseId,
      changes: {
        activeModuleId,
        activeVideoId: activeVideo?.video_id || null,
        expandedModuleIds: Object.keys(expandedModules).filter(id => expandedModules[id]),
        search: courseSearch,
        videoLabelFilters,
        moduleFilters,
        deletedVideoVisibility,
      },
    }))
    dispatch(rememberLearningLocation({
      planId: plan.id,
      courseId: workspaceCourseId,
      moduleId: activeModuleId,
      videoId: activeVideo?.video_id || null,
    }))
  }, [
    activeModule?.id,
    activeVideo?.video_id,
    courseSearch,
    deletedVideoVisibility,
    dispatch,
    expandedModules,
    moduleFilters,
    plan.id,
    rememberedWorkspace.activeModuleId,
    videoLabelFilters,
    workspaceCourseId,
  ])
  const allModulesExpanded = Boolean(activeCourse?.modules?.length) && activeCourse.modules.every(module => expandedModules[module.id])
  const workspaceBulkActionOptions = [
    { id: 'select_all', label: allVisibleVideosSelected ? 'Deselect visible' : 'Select all visible', tone: 'select', icon: <WorkspaceIcon name={allVisibleVideosSelected ? 'deselectAll' : 'selectAll'} /> },
    { id: 'clear_selection', label: 'Clear selection', tone: 'clear', icon: <WorkspaceIcon name="deselectAll" /> },
    { id: 'move', label: 'Move selected', tone: 'move', icon: <WorkspaceIcon name="move" /> },
    { id: 'bookmark', label: 'Toggle bookmark', tone: 'bookmark', icon: <LabelIcon label="bookmarked" /> },
    { id: 'complete', label: 'Toggle complete', tone: 'complete', icon: <LabelIcon label="watched" /> },
    { id: 'delete', label: 'Toggle mark for delete', tone: 'delete', icon: <LabelIcon label="mark_for_delete" /> },
  ]
  const selectedWorkspaceBulkAction = workspaceBulkActionOptions.find(option => option.id === workspaceBulkAction) || workspaceBulkActionOptions[0]
  const workspaceOutlineAction = activeCourse && <button className="btn btn-secondary btn-sm icon-button workspace-module-tree-button" title="Open course outline" aria-label="Open course outline" aria-expanded={showModuleTree} disabled={bulkVideoUpdating} onClick={() => setShowModuleTree(true)}><WorkspaceIcon name="outline" /></button>
  const workspaceFilterAction = activeCourse && <button className="btn btn-secondary btn-sm icon-button" title="Filter videos" aria-label="Filter videos" disabled={bulkVideoUpdating} onClick={() => setShowVideoFilter(true)}><WorkspaceIcon name="filter" /></button>
  const workspaceActions = activeCourse && <>{!workspaceOutlineHost && workspaceOutlineAction}{workspaceFilterAction}</>
  const workspaceTreeToolbar = activeCourse && <div className="workspace-tree-toolbar">
    <div className="workspace-tree-actions">
      <button type="button" className="btn btn-secondary btn-sm icon-button" title={allModulesExpanded ? 'Collapse all modules' : 'Expand all modules'} aria-label={allModulesExpanded ? 'Collapse all modules' : 'Expand all modules'} disabled={bulkVideoUpdating} onClick={allModulesExpanded ? collapseAllModules : expandAllModules}><span className={`toolbar-expand-icon ${allModulesExpanded ? 'expanded' : ''}`} aria-hidden="true">▶</span></button>
      <button type="button" className={`btn btn-secondary btn-sm icon-button ${isCourseEditing ? 'active' : ''}`} title={isCourseEditing ? 'Finish editing course outline' : 'Edit course outline'} aria-label={isCourseEditing ? 'Finish editing course outline' : 'Edit course outline'} aria-pressed={isCourseEditing} disabled={bulkVideoUpdating} onClick={onToggleCourseEditing}><WorkspaceIcon name="edit" /></button>
    </div>
    <div className="workspace-module-search"><input type="search" value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Search modules or videos..." aria-label="Search modules or videos" disabled={bulkVideoUpdating} /></div>
    {isCourseEditing && <div className="workspace-inline-bulk-actions">
      <span title={`${selectedVideoIds.length} selected`}>{selectedVideoIds.length}</span>
      <div className="workspace-bulk-action-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setWorkspaceBulkMenuOpen(false) }}>
        <button type="button" className="workspace-bulk-action-trigger" aria-haspopup="listbox" aria-expanded={workspaceBulkMenuOpen} disabled={bulkVideoUpdating} onClick={() => setWorkspaceBulkMenuOpen(open => !open)}>
          <i className={`tone-${selectedWorkspaceBulkAction.tone}`}>{selectedWorkspaceBulkAction.icon}</i>
          <span>{selectedWorkspaceBulkAction.label}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
        {workspaceBulkMenuOpen && <div className="workspace-bulk-action-menu" role="listbox" aria-label="Video actions">
          {workspaceBulkActionOptions.map(option => <button type="button" key={option.id} role="option" aria-selected={workspaceBulkAction === option.id} className={workspaceBulkAction === option.id ? 'active' : ''} onClick={() => { setWorkspaceBulkAction(option.id); setWorkspaceBulkMenuOpen(false) }}>
            <i className={`tone-${option.tone}`}>{option.icon}</i>
            <span>{option.label}</span>
            {workspaceBulkAction === option.id && <b aria-hidden="true">✓</b>}
          </button>)}
        </div>}
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={runWorkspaceBulkAction} disabled={bulkVideoUpdating || (workspaceBulkAction === 'select_all' ? !visibleVideoIds.length : workspaceBulkAction === 'clear_selection' ? !selectedVideoIds.length : !selectedVideoIds.length)}>{bulkVideoUpdating ? '…' : 'Go'}</button>
    </div>}
    <span className="module-progress-ring course-progress-ring" style={{ '--module-progress': `${activeCourseProgress}%` }} title={`${activeCourseWatched} of ${activeCourseVideoCount} course videos watched`} role="progressbar" aria-label={`${activeCourse?.title || 'Course'} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={activeCourseProgress}>
      <span>{activeCourseProgress}%</span>
    </span>
  </div>
  const bulkMoveCourse = plan.courses?.find(course => course.id === bulkMoveCourseId)
  const bulkMoveModule = bulkMoveCourse?.modules?.find(module => module.id === bulkMoveModuleId)
  const bulkMoveCourseOptions = (plan.courses || []).filter(course => course.modules?.length).map(course => ({
    value: course.id,
    title: course.title,
    image: course.logo_url || course.logo || '',
    initial: course.title?.charAt(0)?.toUpperCase() || '?',
    meta: `${course.modules.length} module${course.modules.length === 1 ? '' : 's'}${course.id === activeCourse?.id ? ' · Current course' : ''}`,
  }))
  const bulkMoveModuleOptions = (bulkMoveCourse?.modules || []).map((module, index) => ({
    value: module.id,
    title: module.title,
    initial: String(module.sequence || index + 1),
    meta: `${module.videos?.length || 0} video${module.videos?.length === 1 ? '' : 's'}`,
  }))

  return (
    <div>{workspaceCourseId && workspaceOutlineHost && createPortal(workspaceOutlineAction, workspaceOutlineHost)}{workspaceCourseId && workspaceActionHost && createPortal(workspaceActions, workspaceActionHost)}{showDescriptionDrawer && activeVideo && <><div className="drawer-overlay" onClick={() => setShowDescriptionDrawer(false)} /><aside className="drawer left-description-drawer"><div className="drawer-header"><h2>{activeVideo.title}</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowDescriptionDrawer(false)}><CloseIcon /></button></div><div className="drawer-body"><p className="full-video-description">{activeVideo.description || 'No description provided.'}</p></div></aside></>}{showVideoFilter && <><div className="drawer-overlay" onClick={() => setShowVideoFilter(false)} /><aside className="drawer"><div className="drawer-header"><h2>Filters</h2><button className="btn btn-secondary btn-sm" onClick={() => setShowVideoFilter(false)}><CloseIcon /></button></div><div className="drawer-body"><section className="workspace-filter-section"><label>Deleted videos</label><div className="sort-toggle"><button className={deletedVideoVisibility === 'hide' ? 'active' : ''} onClick={() => setDeletedVideoVisibility('hide')}>Hide</button><button className={deletedVideoVisibility === 'include' ? 'active' : ''} onClick={() => setDeletedVideoVisibility('include')}>Include</button><button className={deletedVideoVisibility === 'only' ? 'active' : ''} onClick={() => setDeletedVideoVisibility('only')}>Only marked</button></div></section><div className="material-select"><label>Filter by video label</label><select multiple value={videoLabelFilters} onChange={event => setVideoLabelFilters([...event.target.selectedOptions].map(option => option.value))}><option value="watched">Watched</option><option value="unwatched">Unwatched</option><option value="bookmarked">Bookmarked</option></select></div><div className="material-select"><label>Filter by modules</label><select multiple value={moduleFilters} onChange={event => setModuleFilters([...event.target.selectedOptions].map(option => option.value))}>{activeCourse?.modules?.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}</select></div></div><div className="drawer-footer"><button className="btn btn-secondary" onClick={() => { setVideoLabelFilters([]); setModuleFilters([]); setDeletedVideoVisibility('hide') }}>Clear</button><button className="btn btn-primary" onClick={() => setShowVideoFilter(false)}>Apply</button></div></aside></>}{pendingVideoMove && <><div className="drawer-overlay" onClick={() => setPendingVideoMove(null)} /><div className="confirm-dialog"><h2>Move video to another module?</h2><p>“{pendingVideoMove.video.title}” will be moved to a different module.</p><div className="confirm-actions"><button className="btn btn-secondary" onClick={() => setPendingVideoMove(null)}>Cancel</button><button className="btn btn-primary" onClick={() => persistVideoMove(pendingVideoMove)}>Move video</button></div></div></>}
      {workspaceCourseId && workspaceToolbarHost && createPortal(workspaceTreeToolbar, workspaceToolbarHost)}
      {/* Tab bar: Overview + per-course tabs */}
      {!workspaceCourseId && <div className="plan-tab-bar" style={{ overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`plan-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id !== 'overview') {
                setActiveCourseId(tab.id)
                setSelectedVideoIds([])
              } else {
                setActiveCourseId(null)
                setSelectedVideoIds([])
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>}
      <DismissibleError message={labelError} />

      {/* OVERVIEW TAB */}
      {!workspaceCourseId && activeTab === 'overview' && (
        <div className="overview-layout">
          <div>
            {plan.description && <p style={{ color: 'var(--text-secondary)' }}>{plan.description}</p>}
          </div>

          {/* Middle scrollable 70%: Courses + source channels */}
          <div className="overview-middle">
            {/* Course details list */}
            {plan.courses && plan.courses.length > 0 && (
              <div className="course-tile-container">
                {plan.courses.map(course => {
                  const { watched: courseWatched, total: courseVideos } = getVideoProgress(course.modules?.flatMap(module => module.videos || []) || [])
                  const initial = (course.title || '?').charAt(0).toUpperCase()
                  return (
                    <div
                      key={course.id}
                      className="course-tile"
                      onClick={() => {
                        setActiveTab(course.id)
                        setActiveCourseId(course.id)
                      }}
                      style={{
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        marginBottom: '0.5rem',
                        background: 'var(--card-bg)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {course.logo ? (
                        <img src={course.logo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-color)' }} />
                      ) : (
                        <div className="channel-avatar" style={{ width: 40, height: 40, borderRadius: '50%', fontSize: '0.9rem' }}>{initial}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.title}</h4>
                        <p style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' , fontSize: '0.7rem' }}>{course.description}</p>
                      <details style={{ marginTop: '0.35rem' }}  onClick={e => e.stopPropagation()} >
                        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#666' }}>
                          Course Source  ({course.source_channels?.length || 0})
                        </summary>

                        {course.source_channels?.map(channel => (
                          <a
                            key={channel.channel_id}
                            href={channel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', textDecoration: 'none', color: 'inherit', marginTop: '0.3rem' }}
                          >
                            <img src="https://cdn.simpleicons.org/youtube/FF0000" alt="" height="14" />
                            <span>{channel.title}</span>
                          </a>
                        ))}
                      </details>
                        <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-blue">{course.modules?.length || 0} modules</span>
                          <span className="badge badge-gray">{courseVideos} videos</span>
                          <span className="badge badge-green">{courseWatched} watched</span>
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={event => { event.stopPropagation(); handleDeleteCourse(course.id) }}>
                        Delete Course
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Source Channels */}
            {plan.channels && plan.channels.length > 0 && (
              <div className="card">
                <h3>Content Source</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {plan.channels.map(c => (
                    <span key={c.channel_id} className="badge badge-gray" style={{ padding: '0.4rem 0.8rem' }}>
                      {c.title} ({c.videos_count} videos)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(!plan.courses || plan.courses.length === 0) && (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                <p>No courses yet. Use the action buttons below to add courses.</p>
              </div>
            )}
          </div>

          {/* Bottom 10%: Fixed action bar */}
          <div className="overview-bottom">
            <div className="action-bar" style={{ justifyContent: 'center', marginBottom: 0 }}>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                + Add Course Manually
              </button>
              <button className="btn btn-warning" onClick={() => setShowAiModal(true)}>
                ✨ AI Suggested Course Creation
              </button>
              <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                Delete Plan
              </button>
              {showDeleteConfirm && (
                <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
                  <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                    <h3>Delete Learning Plan</h3>
                    <p>Are you sure you want to delete "<strong>{plan.name}</strong>"? This action cannot be undone.</p>
                    <div className="confirm-actions">
                      <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                      <button className="btn btn-danger" onClick={async () => {
                        if (await onDelete(plan.id)) setShowDeleteConfirm(false)
                      }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PER-COURSE TABS */}
      {activeTab !== 'overview' && activeCourse && (
        <div className="course-layout">
          {/* Left panel: YouTube video player */}
          <div className="course-left">
            {youtubeVideoId ? (
              <div className="video-player-container">
                <div className="private-video-frame">
                  <YouTubePlayer videoId={youtubeVideoId} startSeconds={restorePosition} onPause={savePlaybackPosition} onComplete={markActiveVideoWatched} />
                  {(activeVideo?.watched || activeVideo?.labels?.includes('watched')) && <span className="private-video-watched-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Watched</span></span>}
                </div>
                <div className="video-player-info">
                  {activeModule && <div className="video-player-sequence">
                    <span>Module {activeModuleSequence}: {activeModule.title} <i>·</i> Video {activeVideoSequence}</span>
                    {activeVideo?.url && <a href={activeVideo.url} target="_blank" rel="noopener noreferrer">YouTube ↗</a>}
                  </div>}
                  <h3>{activeVideo?.title}</h3>
                  <CollapsedVideoDescription
                    description={activeVideo?.description}
                    onShowMore={() => setShowDescriptionDrawer(true)}
                  />
                </div>
              </div>
            ) : (
              <div className="no-video-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
                </svg>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select a Video</h3>
                <p>Expand a module and click a video to start watching.</p>
              </div>
            )}
          </div>

          {/* Right panel: Course modules with expandable videos */}
          {workspaceCourseId && showModuleTree && <button type="button" className="workspace-module-tree-overlay" aria-label="Close modules and chapters" onClick={() => setShowModuleTree(false)} />}
          <div ref={moduleTreeRef} className={`course-right ${workspaceCourseId ? 'workspace-module-tree' : ''} ${showModuleTree ? 'mobile-open' : ''} ${isCourseEditing ? 'editing' : ''} ${bulkVideoUpdating ? 'bulk-updating' : ''}`} aria-busy={bulkVideoUpdating}>
            {workspaceCourseId && <div className="workspace-module-tree-header"><div><span>Course outline</span><strong>{activeCourse.title}</strong></div><button type="button" className="btn btn-secondary btn-sm icon-button" aria-label="Close modules and chapters" onClick={() => setShowModuleTree(false)}><CloseIcon /></button></div>}
            {workspaceCourseId && <div className="workspace-tree-toolbar">
              <div className="workspace-tree-actions">
                 <button type="button" className="btn btn-secondary btn-sm icon-button" title={allModulesExpanded ? 'Collapse all modules' : 'Expand all modules'} aria-label={allModulesExpanded ? 'Collapse all modules' : 'Expand all modules'} disabled={bulkVideoUpdating} onClick={allModulesExpanded ? collapseAllModules : expandAllModules}><span className={`toolbar-expand-icon ${allModulesExpanded ? 'expanded' : ''}`} aria-hidden="true">▶</span></button>
                <button type="button" className={`btn btn-secondary btn-sm icon-button ${isCourseEditing ? 'active' : ''}`} title={isCourseEditing ? 'Finish editing course outline' : 'Edit course outline'} aria-label={isCourseEditing ? 'Finish editing course outline' : 'Edit course outline'} aria-pressed={isCourseEditing} disabled={bulkVideoUpdating} onClick={onToggleCourseEditing}><WorkspaceIcon name="edit" /></button>
              </div>
              <div className="workspace-module-search"><input type="search" value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Search modules or videos..." aria-label="Search modules or videos" disabled={bulkVideoUpdating} /></div>
              <span className="module-progress-ring course-progress-ring" style={{ '--module-progress': `${activeCourseProgress}%` }} title={`${activeCourseWatched} of ${activeCourseVideoCount} course videos watched`} role="progressbar" aria-label={`${activeCourse?.title || 'Course'} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={activeCourseProgress}>
                <span>{activeCourseProgress}%</span>
              </span>
            </div>}
            {!workspaceCourseId && <div className="course-module-search">
              <input
                type="search"
                value={courseSearch}
                onChange={event => setCourseSearch(event.target.value)}
                placeholder="Search modules or videos..."
                aria-label="Search modules or videos"
              />
            </div>}
            {!workspaceCourseId && <div className="label-actions">
              <span>Course labels</span>
              {['watched', 'bookmarked', 'mark_for_delete'].map(label => (
                <button key={label} className={activeCourse.labels?.includes(label) ? 'active' : ''} onClick={() => toggleCourseLabel(label)} aria-label={`Toggle ${label.replaceAll('_', ' ')}`} title={label.replaceAll('_', ' ')}>
                  <LabelIcon label={label} />
                </button>
              ))}
            </div>}
            {isCourseEditing && (
              <div className="bulk-video-actions">
                <span>{bulkVideoUpdating ? `Updating ${selectedVideoIds.length} video${selectedVideoIds.length === 1 ? '' : 's'}…` : `${selectedVideoIds.length} selected`}</span>
                <button className="btn btn-secondary btn-sm" disabled={!visibleVideoIds.length || bulkVideoUpdating} onClick={toggleAllVisibleVideos} title={allVisibleVideosSelected ? 'Deselect all videos' : 'Select all visible videos'}>
                  <WorkspaceIcon name={allVisibleVideosSelected ? 'deselectAll' : 'selectAll'} /><span>{allVisibleVideosSelected ? 'Deselect all' : 'Select all'}</span>
                </button>
                <button className="btn btn-secondary btn-sm" disabled={selectedVideoIds.length === 0 || bulkVideoUpdating || !bulkMoveCourseOptions.length} onClick={openBulkMove} title="Move selected videos to another course or module">
                  <WorkspaceIcon name="move" /><span>Move</span>
                </button>
                <button className="btn btn-secondary btn-sm" disabled={selectedVideoIds.length === 0 || bulkVideoUpdating} onClick={() => applyBulkVideoLabel('bookmarked')}>
                  <LabelIcon label="bookmarked" /><span>Bookmark</span>
                </button>
                <button className="btn btn-success btn-sm" disabled={selectedVideoIds.length === 0 || bulkVideoUpdating} onClick={() => applyBulkVideoLabel('watched')}>
                  <LabelIcon label="watched" /><span>Mark complete</span>
                </button>
                <button className="btn btn-danger btn-sm" disabled={selectedVideoIds.length === 0 || bulkVideoUpdating} onClick={() => applyBulkVideoLabel('mark_for_delete')}>
                  <LabelIcon label="mark_for_delete" /><span>Mark for delete</span>
                </button>
                {bulkVideoUpdating && <span className="bulk-video-running-bar" role="status" aria-live="polite"><i /></span>}
              </div>
            )}
            {visibleModules.map((module, moduleIndex) => {
              const isExpanded = expandedModules[module.id] || Boolean(normalizedCourseSearch)
              const courseModule = activeCourse?.modules?.find(item => item.id === module.id)
              const { watched: moduleWatched, total: moduleTotal, progress: moduleProgress } = getVideoProgress(courseModule?.videos || [])
              return (
              <div key={module.id} className={`module-tree-group ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className={`module-header ${revealedModuleActions === module.id ? 'actions-revealed' : ''}`}
                  onClick={() => {
                    if (suppressModuleClickRef.current) return
                    if (revealedModuleActions === module.id) {
                      setRevealedModuleActions(null)
                      return
                    }
                    toggleModule(module.id)
                  }}
                  onTouchStart={event => handleModuleTouchStart(event, module.id)}
                  onTouchEnd={event => handleModuleTouchEnd(event, module.id)}
                >
                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                  <span className="module-tree-title"><small>Module {module.sequence || moduleIndex + 1} · {moduleWatched}/{moduleTotal} watched</small>{module.title}</span>
                  <div className="module-label-actions" onClick={event => event.stopPropagation()}>
                    {['watched', 'bookmarked', 'mark_for_delete'].map(label => (
                      <button key={label} className={module.labels?.includes(label) ? 'active' : ''} onClick={() => toggleModuleLabel(module, label)} aria-label={`Toggle ${label.replaceAll('_', ' ')}`} title={label.replaceAll('_', ' ')}>
                        <LabelIcon label={label} />
                      </button>
                    ))}
                  </div>
                  <span className="module-progress-ring" style={{ '--module-progress': `${moduleProgress}%` }} title={`${moduleWatched} of ${moduleTotal} videos watched`} aria-label={`${moduleProgress}% complete`}>
                    <span>{moduleProgress}%</span>
                  </span>
                </div>
                <div className={`module-videos ${isExpanded ? 'expanded' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => handleVideoDrop(event, module.id, activeCourse?.modules?.find(item => item.id === module.id)?.videos?.length || 0)}>
                  <div className="module-videos-inner">
                    {module.videos?.map((video, videoIndex) => (
                      <div
                        key={video.video_id}
                        ref={activeVideo?.video_id === video.video_id ? activeVideoRowRef : null}
                        className={`module-video-item ${revealedVideoActions === video.video_id ? 'actions-revealed' : ''} ${activeVideo?.video_id === video.video_id ? 'active' : ''} ${video.labels?.includes('mark_for_delete') ? 'marked-for-delete' : video.labels?.includes('bookmarked') ? 'bookmarked-video' : video.labels?.includes('watched') ? 'watched-video' : ''}`}
                        onClick={() => {
                          if (suppressVideoClickRef.current) return
                          if (revealedVideoActions === video.video_id) {
                            setRevealedVideoActions(null)
                            return
                          }
                          handleVideoSelect(video)
                        }}
                        onTouchStart={event => handleVideoTouchStart(event, video.video_id)}
                        onTouchEnd={event => handleVideoTouchEnd(event, video.video_id)}
                        draggable={isCourseEditing && !bulkVideoUpdating}
                        onDragStart={isCourseEditing && !bulkVideoUpdating ? event => handleVideoDragStart(event, module.id, video) : undefined}
                        onDragEnd={isCourseEditing && !bulkVideoUpdating ? clearDraggedVideo : undefined}
                        onDragOver={isCourseEditing && !bulkVideoUpdating ? event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } : undefined}
                        onDrop={isCourseEditing && !bulkVideoUpdating ? event => handleVideoRowDrop(event, module.id, videoIndex) : undefined}
                      >
                        {isCourseEditing && <div className="video-reorder-actions" onClick={event => event.stopPropagation()}>
                          <button type="button" disabled={videoIndex === 0 || bulkVideoUpdating} onClick={event => moveVideoByOffset(event, module.id, video, -1)} title="Move video up" aria-label={`Move ${video.title} up`}><WorkspaceIcon name="moveUp" /></button>
                          <button type="button" disabled={videoIndex === module.videos.length - 1 || bulkVideoUpdating} onClick={event => moveVideoByOffset(event, module.id, video, 1)} title="Move video down" aria-label={`Move ${video.title} down`}><WorkspaceIcon name="moveDown" /></button>
                        </div>}
                        {isCourseEditing && <input
                          type="checkbox"
                          checked={selectedVideoIds.includes(video.video_id)}
                          onClick={event => event.stopPropagation()}
                          onChange={() => toggleVideoSelection(video.video_id)}
                          disabled={bulkVideoUpdating}
                          aria-label={`Select ${video.title}`}
                          style={{ flexShrink: 0 }}
                        />}
                        <div className="module-video-swipe-content">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="" className="module-video-thumbnail" draggable="false" />
                        ) : (
                          <div className="module-video-thumbnail module-video-thumbnail-placeholder" />
                        )}
                        <div className="module-video-content">
                          <div className="video-tree-title">{video.sequence || videoIndex + 1}. {video.title}</div>
                          <div className="video-tree-metadata">
                            <span className="video-meta-published" title="Published"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="1" /><path d="M8 3v4m8-4v4M4 10h16" /></svg>{video.published_at ? new Date(video.published_at).toLocaleDateString() : '—'}</span>
                            <span className="video-meta-duration" title="Duration"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>{formatDuration(video.duration_secs) || '—'}</span>
                            <span className="video-meta-count" title="Views"><svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>{video.view_count ? video.view_count.toLocaleString() : '—'}</span>
                            <span className="video-meta-count" title="Likes"><svg viewBox="0 0 24 24"><path d="M7 10v10H4V10h3Zm2 10h8.1a2 2 0 0 0 1.95-1.55l1.35-6A2 2 0 0 0 18.45 10H15l.55-3.25A2.3 2.3 0 0 0 13.3 4L9 10v10Z" /></svg>{video.like_count ? video.like_count.toLocaleString() : '—'}</span>
                            <span className="video-meta-labels">{(video.labels || []).filter(label => ['watched', 'bookmarked', 'mark_for_delete'].includes(label)).map(label => <span className={`video-label-badge ${label}`} key={label} title={label.replaceAll('_', ' ')}><LabelIcon label={label} /></span>)}</span>
                          </div>
                        </div>
                        </div>
                        <div className="video-label-actions" onClick={event => event.stopPropagation()}>
                          {['watched', 'bookmarked', 'mark_for_delete'].map(label => (
                            <button
                              key={label}
                              className={video.labels?.includes(label) ? 'active' : ''}
                              onClick={() => toggleVideoLabel(video, label)}
                              aria-label={`Toggle ${label.replaceAll('_', ' ')} for ${video.title}`}
                              title={label.replaceAll('_', ' ')}
                            >
                              <LabelIcon label={label} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              )
            })}
            {normalizedCourseSearch && visibleModules.length === 0 && (
              <p className="course-search-empty">No modules or videos match “{courseSearch}”.</p>
            )}
            {(!activeCourse.modules || activeCourse.modules.length === 0) && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No modules in this course.</p>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddCourseModal
          plan={plan}
          onClose={() => setShowAddModal(false)}
          onCourseCreated={handleCourseCreated}
        />
      )}
      {showAiModal && (
        <AiCourseModal
          plan={plan}
          onClose={() => setShowAiModal(false)}
        />
      )}
      {showBulkMove && <>
        <div className="drawer-overlay" onClick={() => !bulkVideoUpdating && setShowBulkMove(false)} />
        <aside className="drawer video-bulk-move-drawer" aria-labelledby="video-bulk-move-title">
          <div className="drawer-header">
            <div><small>Organize selected videos</small><h2 id="video-bulk-move-title">Move videos</h2></div>
            <button className="btn btn-secondary btn-sm icon-button" onClick={() => setShowBulkMove(false)} disabled={bulkVideoUpdating} aria-label="Close move videos"><CloseIcon /></button>
          </div>
          <div className="drawer-body video-bulk-move-body">
            <div className="video-bulk-move-summary">
              <strong>{selectedVideoIds.length} video{selectedVideoIds.length === 1 ? '' : 's'} selected</strong>
              <span>From {activeCourse?.title}</span>
            </div>
            <div className="video-bulk-move-fields">
              <FeedDestinationDropdown label="Course" value={bulkMoveCourseId} options={bulkMoveCourseOptions} onChange={selectBulkMoveCourse} disabled={bulkVideoUpdating} />
              <FeedDestinationDropdown label="Module" value={bulkMoveModuleId} options={bulkMoveModuleOptions} onChange={setBulkMoveModuleId} disabled={bulkVideoUpdating || !bulkMoveCourseId} />
            </div>
            {bulkMoveCourse && bulkMoveModule && <div className="video-bulk-move-destination"><span>Move to</span><strong>{bulkMoveCourse.title}</strong><small>{bulkMoveModule.title}</small></div>}
          </div>
          <div className="drawer-footer">
            <button className="btn btn-secondary" onClick={() => setShowBulkMove(false)} disabled={bulkVideoUpdating}>Cancel</button>
            <button className="btn btn-primary" onClick={applyBulkVideoMove} disabled={bulkVideoUpdating || !bulkMoveModuleId}>{bulkVideoUpdating ? 'Moving…' : `Move ${selectedVideoIds.length} video${selectedVideoIds.length === 1 ? '' : 's'}`}</button>
          </div>
        </aside>
      </>}
      {showVideoFilter && <WorkspaceFilterDrawer modules={activeCourse?.modules || []} videoLabels={videoLabelFilters} moduleIds={moduleFilters} setVideoLabels={setVideoLabelFilters} setModuleIds={setModuleFilters} deletedVideoVisibility={deletedVideoVisibility} setDeletedVideoVisibility={setDeletedVideoVisibility} onClose={() => setShowVideoFilter(false)} />}
    </div>
  )
}
