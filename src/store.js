import { configureStore } from '@reduxjs/toolkit'
import dataSetReducer from './redux/DataSetSlice'
import itemInteractionReducer from './redux/ItemInteractionSlice'

export default configureStore({
  reducer: {
    // Dataset model loaded from CSV.
    dataSet: dataSetReducer,
    // Cross-view interaction model (selection / hover).
    itemInteraction: itemInteractionReducer,
  }
})
