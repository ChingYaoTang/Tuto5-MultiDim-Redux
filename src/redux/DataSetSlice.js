import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import Papa from "papaparse"

export const getDataSet = createAsyncThunk('communities/fetchData', async (_, thunkAPI) => {
  try{
    const response = await fetch('data/communities.csv');
    const responseText = await response.text();
    const responseJson = Papa.parse(responseText,{header:true, dynamicTyping:true});
    return responseJson.data.map((item,i)=>({...item,index:i}));
  }catch(error){
    return thunkAPI.rejectWithValue(error)
  }
})

const dataSetSlice = createSlice({
  name: 'dataSet',
  initialState: [],
  extraReducers: builder => {
    builder.addCase(getDataSet.fulfilled, (_, action) => {
      return action.payload
    })
  }
})

export default dataSetSlice.reducer
