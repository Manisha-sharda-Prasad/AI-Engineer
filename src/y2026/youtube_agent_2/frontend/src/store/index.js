import { configureStore } from '@reduxjs/toolkit'
import plansReducer from './plansSlice'
import sourcesReducer from './sourcesSlice'
import dashboardReducer from './dashboardSlice'
import aiModelsReducer from './aiModelsSlice'
import learningUiReducer from './learningUiSlice'
import publicPlansReducer from './publicPlansSlice'
import privatePlanSyncReducer from './privatePlanSyncSlice'

export const store = configureStore({
  reducer: {
    plans: plansReducer,
    sources: sourcesReducer,
    dashboard: dashboardReducer,
    aiModels: aiModelsReducer,
    learningUi: learningUiReducer,
    publicPlans: publicPlansReducer,
    privatePlanSync: privatePlanSyncReducer,
  },
})
