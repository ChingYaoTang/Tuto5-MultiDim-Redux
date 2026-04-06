import './Scatterplot.css'
import { useEffect, useRef, useState } from 'react';
import {useDispatch, useSelector} from 'react-redux'

import ScatterplotD3 from './Scatterplot-d3';
import { setHoveredItem, setHoveredState, setSelectedItems } from '../../redux/ItemInteractionSlice';
import { getStateLabelFromFips } from '../../utils/usStateFips';

function ScatterplotContainer({xAttributeName, yAttributeName, colorAttributeName, title, xAttributeOptions=[]}){
    const visData = useSelector(state =>state.dataSet)
    const selectedItems = useSelector(state =>state.itemInteraction.selectedItems)
    const hoveredItem = useSelector(state =>state.itemInteraction.hoveredItem)
    const hoveredState = useSelector(state =>state.itemInteraction.hoveredState)
    const dispatch = useDispatch();
    const [selectedXAttribute, setSelectedXAttribute] = useState(xAttributeName);

    const chartDivContainerRef=useRef(null);
    const scatterplotD3Ref = useRef(null)
    const selectedItemsRef = useRef(selectedItems);

    const formatAttributeLabel = function(attributeName){
        return attributeName
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/^./, (char)=>char.toUpperCase())
        ;
    }

    const chartMeta = {
        title: title || "Scatterplot",
        subtitle: `${formatAttributeLabel(selectedXAttribute)} vs ${formatAttributeLabel(yAttributeName)} (Color: population index)`,
        xLabel: formatAttributeLabel(selectedXAttribute),
        yLabel: formatAttributeLabel(yAttributeName),
        colorLabel: "Population index (relative)",
        xUnit: "normalized [0-1]",
        yUnit: "normalized [0-1]",
        colorUnit: "100% = largest community"
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

    const applyHighlights = function(){
        const scatterplotD3 = scatterplotD3Ref.current;
        if(!scatterplotD3){
            return;
        }
        scatterplotD3.highlightSelectedItems(selectedItems);
        scatterplotD3.highlightHoveredState(hoveredState);
        scatterplotD3.highlightHoveredItem(hoveredItem);
    }

    const renderScatterplot = function(){
        const scatterplotD3 = scatterplotD3Ref.current;
        if(!scatterplotD3){
            return;
        }
        const handleOnClick = function(itemData){
            const clickedIndex = itemData && itemData.index;
            const currentSelectedItems = selectedItemsRef.current || [];
            const isSamePointSelected = currentSelectedItems.length === 1
                && currentSelectedItems[0]
                && String(currentSelectedItems[0].index) === String(clickedIndex)
            ;
            dispatch(setHoveredState(null));
            dispatch(setSelectedItems(isSamePointSelected ? [] : [itemData]));
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
            dispatch(setSelectedItems(selectedBrushItems));
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
            yAttributeName,
            colorAttributeName,
            chartMeta,
            controllerMethods
        );
        applyHighlights();
    }

    useEffect(()=>{
        renderScatterplot();
    },[visData, selectedXAttribute, yAttributeName, colorAttributeName]);

    useEffect(()=>{
        setSelectedXAttribute(xAttributeName);
    },[xAttributeName]);

    useEffect(()=>{
        selectedItemsRef.current = selectedItems;
    }, [selectedItems]);

    useEffect(()=>{
        applyHighlights();
    },[selectedItems, hoveredItem, hoveredState]);

    const effectiveXOptions = xAttributeOptions.length>0 ? xAttributeOptions : [xAttributeName];
    const hoverSummaryText = hoveredItem && hoveredItem.index !== undefined && hoveredItem.index !== null
        ? `Hover: ${getStateLabelFromFips(hoveredItem.state)} / ${hoveredItem.communityname}`
        : (hoveredState !== null && hoveredState !== undefined
            ? `Hover state: ${getStateLabelFromFips(hoveredState)}`
            : "Hover a scatter point or hierarchy node to inspect details")
    ;

    return(
        <div className="scatterplotPanel col">
            <div className="scatterplotToolbar">
                <label htmlFor="scatter-x-attribute-select" className="scatterplotToolbarLabel">
                    X Feature:
                </label>
                <select
                    id="scatter-x-attribute-select"
                    className="scatterplotToolbarSelect"
                    value={selectedXAttribute}
                    onChange={(event)=>setSelectedXAttribute(event.target.value)}
                >
                    {effectiveXOptions.map((attributeName)=>(
                        <option key={attributeName} value={attributeName}>
                            {formatAttributeLabel(attributeName)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="scatterplotHoverTooltip">
                {hoverSummaryText}
            </div>
            <div ref={chartDivContainerRef} className="scatterplotDivContainer">

            </div>
        </div>
    )
}

export default ScatterplotContainer;
