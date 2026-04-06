import './App.css';
import { useEffect} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ScatterplotContainer from './components/scatterplot/ScatterplotContainer';
import HierarchyContainer from './components/hierarchy/HierarchyContainer';
import { getDataSet } from './redux/DataSetSlice';

// here import other dependencies

// a component is a piece of code which render a part of the user interface
function App() {
  const dataSetSize = useSelector((state)=>state.dataSet.length);
  const dispatch = useDispatch();

  // did mount / did unmount profile
  useEffect(()=>{
      console.log("App did mount");
      dispatch(getDataSet());
      return ()=>{
          console.log("App did unmount");
      }
  },[dispatch]);

  // update profile: runs only when dependency changes
  useEffect(()=>{
      console.log("App dependency update: dataSetSize=", dataSetSize);
  },[dataSetSize]);

  return (
    <div className="App">
        <div id={"MultiviewContainer"} className={"row"}>
          <ScatterplotContainer
            xAttributeName={"medIncome"}
            yAttributeName={"ViolentCrimesPerPop"}
            colorAttributeName={"population"}
            xAttributeOptions={[
              "medIncome",
              "PctPopUnderPov",
              "PctUnemployed",
              "PctKids2Par",
              "PctIlleg",
              "PctPersOwnOccup",
              "PctVacantBoarded",
              "racePctWhite",
              "racepctblack"
            ]}
            title={"Community Feature vs Violent Crime Risk"}
          />
          <HierarchyContainer />
        </div>
    </div>
  );
}

export default App;
