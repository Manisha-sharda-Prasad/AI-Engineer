import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { getPlan, updatePlanProgress } from '../api/client'
import { applyPendingPlanProgress, updatePlan } from '../store/plansSlice'
import {
  clearPendingProgress,
  selectPendingPlanProgress,
  selectPendingProgressCount,
  selectPrivateApiAvailable,
  setProgressSyncError,
  setProgressSyncing,
} from '../store/privatePlanSyncSlice'

export default function PrivatePlanSyncStatus({ planId }) {
  const dispatch = useDispatch()
  const pending = useSelector(state => selectPendingPlanProgress(state, planId))
  const pendingCount = useSelector(state => selectPendingProgressCount(state, planId))
  const apiAvailable = useSelector(selectPrivateApiAvailable)
  const { networkOnline, authAvailable, syncingPlanId, syncError } = useSelector(state => state.privatePlanSync)
  const [refreshing, setRefreshing] = React.useState(false)
  const syncing = syncingPlanId === planId

  const refresh = async () => {
    if (!apiAvailable || refreshing || syncing) return
    const message = pendingCount
      ? 'Refresh this plan from the backend? Your unsynced local progress will be preserved and reapplied.'
      : 'Refresh this plan from the backend and replace the cached copy?'
    if (!window.confirm(message)) return
    setRefreshing(true)
    try {
      const freshPlan = await getPlan(planId)
      dispatch(updatePlan(freshPlan))
      if (pending) dispatch(applyPendingPlanProgress({ planId, videos: pending.videos }))
    } catch (error) {
      dispatch(setProgressSyncError(error.message || 'Unable to refresh this plan.'))
    } finally {
      setRefreshing(false)
    }
  }

  const sync = async () => {
    if (!apiAvailable || !pendingCount || syncing) return
    dispatch(setProgressSyncing(planId))
    try {
      const response = await updatePlanProgress(planId, {
        base_updated_at: pending.baseUpdatedAt,
        videos: Object.values(pending.videos).map(change => ({
          course_id: change.courseId,
          module_id: change.moduleId,
          video_id: change.videoId,
          ...(typeof change.watched === 'boolean' ? { watched: change.watched } : {}),
          ...(Number.isFinite(change.positionSecs) ? { position_secs: change.positionSecs } : {}),
          changed_at: change.changedAt,
        })),
      })
      dispatch(updatePlan(response.plan))
      dispatch(clearPendingProgress(planId))
      dispatch(setProgressSyncing(null))
    } catch (error) {
      dispatch(setProgressSyncError(error.message || 'Unable to sync local progress.'))
    }
  }

  const discard = async () => {
    if (!apiAvailable || !pendingCount || syncing) return
    if (!window.confirm(`Discard ${pendingCount} unsynced progress change${pendingCount === 1 ? '' : 's'} and reload the backend copy?`)) return
    dispatch(setProgressSyncing(planId))
    try {
      const freshPlan = await getPlan(planId)
      dispatch(updatePlan(freshPlan))
      dispatch(clearPendingProgress(planId))
      dispatch(setProgressSyncing(null))
    } catch (error) {
      dispatch(setProgressSyncError(error.message || 'Unable to discard local progress.'))
    }
  }

  const unavailableLabel = !networkOnline ? 'Offline' : !authAvailable ? 'Sign-in expired' : ''
  const statusLabel = unavailableLabel || (pendingCount ? 'Progress not synced' : 'Plan synced')
  return <section className={`private-plan-sync-status ${!apiAvailable ? 'is-offline' : pendingCount ? 'has-pending' : 'is-synced'}`} aria-live="polite" aria-label={statusLabel} title={statusLabel}>
    <span className="private-plan-sync-indicator" aria-hidden="true" />
    <span className="private-plan-sync-copy">
      <strong>{statusLabel}</strong>
      <small>{!apiAvailable ? `${pendingCount ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} saved` : 'Progress will be saved'} locally` : pendingCount ? `${pendingCount} local change${pendingCount === 1 ? '' : 's'} ready to sync` : 'Connected to backend'}</small>
    </span>
    {apiAvailable && pendingCount > 0 && <button type="button" className="private-plan-sync-now" onClick={sync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</button>}
    {apiAvailable && pendingCount > 0 && <button type="button" className="private-plan-sync-discard" onClick={discard} disabled={syncing} title="Discard local progress" aria-label="Discard local progress">×</button>}
    <button type="button" className="private-plan-refresh" onClick={refresh} disabled={!apiAvailable || refreshing || syncing} title={apiAvailable ? 'Refresh plan from backend' : 'Refresh is unavailable offline'} aria-label="Refresh plan from backend">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7"/></svg>
    </button>
    {syncError && <span className="private-plan-sync-error" title={syncError}>!</span>}
  </section>
}
