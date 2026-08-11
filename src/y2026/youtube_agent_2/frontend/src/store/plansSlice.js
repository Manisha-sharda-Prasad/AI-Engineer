import { createSlice } from '@reduxjs/toolkit'

function applyVideoProgress(plan, change) {
  const course = plan?.courses?.find(item => item.id === change.courseId)
  const module = course?.modules?.find(item => item.id === change.moduleId)
  const video = module?.videos?.find(item => item.video_id === change.videoId)
  if (!video) return
  if (typeof change.watched === 'boolean') {
    video.watched = change.watched
    const labels = (video.labels || []).filter(label => label !== 'watched')
    video.labels = change.watched ? [...labels, 'watched'] : labels
  }
  if (Number.isFinite(change.positionSecs)) {
    video.last_played_position_secs = change.positionSecs
    video.last_played_at = change.changedAt
    course.last_played_video_id = video.video_id
    course.last_played_position_secs = change.positionSecs
    course.last_played_at = change.changedAt
  }
}

const plansSlice = createSlice({
  name: 'plans',
  initialState: {
    items: [],
    selectedId: null,
  },
  reducers: {
    setPlans: (state, action) => {
      state.items = action.payload
    },
    addPlan: (state, action) => {
      state.items.push(action.payload)
    },
    updatePlan: (state, action) => {
      state.items = state.items.map(p => p.id === action.payload.id ? action.payload : p)
    },
    deletePlan: (state, action) => {
      state.items = state.items.filter(p => p.id !== action.payload)
      if (state.selectedId === action.payload) state.selectedId = null
    },
    selectPlan: (state, action) => {
      state.selectedId = action.payload
    },
    clearSelection: (state) => {
      state.selectedId = null
    },
    applyLocalVideoProgress: (state, action) => {
      const plan = state.items.find(item => item.id === action.payload.planId)
      applyVideoProgress(plan, action.payload)
    },
    applyPendingPlanProgress: (state, action) => {
      const plan = state.items.find(item => item.id === action.payload.planId)
      Object.values(action.payload.videos || {}).forEach(change => applyVideoProgress(plan, change))
    },
  },
})

export const { setPlans, addPlan, updatePlan, deletePlan, selectPlan, clearSelection, applyLocalVideoProgress, applyPendingPlanProgress } = plansSlice.actions
export default plansSlice.reducer
