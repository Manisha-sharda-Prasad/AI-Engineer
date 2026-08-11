import { createSlice } from '@reduxjs/toolkit'

const privatePlanSyncSlice = createSlice({
  name: 'privatePlanSync',
  initialState: {
    networkOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    authAvailable: false,
    reason: null,
    userId: null,
    hydrated: false,
    pendingByPlan: {},
    syncingPlanId: null,
    syncError: null,
  },
  reducers: {
    setNetworkOnline: (state, action) => {
      state.networkOnline = Boolean(action.payload)
      if (!state.networkOnline) state.reason = 'network'
      else if (state.reason === 'network') state.reason = null
    },
    setApiAvailability: (state, action) => {
      if (typeof action.payload.networkOnline === 'boolean') state.networkOnline = action.payload.networkOnline
      if (typeof action.payload.authAvailable === 'boolean') state.authAvailable = action.payload.authAvailable
      if (Object.prototype.hasOwnProperty.call(action.payload, 'reason')) state.reason = action.payload.reason
    },
    startPrivateSyncSession: (state, action) => {
      state.userId = action.payload.userId
      state.authAvailable = true
      state.pendingByPlan = action.payload.pendingByPlan || {}
      state.hydrated = true
      state.reason = state.networkOnline ? null : 'network'
    },
    endPrivateSyncSession: state => {
      state.authAvailable = false
      state.userId = null
      state.hydrated = false
      state.pendingByPlan = {}
      state.syncingPlanId = null
      state.syncError = null
      state.reason = 'auth'
    },
    queueProgressUpdate: (state, action) => {
      const { planId, baseUpdatedAt, ...change } = action.payload
      const pendingPlan = state.pendingByPlan[planId] || {
        baseUpdatedAt: baseUpdatedAt || null,
        videos: {},
      }
      const current = pendingPlan.videos[change.videoId] || {}
      pendingPlan.videos[change.videoId] = {
        ...current,
        ...change,
        changedAt: change.changedAt || new Date().toISOString(),
      }
      state.pendingByPlan[planId] = pendingPlan
      state.syncError = null
    },
    clearPendingProgress: (state, action) => {
      delete state.pendingByPlan[action.payload]
      state.syncError = null
    },
    setProgressSyncing: (state, action) => {
      state.syncingPlanId = action.payload || null
      state.syncError = null
    },
    setProgressSyncError: (state, action) => {
      state.syncingPlanId = null
      state.syncError = action.payload || 'Unable to sync progress.'
    },
  },
})

export const {
  clearPendingProgress,
  endPrivateSyncSession,
  queueProgressUpdate,
  setApiAvailability,
  setNetworkOnline,
  setProgressSyncError,
  setProgressSyncing,
  startPrivateSyncSession,
} = privatePlanSyncSlice.actions

export const selectPendingPlanProgress = (state, planId) => state.privatePlanSync.pendingByPlan[planId] || null
export const selectPendingProgressCount = (state, planId) => Object.keys(selectPendingPlanProgress(state, planId)?.videos || {}).length
export const selectPrivateApiAvailable = state => state.privatePlanSync.networkOnline && state.privatePlanSync.authAvailable

export default privatePlanSyncSlice.reducer
