import './Scatterplot.css'
import { useEffect, useRef, useState } from 'react';
import {useDispatch, useSelector} from 'react-redux'

import ScatterplotD3 from './Scatterplot-d3';
import { LIVABILITY_DIMENSIONS } from '../../livability/livabilityConfig';
import { setHoveredItem, setHoveredState, setSelectedItems } from '../../redux/ItemInteractionSlice';
import { getFriendlyAttributeLabel } from '../../utils/attributeLabels';

const ATTRIBUTE_DIRECTION_BY_FIELD = LIVABILITY_DIMENSIONS.reduce((accumulator, dimension)=>{
    accumulator[dimension.scoreField] = 'higher';
    dimension.features.forEach((feature)=>{
        accumulator[feature.field] = feature.direction;
    });
    return accumulator;
}, {});

function ScatterplotContainer({
    xAttributeName,
    yAttributeName,
    colorAttributeName,
    title,
    xAttributeOptions=[],
    yAttributeOptions=[],
    visDataOverride,
    onAxisSelectionChange
}){
    const dataSetFromStore = useSelector(state =>state.dataSet)
    const visData = visDataOverride || dataSetFromStore;
    const selectedItems = useSelector(state =>state.itemInteraction.selectedItems)
    const selectedItemsSource = useSelector(state =>state.itemInteraction.selectedItemsSource)
    const hoveredItem = useSelector(state =>state.itemInteraction.hoveredItem)
    const hoveredState = useSelector(state =>state.itemInteraction.hoveredState)
    const dispatch = useDispatch();
    const [selectedXAttribute, setSelectedXAttribute] = useState(xAttributeName);
    const [selectedYAttribute, setSelectedYAttribute] = useState(yAttributeName);

    const chartDivContainerRef=useRef(null);
    const scatterplotD3Ref = useRef(null)
    const selectedItemsRef = useRef(selectedItems);

    const isLivabilityColor = String(colorAttributeName) === 'livabilityScore';
    const colorLabelText = getFriendlyAttributeLabel(colorAttributeName);
    const colorUnitText = isLivabilityColor
        ? '0 = low livability\n1 = high livability'
        : 'normalized [0-1]'
    ;
    const getDirectionalLabel = (attributeName)=>getFriendlyAttributeLabel(attributeName);

    const chartMeta = {
        title: title || "Scatterplot",
        subtitle: `${getDirectionalLabel(selectedXAttribute)} vs ${getDirectionalLabel(selectedYAttribute)} (Color: ${colorLabelText})`,
        xLabel: getDirectionalLabel(selectedXAttribute),
        yLabel: getDirectionalLabel(selectedYAttribute),
        colorLabel: colorLabelText,
        xUnit: "normalized [0-1]",
        yUnit: "normalized [0-1]",
        colorUnit: colorUnitText
    };

    const getChartSize = function(){
        // fixed size
        // return {width:900, height:900};
        // getting size from parent item
        let width;// = 800;
        let height;// = 100;
        if(chartDivContainerRef.current!==undefined){
            width=chartDivContainerRef.current.offsetWidth;
            // width = '100%';
            height=chartDivContainerRef.current.offsetHeight;
            // height = '100%';
        }
        return {width:width,height:height};
    }

    useEffect(()=>{
        const scatterplotD3 = new ScatterplotD3(chartDivContainerRef.current);
        scatterplotD3.create({size:getChartSize()});
        scatterplotD3Ref.current = scatterplotD3;
        return ()=>{
            const scatterplotD3 = scatterplotD3Ref.current;
            if(scatterplotD3){
                scatterplotD3.clear();
            }
        }
    },[]);

    const applyBaseHighlights = function(){
        const scatterplotD3 = scatterplotD3Ref.current;
        if(!scatterplotD3){
            return;
        }
        scatterplotD3.highlightSelectedItems(selectedItems);
        scatterplotD3.highlightHoveredState(hoveredState);
    }

    const applyHoverHighlight = function(){
        const scatterplotD3 = scatterplotD3Ref.current;
        if(!scatterplotD3){
            return;
        }
        scatterplotD3.highlightHoveredItem(hoveredItem);
    }

    const renderScatterplot = function(){
        const scatterplotD3 = scatterplotD3Ref.current;
        if(!scatterplotD3){
            return;
        }
        const handleOnClick = function(itemData){
            const scatterplotD3 = scatterplotD3Ref.current;
            if(scatterplotD3){
                scatterplotD3.clearBrushSelection();
            }
            const clickedIndex = itemData && itemData.index;
            const currentSelectedItems = selectedItemsRef.current || [];
            const isSamePointSelected = currentSelectedItems.length === 1
                && currentSelectedItems[0]
                && String(currentSelectedItems[0].index) === String(clickedIndex)
            ;
            dispatch(setHoveredState(null));
            dispatch(setSelectedItems({
                items: isSamePointSelected ? [] : [itemData],
                source: 'scatter-click'
            }));
        }
        const handleOnMouseEnter = function(itemData){
            dispatch(setHoveredItem(itemData));
            dispatch(setHoveredState(null));
        }
        const handleOnMouseLeave = function(){
            dispatch(setHoveredItem({}));
            dispatch(setHoveredState(null));
        }
        const handleOnBrushSelection = function(selectedBrushItems){
            dispatch(setSelectedItems({
                items: selectedBrushItems,
                source: 'scatter-brush'
            }));
        }
        const controllerMethods={
            handleOnClick,
            handleOnMouseEnter,
            handleOnMouseLeave,
            handleOnBrushSelection
        }

        scatterplotD3.renderScatterplot(
            visData,
            selectedXAttribute,
            selectedYAttribute,
            colorAttributeName,
            chartMeta,
            controllerMethods,
            ATTRIBUTE_DIRECTION_BY_FIELD
        );
        applyBaseHighlights();
        applyHoverHighlight();
    }

    useEffect(()=>{
        renderScatterplot();
    },[visData, selectedXAttribute, selectedYAttribute, colorAttributeName]);

    useEffect(()=>{
        setSelectedXAttribute(xAttributeName);
    },[xAttributeName]);

    useEffect(()=>{
        setSelectedYAttribute(yAttributeName);
    },[yAttributeName]);

    useEffect(()=>{
        if(typeof onAxisSelectionChange === 'function'){
            onAxisSelectionChange({
                xAttributeName: selectedXAttribute,
                yAttributeName: selectedYAttribute
            });
        }
    }, [selectedXAttribute, selectedYAttribute, onAxisSelectionChange]);

    useEffect(()=>{
        selectedItemsRef.current = selectedItems;
    }, [selectedItems]);

    useEffect(()=>{
        applyBaseHighlights();
        applyHoverHighlight();
    },[selectedItems, hoveredState]);

    useEffect(()=>{
        applyHoverHighlight();
    },[hoveredItem]);

    useEffect(()=>{
        const scatterplotD3 = scatterplotD3Ref.current;
        if(!scatterplotD3){
            return;
        }
        if(selectedItemsSource && selectedItemsSource !== 'scatter-brush'){
            scatterplotD3.clearBrushSelection();
        }
    }, [selectedItemsSource]);

    const effectiveXOptions = xAttributeOptions.length>0 ? xAttributeOptions : [xAttributeName];
    const effectiveYOptions = yAttributeOptions.length>0 ? yAttributeOptions : [yAttributeName];
    return(
        <div className="scatterplotPanel col">
            <div ref={chartDivContainerRef} className="scatterplotDivContainer">

            </div>
            <div className="scatterplotToolbar">
                <div className="scatterplotToolbarGroup">
                    <label htmlFor="scatter-x-attribute-select" className="scatterplotToolbarLabel">
                        X Feat.:
                    </label>
                    <select
                        id="scatter-x-attribute-select"
                        className="scatterplotToolbarSelect"
                        value={selectedXAttribute}
                        onChange={(event)=>setSelectedXAttribute(event.target.value)}
                    >
                        {effectiveXOptions.map((attributeName)=>(
                            <option key={attributeName} value={attributeName}>
                                {getFriendlyAttributeLabel(attributeName)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="scatterplotToolbarGroup">
                    <label htmlFor="scatter-y-attribute-select" className="scatterplotToolbarLabel">
                        Y Feat.:
                    </label>
                    <select
                        id="scatter-y-attribute-select"
                        className="scatterplotToolbarSelect"
                        value={selectedYAttribute}
                        onChange={(event)=>setSelectedYAttribute(event.target.value)}
                    >
                        {effectiveYOptions.map((attributeName)=>(
                            <option key={attributeName} value={attributeName}>
                                {getFriendlyAttributeLabel(attributeName)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    )
}

export default ScatterplotContainer;
