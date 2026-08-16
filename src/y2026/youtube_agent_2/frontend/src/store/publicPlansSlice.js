import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import { getPublicPlan, getPublicPlans } from '../api/client'

export const PUBLIC_PLANS_PAGE_SIZE = 20

export const loadPublicPlansPage = createAsyncThunk(
  'publicPlans/loadPage',
  async ({ offset = 0, limit = PUBLIC_PLANS_PAGE_SIZE } = {}) => getPublicPlans({ offset, limit }),
  {
    condition: ({ offset = 0, force = false } = {}, { getState }) => {
      if (force) return true
      const page = getState().publicPlans.pages[String(offset)]
      return !page || !['loading', 'ready'].includes(page.status)
    },
  },
)

export const loadPublicPlanDetail = createAsyncThunk(
  'publicPlans/loadDetail',
  async shareId => ({ shareId, plan: await getPublicPlan(shareId) }),
  {
    condition: (shareId, { getState }) => {
      const detail = getState().publicPlans.details[shareId]
      return !detail || !['loading', 'ready'].includes(detail.status)
    },
  },
)

const publicPlansSlice = createSlice({
  name: 'publicPlans',
  initialState: {
    pages: {},
    details: {},
    offset: 0,
    limit: PUBLIC_PLANS_PAGE_SIZE,
    total: 0,
  },
  reducers: {
    setPublicPlansOffset: (state, action) => {
      const requestedOffset = Math.max(0, Number(action.payload) || 0)
      state.offset = Math.floor(requestedOffset / state.limit) * state.limit
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadPublicPlansPage.pending, (state, action) => {
        const offset = action.meta.arg?.offset || 0
        const current = state.pages[String(offset)] || { items: [] }
        state.pages[String(offset)] = { ...current, status: 'loading', error: null }
      })
      .addCase(loadPublicPlansPage.fulfilled, (state, action) => {
        const offset = action.payload.offset || 0
        state.pages[String(offset)] = {
          items: action.payload.plans || [],
          status: 'ready',
          error: null,
        }
        state.limit = action.payload.limit || PUBLIC_PLANS_PAGE_SIZE
        state.total = action.payload.total || 0
      })
      .addCase(loadPublicPlansPage.rejected, (state, action) => {
        const offset = action.meta.arg?.offset || 0
        const current = state.pages[String(offset)] || { items: [] }
        state.pages[String(offset)] = {
          ...current,
          status: 'error',
          error: action.error.message || 'Unable to load public learning plans.',
        }
      })
      .addCase(loadPublicPlanDetail.pending, (state, action) => {
        const current = state.details[action.meta.arg] || { data: null }
        state.details[action.meta.arg] = { ...current, status: 'loading', error: null }
      })
      .addCase(loadPublicPlanDetail.fulfilled, (state, action) => {
        state.details[action.payload.shareId] = {
          data: action.payload.plan,
          status: 'ready',
          error: null,
        }
      })
      .addCase(loadPublicPlanDetail.rejected, (state, action) => {
        const current = state.details[action.meta.arg] || { data: null }
        state.details[action.meta.arg] = {
          ...current,
          status: 'error',
          error: action.error.message || 'Unable to load this published plan.',
        }
      })
  },
})

export const { setPublicPlansOffset } = publicPlansSlice.actions
export default publicPlansSlice.reducer
