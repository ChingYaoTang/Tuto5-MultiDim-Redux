import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  selectedItems: [],
  selectedItemsSource: null,
  hoveredItem: {},
  hoveredState: null
}

const itemInteractionSlice = createSlice({
  name: 'itemInteraction',
  initialState,
  reducers: {
    setSelectedItems: (state, action) => {
      const payload = action.payload;
      if(Array.isArray(payload)){
        state.selectedItems = payload;
        state.selectedItemsSource = null;
        return;
      }
      if(payload && Array.isArray(payload.items)){
        state.selectedItems = payload.items;
        state.selectedItemsSource = payload.source || null;
        return;
      }
      state.selectedItems = [];
      state.selectedItemsSource = payload && payload.source ? payload.source : null;
    },
    setHoveredItem: (state, action) => {
      state.hoveredItem = action.payload;
    },
    setHoveredState: (state, action) => {
      state.hoveredState = action.payload;
    }
  }
})

export const { setSelectedItems, setHoveredItem, setHoveredState } = itemInteractionSlice.actions

export default itemInteractionSlice.reducer
