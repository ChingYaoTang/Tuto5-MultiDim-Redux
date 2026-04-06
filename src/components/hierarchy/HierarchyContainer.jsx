import './Hierarchy.css'
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import HierarchyD3 from './Hierarchy-d3';
import { setHoveredItem, setHoveredState, setSelectedItems } from '../../redux/ItemInteractionSlice';
import { getStateLabelFromFips } from '../../utils/usStateFips';

const LAYOUT_OPTIONS = [
    {id: 'treemap', label: 'Treemap'},
    {id: 'pack', label: 'Circle Pack'},
    {id: 'tree', label: 'Tree'}
];
const PREFERRED_LAYOUT = 'treemap';
const hasSameSelectionByIndex = (leftItems = [], rightItems = [])=>{
    if(leftItems.length !== rightItems.length){
        return false;
    }
    const rightIndexSet = new Set(
        rightItems
            .map((item)=>item && item.index)
            .filter((index)=>index !== undefined && index !== null)
            .map((index)=>String(index))
    );
    if(rightIndexSet.size !== rightItems.length){
        return false;
    }
    for(let i=0;i<leftItems.length;i+=1){
        const leftIndex = leftItems[i] && leftItems[i].index;
        if(leftIndex === undefined || leftIndex === null){
            return false;
        }
        if(!rightIndexSet.has(String(leftIndex))){
            return false;
        }
    }
    return true;
};

function HierarchyContainer(){
    const visData = useSelector((state)=>state.dataSet);
    const selectedItems = useSelector((state)=>state.itemInteraction.selectedItems);
    const hoveredItem = useSelector((state)=>state.itemInteraction.hoveredItem);
    const hoveredState = useSelector((state)=>state.itemInteraction.hoveredState);
    const dispatch = useDispatch();
    const [layoutType, setLayoutType] = useState(PREFERRED_LAYOUT);

    const divContainerRef = useRef(null);
    const hierarchyD3Ref = useRef(null);
    const selectedItemsRef = useRef(selectedItems);

    const getChartSize = function(){
        let width;
        let height;
        if(divContainerRef.current !== undefined){
            width = divContainerRef.current.offsetWidth;
            height = divContainerRef.current.offsetHeight;
        }
        return {width: width, height: height};
    }

    useEffect(()=>{
        const hierarchyD3 = new HierarchyD3(divContainerRef.current);
        hierarchyD3.create({size: getChartSize()});
        hierarchyD3Ref.current = hierarchyD3;

        return ()=>{
            const currentHierarchyD3 = hierarchyD3Ref.current;
            if(currentHierarchyD3){
                currentHierarchyD3.clear();
            }
        }
    },[]);

    const applyHighlights = function(){
        const hierarchyD3 = hierarchyD3Ref.current;
        if(!hierarchyD3){
            return;
        }
        hierarchyD3.highlightSelectedItems(selectedItems);
        hierarchyD3.highlightHoveredState(hoveredState);
        hierarchyD3.highlightHoveredItem(hoveredItem);
    }

    const renderHierarchy = function(){
        const hierarchyD3 = hierarchyD3Ref.current;
        if(!hierarchyD3){
            return;
        }
        const controllerMethods = {
            handleOnClickCommunity: (itemData)=>{
                dispatch(setHoveredItem({}));
                dispatch(setHoveredState(null));
                const clickedIndex = itemData && itemData.index;
                const currentSelectedItems = selectedItemsRef.current || [];
                const isSameCommunitySelected = currentSelectedItems.length === 1
                    && currentSelectedItems[0]
                    && String(currentSelectedItems[0].index) === String(clickedIndex)
                ;
                dispatch(setSelectedItems(isSameCommunitySelected ? [] : [itemData]));
            },
            handleOnClickState: (stateData)=>{
                dispatch(setHoveredItem({}));
                dispatch(setHoveredState(null));
                const stateItems = stateData && Array.isArray(stateData.stateItems)
                    ? stateData.stateItems
                    : []
                ;
                const currentSelectedItems = selectedItemsRef.current || [];
                const isSameStateSelected = stateItems.length > 0
                    && hasSameSelectionByIndex(currentSelectedItems, stateItems)
                ;
                dispatch(setSelectedItems(isSameStateSelected ? [] : stateItems));
            },
            handleOnClickBackground: ()=>{
                dispatch(setHoveredItem({}));
                dispatch(setHoveredState(null));
                dispatch(setSelectedItems([]));
            },
            handleOnMouseEnterCommunity: (itemData)=>{
                dispatch(setHoveredItem(itemData));
                dispatch(setHoveredState(null));
            },
            handleOnMouseLeaveCommunity: ()=>{
                dispatch(setHoveredItem({}));
                dispatch(setHoveredState(null));
            },
            handleOnMouseEnterState: (stateData)=>{
                dispatch(setHoveredItem({}));
                dispatch(setHoveredState(stateData.stateValue));
            },
            handleOnMouseLeaveState: ()=>{
                dispatch(setHoveredState(null));
            }
        };

        hierarchyD3.renderHierarchy(visData, controllerMethods, layoutType);
        applyHighlights();
    }

    useEffect(()=>{
        renderHierarchy();
    }, [visData, layoutType]);

    useEffect(()=>{
        selectedItemsRef.current = selectedItems;
    }, [selectedItems]);

    useEffect(()=>{
        applyHighlights();
    }, [selectedItems, hoveredItem, hoveredState]);

    const hoverSummaryText = hoveredItem && hoveredItem.index !== undefined && hoveredItem.index !== null
        ? `Hover: ${getStateLabelFromFips(hoveredItem.state)} / ${hoveredItem.communityname}`
        : (hoveredState !== null && hoveredState !== undefined
            ? `Hover state: ${getStateLabelFromFips(hoveredState)}`
            : "Hover a hierarchy node or scatter point to inspect details")
    ;

    return(
        <div className="hierarchyPanel col">
            <div className="hierarchyToolbar">
                {LAYOUT_OPTIONS.map((option)=>{
                    const activeClass = option.id === layoutType ? 'active' : '';
                    const preferredText = option.id === PREFERRED_LAYOUT ? ' (preferred)' : '';
                    return (
                        <button
                            key={option.id}
                            type="button"
                            className={`layoutButton ${activeClass}`.trim()}
                            onClick={()=>setLayoutType(option.id)}
                        >
                            {option.label}{preferredText}
                        </button>
                    );
                })}
            </div>
            <div className="hierarchyHoverTooltip">
                {hoverSummaryText}
            </div>
            <div ref={divContainerRef} className="hierarchyDivContainer">

            </div>
        </div>
    )
}

export default HierarchyContainer;
