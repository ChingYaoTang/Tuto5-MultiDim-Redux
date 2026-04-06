import { createSlice } from '@reduxjs/toolkit'

// Beyond tutorial scope:
// Keeps interaction source + hovered state to coordinate linked views.
const initialState = {
  // Current cross-view selection (communities).
  selectedItems: [],
  // Optional source tag so one view can avoid reacting to its own dispatch.
  selectedItemsSource: null,
  // Hovered community for linked highlight.
  hoveredItem: {},
  // Hovered state code for linked highlight.
  hoveredState: null
}

const itemInteractionSlice = createSlice({
  name: 'itemInteraction',
  initialState,
  reducers: {
    setSelectedItems: (state, action) => {
      const payload = action.payload;
      // Backward-compatible shape: dispatch([items...]).
      if(Array.isArray(payload)){
        state.selectedItems = payload;
        state.selectedItemsSource = null;
        return;
      }
      // Preferred shape: dispatch({ items, source }).
      if(payload && Array.isArray(payload.items)){
        state.selectedItems = payload.items;
        state.selectedItemsSource = payload.source || null;
        return;
      }
      // Fallback: clear selection when payload is invalid.
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
