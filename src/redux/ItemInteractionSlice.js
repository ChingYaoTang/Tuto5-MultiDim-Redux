import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  selectedItems: [],
  hoveredItem: {},
  hoveredState: null
}

export const itemInteractionSlice = createSlice({
  name: 'itemInteraction',
  initialState,
  reducers: {
    setSelectedItems: (state, action) => {
      state.selectedItems = action.payload;
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
