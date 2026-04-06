import { configureStore } from '@reduxjs/toolkit'
import dataSetReducer from './redux/DataSetSlice'
import itemInteractionReducer from './redux/ItemInteractionSlice'

export default configureStore({
  reducer: {
    dataSet: dataSetReducer,
    itemInteraction: itemInteractionReducer,
  }
})
