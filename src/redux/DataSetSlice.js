import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import Papa from "papaparse"

// Async data loader used by App on mount.
export const getDataSet = createAsyncThunk('communities/fetchData', async (_, thunkAPI) => {
  try{
    const response = await fetch('data/communities.csv');
    const responseText = await response.text();
    // Parse CSV once and keep numeric columns as numbers.
    const responseJson = Papa.parse(responseText,{header:true, dynamicTyping:true});
    // Add stable index used as D3 key in join().
    return responseJson.data.map((item,i)=>({...item,index:i}));
  }catch(error){
    return thunkAPI.rejectWithValue(error)
  }
})

const dataSetSlice = createSlice({
  name: 'dataSet',
  initialState: [],
  extraReducers: builder => {
    // Reducer receives async thunk result and replaces current dataset.
    builder.addCase(getDataSet.fulfilled, (_, action) => {
      return action.payload
    })
  }
})

export default dataSetSlice.reducer
