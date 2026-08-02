import React from 'react'
import { getAiModelConfigs } from '../api/client'
import DismissibleError from './DismissibleError'
import { CloseIcon } from './Icons'

function formatDuration(seconds) {
  if (!seconds) return 'Duration unavailable'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function FeedDestinationDropdown({ label, value, options, onChange, disabled = false }) {
  const [open, setOpen] = React.useState(false)
  const pickerRef = React.useRef(null)
  const selectedOption = options.find(option => option.value === value) || options[0]

  React.useEffect(() => {
    const close = event => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const choose = option => {
    onChange(option.value)
    setOpen(false)
  }

  return <div className="source-feed-picker-field">
    <span className="source-feed-picker-label">{label}</span>
    <div className="source-feed-picker" ref={pickerRef}>
      <button type="button" className="source-feed-picker-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled || !selectedOption} onClick={() => setOpen(current => !current)}>
        {selectedOption?.image
          ? <img className="source-feed-picker-icon" src={selectedOption.image} alt="" />
          : <span className="source-feed-picker-icon" aria-hidden="true">{selectedOption?.initial || '—'}</span>}
        <span className="source-feed-picker-copy">
          <strong>{selectedOption?.title || `No ${label.toLowerCase()} available`}</strong>
          {selectedOption?.meta && <small>{selectedOption.meta}</small>}
        </span>
        <span className="source-feed-picker-count" aria-label={`${options.length} options`}>{options.length}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>
      </button>
      {open && <div className="source-feed-picker-menu" role="listbox" aria-label={`Choose ${label.toLowerCase()}`}>
        <strong>{label}</strong>
        {options.map(option => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} key={option.value} onClick={() => choose(option)}>
          <span className="source-feed-picker-check">{option.value === value && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}</span>
          {option.image
            ? <img className="source-feed-picker-icon" src={option.image} alt="" />
            : <span className="source-feed-picker-icon" aria-hidden="true">{option.initial || '—'}</span>}
          <span><b>{option.title}</b>{option.meta && <small>{option.meta}</small>}</span>
        </button>)}
      </div>}
    </div>
  </div>
}

export default function SourceFeedPreviewDialog({
  preview,
  plans,
  loading,
  aiLoading,
  error,
  onClose,
  onPush,
  onOrganize,
  aiEnabled = true,
  onConfirmOrganization,
}) {
  const destinations = (preview.targets || []).map(target => {
    const plan = plans.find(item => item.id === target.plan_id)
    const course = plan?.courses?.find(item => item.id === target.course_id)
    return plan && course ? { target, plan, course } : null
  }).filter(Boolean)
  const [courseKey, setCourseKey] = React.useState('')
  const [destinationType, setDestinationType] = React.useState('existing')
  const [moduleId, setModuleId] = React.useState('')
  const [newCourseTitle, setNewCourseTitle] = React.useState('')
  const [newModuleTitle, setNewModuleTitle] = React.useState('')
  const [selectedVideoIds, setSelectedVideoIds] = React.useState([])
  const [aiProposal, setAiProposal] = React.useState(null)
  const [aiError, setAiError] = React.useState('')
  const [rethinkPrompt, setRethinkPrompt] = React.useState('')
  const [aiModels, setAiModels] = React.useState([])
  const [aiModelsLoading, setAiModelsLoading] = React.useState(true)
  const [selectedModelId, setSelectedModelId] = React.useState('')
  const [showManualConfirmation, setShowManualConfirmation] = React.useState(false)
  const [organizationMode, setOrganizationMode] = React.useState('manual')

  React.useEffect(() => {
    if (!aiEnabled) {
      setAiModelsLoading(false)
      return undefined
    }
    let active = true
    getAiModelConfigs({ enabled: true }).then(data => {
      if (!active) return
      const available = data.items || []
      const defaultModel = available.find(model => model.is_default) || available[0]
      setAiModels(available)
      setSelectedModelId(defaultModel?.id || '')
    }).catch(requestError => {
      if (active) setAiError(`Unable to load AI models: ${requestError.message}`)
    }).finally(() => {
      if (active) setAiModelsLoading(false)
    })
    return () => { active = false }
  }, [aiEnabled])

  React.useEffect(() => {
    const first = destinations[0]
    const fallbackPlan = plans[0]
    setCourseKey(first
      ? `${first.plan.id}:${first.course.id}`
      : fallbackPlan ? `__new_course__:${fallbackPlan.id}` : '')
    setDestinationType(first?.course.modules?.length ? 'existing' : 'new')
    setModuleId(first?.course.modules?.[0]?.id || '')
    setNewCourseTitle('')
    setNewModuleTitle(first ? '' : 'New videos')
  }, [preview.channelId, preview.playlistId, plans])

  React.useEffect(() => {
    setSelectedVideoIds([])
    setAiProposal(null)
    setAiError('')
    setRethinkPrompt('')
    setShowManualConfirmation(false)
    setOrganizationMode('manual')
  }, [preview.videos])

  React.useEffect(() => {
    setShowManualConfirmation(false)
  }, [courseKey, destinationType, moduleId, newCourseTitle, newModuleTitle])

  const selected = destinations.find(
    item => `${item.plan.id}:${item.course.id}` === courseKey
  )
  const newCoursePlanId = courseKey.startsWith('__new_course__:')
    ? courseKey.slice('__new_course__:'.length)
    : ''
  const newCoursePlan = plans.find(plan => plan.id === newCoursePlanId)
  const modules = [...(selected?.course.modules || [])]
    .sort((left, right) => (left.sequence || 0) - (right.sequence || 0))

  const selectCourse = value => {
    setCourseKey(value)
    if (value.startsWith('__new_course__:')) {
      setDestinationType('new')
      setModuleId('')
      setNewCourseTitle('')
      setNewModuleTitle('New videos')
      return
    }
    const next = destinations.find(
      item => `${item.plan.id}:${item.course.id}` === value
    )
    const firstModule = [...(next?.course.modules || [])]
      .sort((left, right) => (left.sequence || 0) - (right.sequence || 0))[0]
    setDestinationType(firstModule ? 'existing' : 'new')
    setModuleId(firstModule?.id || '')
    setNewModuleTitle('')
  }

  const canPush = selectedVideoIds.length > 0 && (
    (selected && (
      (destinationType === 'existing' && moduleId)
      || (destinationType === 'new' && newModuleTitle.trim())
    ))
    || (newCoursePlan && newCourseTitle.trim() && newModuleTitle.trim())
  )

  const allSelected = selectedVideoIds.length === preview.videos.length
  const changeSelection = updater => {
    setSelectedVideoIds(updater)
    setAiProposal(null)
    setAiError('')
    setRethinkPrompt('')
    setShowManualConfirmation(false)
  }
  const toggleAll = () => changeSelection(
    allSelected
      ? []
      : preview.videos.map(video => video.video_id || video.id).filter(Boolean)
  )
  const toggleVideo = videoId => changeSelection(current => (
    current.includes(videoId)
      ? current.filter(item => item !== videoId)
      : [...current, videoId]
  ))

  const submit = () => {
    if (!canPush) return
    setShowManualConfirmation(false)
    onPush({
      channelId: preview.channelId,
      playlistId: preview.playlistId,
      planId: selected?.plan.id || newCoursePlan.id,
      courseId: selected?.course.id || null,
      newCourseTitle: newCoursePlan ? newCourseTitle.trim() : null,
      moduleId: destinationType === 'existing' ? moduleId : null,
      newModuleTitle: destinationType === 'new' ? newModuleTitle.trim() : null,
      videoIds: selectedVideoIds,
    })
  }

  const requestOrganization = async ({ rethink = false } = {}) => {
    if (!selectedVideoIds.length) return
    setAiError('')
    try {
      const response = await onOrganize({
        channelId: preview.channelId,
        playlistId: preview.playlistId,
        videoIds: selectedVideoIds,
        modelConfigId: selectedModelId,
        userPrompt: rethink ? rethinkPrompt.trim() : null,
        previousSuggestion: rethink ? aiProposal?.proposal : null,
      })
      setAiProposal(response)
      setOrganizationMode('ai')
      setRethinkPrompt('')
    } catch (requestError) {
      setAiError(requestError.message || 'Unable to generate an AI organization proposal.')
    }
  }

  const proceedWithOrganization = async () => {
    if (!aiProposal?.proposal?.placements?.length) return
    setAiError('')
    try {
      await onConfirmOrganization({
        channelId: preview.channelId,
        playlistId: preview.playlistId,
        placements: aiProposal.proposal.placements,
      })
      setAiProposal(null)
    } catch (requestError) {
      setAiError(requestError.message || 'Unable to apply the AI organization proposal.')
    }
  }

  const destinationName = placement => {
    const plan = plans.find(item => item.id === placement.plan_id)
    const course = plan?.courses?.find(item => item.id === placement.course_id)
    const module = course?.modules?.find(item => item.id === placement.module_id)
    return {
      course: course ? `${plan.name} → ${course.title}` : placement.course_id,
      module: module?.title || placement.module_id,
    }
  }
  const selectedModel = aiModels.find(model => model.id === selectedModelId)
  const manualDestination = destinationType === 'existing'
    ? modules.find(module => module.id === moduleId)?.title
    : newModuleTitle.trim()
  const courseOptions = [
    ...destinations.map(({ plan, course }) => ({
      value: `${plan.id}:${course.id}`,
      title: course.title,
      meta: plan.name,
      image: course.logo_url || course.logo || '',
      initial: course.title?.charAt(0)?.toUpperCase() || 'C',
    })),
    ...plans.map(plan => ({
      value: `__new_course__:${plan.id}`,
      title: 'Create a new course',
      meta: `In ${plan.name}`,
      initial: '+',
    })),
  ]
  const moduleOptions = [
    ...modules.map(module => ({
      value: module.id,
      title: module.title,
      meta: `Module ${module.sequence || '—'}`,
      initial: `${module.sequence || 'M'}`,
    })),
    { value: '__new__', title: 'Create a new module', meta: 'Name it before pushing', initial: '+' },
  ]
  const selectedModuleValue = destinationType === 'new' ? '__new__' : moduleId

  return <div className="modal-overlay source-feed-preview-overlay" onMouseDown={event => {
    if (event.target === event.currentTarget && !loading && !aiLoading) onClose()
  }}>
    <section className="source-feed-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="source-feed-preview-title">
      <header className="source-feed-preview-header">
        <div>
          <h2 id="source-feed-preview-title">Preview new feed</h2>
          <p>{preview.title} · {preview.videos.length} new video{preview.videos.length === 1 ? '' : 's'}</p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={loading || aiLoading} onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </header>

      <div className="source-feed-preview-body">
        <div className="source-feed-preview-list-pane">
          <div className="source-feed-selection-toolbar">
            <label><input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all</label>
            <span>{selectedVideoIds.length} of {preview.videos.length} selected</span>
          </div>
          <div className="source-feed-preview-videos">
            {preview.videos.map(video => {
              const videoId = video.video_id || video.id
              const checked = selectedVideoIds.includes(videoId)
              return <article className={`source-feed-video-tile ${checked ? 'selected' : ''}`} key={videoId}>
                <label className="source-feed-video-select" aria-label={`Select ${video.title || 'video'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleVideo(videoId)} />
                  <span />
                </label>
                {video.thumbnail ? <img src={video.thumbnail} alt="" /> : <div className="source-feed-video-thumb" />}
                <div className="source-feed-video-copy">
                  <strong title={video.title || 'Untitled video'}>{video.title || 'Untitled video'}</strong>
                  <p>{video.description || 'No description available.'}</p>
                  <span>{video.published_at ? new Date(video.published_at).toLocaleDateString() : 'Date unavailable'} · {formatDuration(video.duration_secs)}{video.view_count ? ` · ${Number(video.view_count).toLocaleString()} views` : ''}</span>
                </div>
                {video.url && <a href={video.url} target="_blank" rel="noreferrer" aria-label={`Open ${video.title || 'video'} on YouTube`}>↗</a>}
              </article>
            })}
          </div>
        </div>

        <aside className="source-feed-destination">
          <div className="source-feed-mode-tabs" role="tablist" aria-label="Organization method">
            <button type="button" role="tab" aria-selected={organizationMode === 'manual'} className={organizationMode === 'manual' ? 'active' : ''} onClick={() => setOrganizationMode('manual')}>
              <span>Manual</span>
              <small>Choose a destination</small>
            </button>
            {aiEnabled && <button type="button" role="tab" aria-selected={organizationMode === 'ai'} className={organizationMode === 'ai' ? 'active' : ''} onClick={() => setOrganizationMode('ai')}>
              <span>Organise with AI</span>
              <small>Review suggestions</small>
            </button>}
          </div>

          {organizationMode === 'manual' ? <div className="source-feed-mode-panel" role="tabpanel">
            <div className="source-feed-panel-heading">
              <h3>Choose a destination</h3>
              <p>Add all selected videos to one course module.</p>
            </div>
            <FeedDestinationDropdown label="Course" value={courseKey} options={courseOptions} onChange={selectCourse} disabled={!courseOptions.length} />

            {destinations.length === 0 && plans.length === 0 && <DismissibleError>Create a learning plan before routing this feed.</DismissibleError>}
            {newCoursePlan && <label>
              New course name
              <input value={newCourseTitle} onChange={event => setNewCourseTitle(event.target.value)} placeholder="e.g. Advanced system design" autoFocus />
            </label>}
            {selected && <>
              <FeedDestinationDropdown
                label="Module"
                value={selectedModuleValue}
                options={moduleOptions}
                onChange={value => {
                  if (value === '__new__') {
                    setDestinationType('new')
                    setModuleId('')
                  } else {
                    setDestinationType('existing')
                    setModuleId(value)
                    setNewModuleTitle('')
                  }
                }}
              />
              {destinationType === 'new' && <label>
                    New module name
                    <input value={newModuleTitle} onChange={event => setNewModuleTitle(event.target.value)} placeholder="e.g. New videos" />
                  </label>}
            </>}
            {newCoursePlan && <>
              <FeedDestinationDropdown label="Module" value="__new__" options={[{ value: '__new__', title: 'Create a new module', meta: 'First module in this course', initial: '+' }]} onChange={() => {}} />
              <label>
                New module name
                <input value={newModuleTitle} onChange={event => setNewModuleTitle(event.target.value)} placeholder="e.g. New videos" />
              </label>
            </>}
            {showManualConfirmation && (selected || newCoursePlan) && <section className="source-feed-manual-confirmation">
              <span>Confirm manual push</span>
              <strong>{selectedVideoIds.length} video{selectedVideoIds.length === 1 ? '' : 's'}</strong>
              <p>Move to {selected?.plan.name || newCoursePlan.name} → {selected?.course.title || newCourseTitle.trim()} → {manualDestination}?</p>
              <div>
                <button className="btn btn-secondary btn-sm" disabled={loading} onClick={() => setShowManualConfirmation(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" disabled={loading} onClick={submit}>{loading ? 'Pushing…' : 'Confirm push'}</button>
              </div>
            </section>}
          </div> : <div className="source-feed-mode-panel" role="tabpanel">
            <div className="source-feed-panel-heading">
              <h3>AI organization</h3>
              <p>Let AI place each selected video, then review the proposal.</p>
            </div>
            <label>
              AI model
              <span className="source-feed-modern-select">
                <select value={selectedModelId} disabled={aiModelsLoading || aiLoading} onChange={event => { setSelectedModelId(event.target.value); setAiProposal(null); setAiError('') }}>
                  {aiModels.length === 0 && <option value="">{aiModelsLoading ? 'Loading configured models…' : 'No enabled models'}</option>}
                  {aiModels.map(model => <option key={model.id} value={model.id}>{model.name} · {model.model}</option>)}
                </select>
              </span>
            </label>
            {selectedModel && <small>{selectedModel.provider} · {selectedModel.structured_output_mode === 'auto' ? 'automatic structured output' : selectedModel.structured_output_mode}</small>}
            {!aiProposal && !aiLoading && <div className="source-feed-ai-empty">
              <strong>Ready to organise</strong>
              <p>Select videos from the feed, then generate a reviewable suggestion.</p>
            </div>}
            {aiProposal && <section className="source-feed-ai-proposal">
            <span className="source-feed-ai-kicker">AI suggestion · {aiProposal.model?.name}</span>
            <h4>Review before proceeding</h4>
            <p>{aiProposal.proposal.summary}</p>
            <div className="source-feed-ai-placements">
              {aiProposal.proposal.placements.map(placement => {
                const destination = destinationName(placement)
                const video = preview.videos.find(item => (item.video_id || item.id) === placement.video_id)
                return <article key={placement.video_id}>
                  <strong>{video?.title || placement.video_id}</strong>
                  <em>Move to</em>
                  <span>{destination.course}</span>
                  <span>Module: {destination.module}</span>
                  {placement.reason && <small>{placement.reason}</small>}
                </article>
              })}
            </div>
            <label>
              Re-think instructions
              <textarea value={rethinkPrompt} onChange={event => setRethinkPrompt(event.target.value)} placeholder="Example: Put architecture videos together and keep beginner content first." rows="3" />
            </label>
            <div className="source-feed-ai-actions">
              <button className="btn btn-secondary btn-sm" disabled={aiLoading || !rethinkPrompt.trim()} onClick={() => requestOrganization({ rethink: true })}>{aiLoading ? 'Thinking…' : 'Re-think'}</button>
              <button className="btn btn-primary btn-sm" disabled={aiLoading} onClick={proceedWithOrganization}>{aiLoading ? 'Applying…' : 'Proceed'}</button>
            </div>
            </section>}
            {aiLoading && !aiProposal && <div className="source-feed-ai-thinking"><span className="spinner" /> Organising selected videos…</div>}
          </div>}
          {(aiError || error) && <div className="source-feed-panel-errors">
            <DismissibleError message={aiError} />
            <DismissibleError message={error} />
          </div>}
        </aside>
      </div>

      <footer className="source-feed-preview-footer">
        <span>{selectedVideoIds.length} video{selectedVideoIds.length === 1 ? '' : 's'} selected</span>
        {organizationMode === 'ai'
          ? <button className="btn btn-primary" disabled={loading || aiLoading || !selectedVideoIds.length || !selectedModelId} onClick={() => requestOrganization()}>{aiLoading ? 'Organising…' : aiProposal ? 'Generate again' : 'Generate AI suggestion'}</button>
          : <button className="btn btn-primary" disabled={loading || aiLoading || !canPush} onClick={() => setShowManualConfirmation(true)}>{loading ? 'Pushing…' : `Push ${selectedVideoIds.length || ''} manually`}</button>}
      </footer>
    </section>
  </div>
}
