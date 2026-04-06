import * as d3 from 'd3'
// import { getDefaultFontSize } from '../../utils/helper';
import { getStateNameWithCodeFromFips } from '../../utils/usStateFips';

let scatterplotIdCounter = 0;

class ScatterplotD3 {
    margin = {top: 104, right: 130, bottom: 70, left: 82};
    size;
    height;
    width;
    rootSvg;
    svg;
    brushG;
    brushBehavior;
    brushRafId = null;
    pendingBrushSelection = null;
    lastBrushedIndexes = [];
    lastBrushDispatchMs = 0;
    brushDispatchIntervalMs = 220;
    syncDuringBrush = false;
    chartTitleText;
    chartSubtitleText;
    xAxisLabelText;
    yAxisLabelText;
    xGridG;
    yGridG;
    colorLegendG;
    colorLegendAxisG;
    colorLegendTitleText;
    colorLegendNoteText;
    colorGradientId;
    colorScale;
    colorLegendHeight = 136;
    colorLegendWidth = 14;
    colorInterpolator = (value)=>{
        // trim the brightest/darkest ends to keep both low/high values readable but not over-bright
        const trimmedValue = 0.12 + (0.76 * value);
        return d3.interpolateViridis(trimmedValue);
    };
    // add specific class properties used for the vis render/updates
    defaultOpacity=0.5;
    transitionDuration=160;
    transitionEase=d3.easeCubicOut;
    circleRadius = 3;
    hoveredCircleRadius = 4.2;
    selectedCircleRadius = 5.6;
    markerStrokeColor = "#f8fafc";
    markerStrokeWidth = 0.9;
    hoveredStrokeColor = "#2563eb";
    hoveredStrokeWidth = 1.8;
    selectedStrokeColor = "#b45309";
    selectedStrokeWidth = 2.8;
    xScale;
    yScale;
    controllerMethods;
    itemPixelCache = [];
    itemByIndex;
    markerGroupByIndex;
    selectedIndexSet = new Set();
    lastHoveredIndex = null;
    lastHoveredState = null;
    lastVisDataRef = null;
    currentColorAttribute = null;


    constructor(el){
        this.el=el;
        scatterplotIdCounter += 1;
        this.colorGradientId = `scatterplotColorGradient-${scatterplotIdCounter}`;
        this.colorScale = d3.scaleSequential(this.colorInterpolator).clamp(true);
        this.itemByIndex = new Map();
        this.markerGroupByIndex = new Map();
    };

    create = function (config) {
        this.size = {width: config.size.width, height: config.size.height};

        // get the effect size of the view by subtracting the margin
        this.width = this.size.width - this.margin.left - this.margin.right;
        this.height = this.size.height - this.margin.top - this.margin.bottom;

        // initialize the svg and keep it in a class property to reuse it in renderScatterplot()
        this.rootSvg=d3.select(this.el).append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
        ;
        this.svg=this.rootSvg
            .append("g")
            .attr("class","svgG")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        ;

        this.xScale = d3.scaleLinear().range([0,this.width]);
        this.yScale = d3.scaleLinear().range([this.height,0]);

        // build x/y grids + axis
        this.xGridG = this.svg.append("g")
            .attr("class","xGridG")
            .attr("transform","translate(0,"+this.height+")")
        ;
        this.yGridG = this.svg.append("g")
            .attr("class","yGridG")
        ;
        this.svg.append("g")
            .attr("class","xAxisG")
            .attr("transform","translate(0,"+this.height+")")
        ;
        this.svg.append("g")
            .attr("class","yAxisG")
        ;
        this.chartTitleText = this.svg.append("text")
            .attr("class","scatterplotTitle")
            .attr("x", 0)
            .attr("y", -68)
            .text("Scatterplot")
        ;
        this.chartSubtitleText = this.svg.append("text")
            .attr("class","scatterplotSubtitle")
            .attr("x", 0)
            .attr("y", -46)
            .text("X vs Y (Color: attribute)")
        ;
        this.xAxisLabelText = this.svg.append("text")
            .attr("class","scatterplotXAxisLabel")
            .attr("x", this.width / 2)
            .attr("y", this.height + 46)
            .attr("text-anchor","middle")
            .text("X Axis")
        ;
        this.yAxisLabelText = this.svg.append("text")
            .attr("class","scatterplotYAxisLabel")
            .attr("transform",`translate(${-56},${this.height / 2}) rotate(-90)`)
            .attr("text-anchor","middle")
            .text("Y Axis")
        ;
        this.colorLegendG = this.svg.append("g")
            .attr("class","scatterplotColorLegend")
            .attr("transform",`translate(${this.width + 16},12)`)
        ;
        this.colorLegendTitleText = this.colorLegendG.append("text")
            .attr("class","scatterplotColorLegendTitle")
            .attr("x", this.colorLegendWidth + 34)
            .attr("y", -8)
            .attr("text-anchor", "end")
            .text("Color")
        ;
        this.colorLegendNoteText = this.colorLegendG.append("text")
            .attr("class","scatterplotColorLegendNote")
            .attr("x", this.colorLegendWidth + 34)
            .attr("y", this.colorLegendHeight + 14)
            .attr("text-anchor", "end")
            .text("")
        ;
        const defs = this.rootSvg.append("defs");
        const linearGradient = defs.append("linearGradient")
            .attr("id", this.colorGradientId)
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%")
        ;
        const gradientStops = [0, 25, 50, 75, 100];
        gradientStops.forEach((stopPercent)=>{
            linearGradient.append("stop")
                .attr("offset", `${stopPercent}%`)
                .attr("stop-color", this.colorInterpolator(stopPercent / 100))
            ;
        });
        this.colorLegendG.append("rect")
            .attr("class","scatterplotColorLegendRect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", this.colorLegendWidth)
            .attr("height", this.colorLegendHeight)
            .attr("fill", `url(#${this.colorGradientId})`)
        ;
        this.colorLegendAxisG = this.colorLegendG.append("g")
            .attr("class","scatterplotColorLegendAxis")
            .attr("transform",`translate(${this.colorLegendWidth},0)`)
        ;
        this.brushG = this.svg.append("g")
            .attr("class","brushG")
        ;
    }

    changeBorderAndOpacity(selection, selected){
        selection
            .style("opacity", selected?1:this.defaultOpacity)
        ;

        selection.select(".markerCircle")
            .attr("r", selected ? this.circleRadius + 0.4 : this.circleRadius)
            .attr("stroke", selected ? "#0f766e" : this.markerStrokeColor)
            .attr("stroke-width",selected ? 1.4 : this.markerStrokeWidth)
        ;
    }

    rebuildItemPixelCache = function(visData, xAttribute, yAttribute){
        this.itemPixelCache = [];
        this.itemByIndex.clear();
        visData.forEach((item)=>{
            this.itemByIndex.set(item.index, item);
            const xValue = Number(item[xAttribute]);
            const yValue = Number(item[yAttribute]);
            if(!Number.isFinite(xValue) || !Number.isFinite(yValue)){
                return;
            }
            this.itemPixelCache.push({
                index: item.index,
                x: this.xScale(xValue),
                y: this.yScale(yValue)
            });
        });
    }

    getItemTooltipText = function(itemData){
        const safeNumber = (value)=>{
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? numericValue.toFixed(3) : "n/a";
        };
        const populationIndex = Number(itemData.population);
        const populationPercent = Number.isFinite(populationIndex)
            ? `${(populationIndex * 100).toFixed(1)}% of dataset max`
            : "n/a"
        ;
        return `State: ${getStateNameWithCodeFromFips(itemData.state)}\nCommunity: ${itemData.communityname}\nViolentCrimesPerPop: ${safeNumber(itemData.ViolentCrimesPerPop)}\nPopulation index: ${safeNumber(itemData.population)} (${populationPercent})`;
    }

    updateMarkers(selection,xAttribute,yAttribute,colorAttribute, updateColor=true){
        // transform selection
        selection
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr("transform", (item)=>{
                // use scales to return shape position from data values
                const xValue = Number(item[xAttribute]);
                const yValue = Number(item[yAttribute]);

                // put non-numeric values outside the chart area
                if(!Number.isFinite(xValue) || !Number.isFinite(yValue)){
                    return `translate(${-9999},${-9999})`;
                }
                const xPos = this.xScale(xValue);
                const yPos = this.yScale(yValue);
                return `translate(${xPos},${yPos})`;
            })
        ;
        if(updateColor){
            selection.select(".markerCircle")
                .attr("fill", (itemData)=>{
                    const colorValue = Number(itemData[colorAttribute]);
                    if(!Number.isFinite(colorValue)){
                        return "#6b7280";
                    }
                    return this.colorScale(colorValue);
                })
                .attr("fill-opacity", 0.82)
            ;
        }
    }

    highlightSelectedIndexes(selectedIndexes){
        const selectedIndexSet = new Set(
            (selectedIndexes || [])
                .filter((index)=>index!==undefined && index!==null)
        );

        for(const prevIndex of this.selectedIndexSet){
            if(selectedIndexSet.has(prevIndex)){
                continue;
            }
            const markerNode = this.markerGroupByIndex.get(prevIndex);
            if(!markerNode){
                continue;
            }
            const markerSelection = d3.select(markerNode);
            markerSelection.style("opacity", this.defaultOpacity);
            markerSelection.select(".markerCircle")
                .attr("r", this.circleRadius)
                .attr("stroke", this.markerStrokeColor)
                .attr("stroke-width", this.markerStrokeWidth)
            ;
        }

        for(const nextIndex of selectedIndexSet){
            if(this.selectedIndexSet.has(nextIndex)){
                continue;
            }
            const markerNode = this.markerGroupByIndex.get(nextIndex);
            if(!markerNode){
                continue;
            }
            const markerSelection = d3.select(markerNode);
            markerSelection
                .raise()
                .style("opacity", 1)
            ;
            markerSelection.select(".markerCircle")
                .attr("r", this.selectedCircleRadius)
                .attr("stroke", this.selectedStrokeColor)
                .attr("stroke-width", this.selectedStrokeWidth)
            ;
        }

        this.selectedIndexSet = selectedIndexSet;
    }

    highlightSelectedItems(selectedItems){
        const selectedIndexes = (selectedItems || [])
            .map((item)=>item.index)
            .filter((index)=>index!==undefined && index!==null)
        ;
        this.highlightSelectedIndexes(selectedIndexes);
    }

    resetMarkerToBaseStyle(index){
        if(index === null || index === undefined){
            return;
        }
        const markerNode = this.markerGroupByIndex.get(index);
        if(!markerNode){
            return;
        }
        const isSelected = this.selectedIndexSet.has(index);
        const markerSelection = d3.select(markerNode);
        markerSelection.style("opacity", isSelected ? 1 : this.defaultOpacity);
        markerSelection.select(".markerCircle")
            .attr("r", isSelected ? this.selectedCircleRadius : this.circleRadius)
            .attr("stroke", isSelected ? this.selectedStrokeColor : this.markerStrokeColor)
            .attr("stroke-width", isSelected ? this.selectedStrokeWidth : this.markerStrokeWidth)
        ;
    }

    highlightHoveredItem(hoveredItem){
        const hoveredIndex = hoveredItem && hoveredItem.index !== undefined && hoveredItem.index !== null
            ? hoveredItem.index
            : null
        ;
        if(this.lastHoveredIndex !== null && this.lastHoveredIndex !== hoveredIndex){
            this.resetMarkerToBaseStyle(this.lastHoveredIndex);
            this.lastHoveredIndex = null;
        }
        if(hoveredIndex === null){
            return;
        }

        const hoveredMarkerNode = this.markerGroupByIndex.get(hoveredIndex);
        if(!hoveredMarkerNode){
            return;
        }
        const hoveredMarkerSelection = d3.select(hoveredMarkerNode);

        hoveredMarkerSelection
            .raise()
            .style("opacity", 1)
        ;
        if(this.selectedIndexSet.has(hoveredIndex)){
            this.lastHoveredIndex = hoveredIndex;
            return;
        }
        hoveredMarkerSelection.select(".markerCircle")
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr("stroke", this.hoveredStrokeColor)
            .attr("stroke-width", this.hoveredStrokeWidth)
            .attr("r", this.hoveredCircleRadius)
        ;
        this.lastHoveredIndex = hoveredIndex;
    }

    highlightHoveredState(hoveredState){
        const nextHoveredState = hoveredState === null || hoveredState === undefined || hoveredState === ""
            ? null
            : hoveredState
        ;
        if(this.lastHoveredState !== null && String(this.lastHoveredState) !== String(nextHoveredState)){
            const previousStateSelection = this.svg.selectAll(".markerG")
                .filter((item)=>String(item.state) === String(this.lastHoveredState))
            ;
            previousStateSelection.each((itemData)=>{
                if(!itemData || itemData.index === undefined || itemData.index === null){
                    return;
                }
                if(this.lastHoveredIndex !== null && String(itemData.index) === String(this.lastHoveredIndex)){
                    return;
                }
                this.resetMarkerToBaseStyle(itemData.index);
            });
            this.lastHoveredState = null;
        }
        if(nextHoveredState === null){
            return;
        }
        const hoveredStateSelection = this.svg.selectAll(".markerG")
            .filter((item)=>String(item.state) === String(nextHoveredState))
            .filter((item)=>!this.selectedIndexSet.has(item.index))
        ;
        hoveredStateSelection
            .style("opacity", 1)
        ;
        hoveredStateSelection.select(".markerCircle")
            .attr("stroke", this.hoveredStrokeColor)
            .attr("stroke-width", Math.min(this.hoveredStrokeWidth, 1.4))
        ;
        this.lastHoveredState = nextHoveredState;
    }

    updateChartTexts(meta){
        if(!meta){
            return;
        }
        const withUnit = (label, unit)=>{
            if(!unit){
                return label;
            }
            return `${label} (${unit})`;
        };
        if(this.chartTitleText){
            this.chartTitleText.text(meta.title || "Scatterplot");
        }
        if(this.chartSubtitleText){
            this.chartSubtitleText.text(meta.subtitle || "X vs Y (Color: attribute)");
        }
        if(this.xAxisLabelText){
            this.xAxisLabelText.text(withUnit(meta.xLabel || "X Axis", meta.xUnit));
        }
        if(this.yAxisLabelText){
            this.yAxisLabelText.text(withUnit(meta.yLabel || "Y Axis", meta.yUnit));
        }
        if(this.colorLegendTitleText){
            this.colorLegendTitleText.text(`Color: ${meta.colorLabel || "attribute"}`);
        }
        if(this.colorLegendNoteText){
            this.colorLegendNoteText.text(meta.colorUnit || "");
        }
    }

    updateColorScaleAndLegend(visData, colorAttribute){
        const colorValues = visData
            .map((itemData)=>Number(itemData[colorAttribute]))
            .filter((value)=>Number.isFinite(value))
        ;
        let minValue = colorValues.length > 0 ? d3.min(colorValues) : 0;
        let maxValue = colorValues.length > 0 ? d3.max(colorValues) : 1;
        if(minValue === maxValue){
            minValue = minValue - 0.01;
            maxValue = maxValue + 0.01;
        }
        this.colorScale.domain([minValue, maxValue]);

        const colorLegendScale = d3.scaleLinear()
            .domain([minValue, maxValue])
            .range([this.colorLegendHeight, 0])
        ;
        const tickFormatter = minValue>=0 && maxValue<=1.00001
            ? d3.format(".0%")
            : d3.format(".2~g")
        ;
        this.colorLegendAxisG
            .call(d3.axisRight(colorLegendScale).ticks(5).tickFormat(tickFormatter))
        ;
    }

    updateAxis = function(visData,xAttribute,yAttribute){
        // compute min max using d3.min/max(visData.map(item=>item.attribute))
        const xValues = visData
            .map((item)=>Number(item[xAttribute]))
            .filter((value)=>Number.isFinite(value))
        ;
        const yValues = visData
            .map((item)=>Number(item[yAttribute]))
            .filter((value)=>Number.isFinite(value))
        ;

        const xMin = xValues.length>0 ? d3.min(xValues) : 0;
        const xMax = xValues.length>0 ? d3.max(xValues) : 1;
        const yMin = yValues.length>0 ? d3.min(yValues) : 0;
        const yMax = yValues.length>0 ? d3.max(yValues) : 1;

        this.xScale.domain([xMin, xMax]);
        this.yScale.domain([yMin, yMax]);

        const xTickCount = 6;
        const yTickCount = 6;

        this.xGridG
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .call(
                d3.axisBottom(this.xScale)
                    .ticks(xTickCount)
                    .tickSize(-this.height)
                    .tickFormat("")
            )
        ;
        this.yGridG
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .call(
                d3.axisLeft(this.yScale)
                    .ticks(yTickCount)
                    .tickSize(-this.width)
                    .tickFormat("")
            )
        ;

        // create axis with computed scales
        // .xAxisG and .yAxisG are initialized in create() function
        this.svg.select(".xAxisG")
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .call(d3.axisBottom(this.xScale).ticks(xTickCount).tickFormat(d3.format(".2f")))
        ;
        this.svg.select(".yAxisG")
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .call(d3.axisLeft(this.yScale).ticks(yTickCount).tickFormat(d3.format(".2f")))
        ;
    }

    getSelectedIndexesInsideBrushSelection = function(brushSelection){
        if(!brushSelection){
            return [];
        }

        const [[x0, y0], [x1, y1]] = brushSelection;
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        const selectedIndexes = [];
        for(let i=0;i<this.itemPixelCache.length;i+=1){
            const cachedPoint = this.itemPixelCache[i];
            if(cachedPoint.x>=minX && cachedPoint.x<=maxX && cachedPoint.y>=minY && cachedPoint.y<=maxY){
                selectedIndexes.push(cachedPoint.index);
            }
        }
        return selectedIndexes;
    }

    areIndexArraysEqual = function(leftIndexes, rightIndexes){
        if(leftIndexes.length !== rightIndexes.length){
            return false;
        }
        for(let i=0;i<leftIndexes.length;i+=1){
            if(leftIndexes[i] !== rightIndexes[i]){
                return false;
            }
        }
        return true;
    }

    dispatchBrushSelection = function(controllerMethods, selectedIndexes, brushSelection, forceDispatch, eventType){
        if(!controllerMethods || !controllerMethods.handleOnBrushSelection){
            return;
        }

        if(!forceDispatch && eventType === "brush" && !this.syncDuringBrush){
            return;
        }

        if(this.areIndexArraysEqual(this.lastBrushedIndexes, selectedIndexes)){
            return;
        }

        if(!forceDispatch && eventType === "brush"){
            const now = window.performance ? window.performance.now() : Date.now();
            if(now - this.lastBrushDispatchMs < this.brushDispatchIntervalMs){
                return;
            }
            this.lastBrushDispatchMs = now;
        }

        this.lastBrushedIndexes = selectedIndexes;
        const selectedItems = selectedIndexes
            .map((index)=>this.itemByIndex.get(index))
            .filter((item)=>item!==undefined)
        ;
        controllerMethods.handleOnBrushSelection(
            selectedItems,
            brushSelection,
            eventType
        );
    }

    bindBrushInteraction = function(visData, xAttribute, yAttribute, controllerMethods){
        if(!this.brushG){
            return;
        }

        const handleBrush = (event)=>{
            if(event.type === "end"){
                if(this.brushRafId !== null){
                    window.cancelAnimationFrame(this.brushRafId);
                    this.brushRafId = null;
                    this.pendingBrushSelection = null;
                }
                const endSelection = event.selection;
                const endIndexes = this.getSelectedIndexesInsideBrushSelection(endSelection);
                this.highlightSelectedIndexes(endIndexes);
                this.lastBrushDispatchMs = 0;
                this.dispatchBrushSelection(controllerMethods, endIndexes, endSelection, true, event.type);
                return;
            }

            this.pendingBrushSelection = event.selection;

            if(this.brushRafId !== null){
                return;
            }

            this.brushRafId = window.requestAnimationFrame(()=>{
                this.brushRafId = null;
                const selectionToProcess = this.pendingBrushSelection;
                this.pendingBrushSelection = null;
                const selectedIndexes = this.getSelectedIndexesInsideBrushSelection(selectionToProcess);
                // keep brush drag smooth by updating local markers every frame.
                this.highlightSelectedIndexes(selectedIndexes);
                this.dispatchBrushSelection(controllerMethods, selectedIndexes, selectionToProcess, false, "brush");
            });
        };

        this.brushBehavior = d3.brush()
            .extent([[0, 0], [this.width, this.height]])
            .on("brush", handleBrush)
            .on("end", handleBrush)
        ;

        this.brushG
            .call(this.brushBehavior)
            // Keep brush below points so point click/hover is always available.
            // (If brush overlay is on top, it intercepts most point interactions.)
            .lower()
        ;
    }

    renderScatterplot = function (visData, xAttribute, yAttribute, colorAttribute, meta, controllerMethods){
        this.controllerMethods = controllerMethods;
        const dataChanged = this.lastVisDataRef !== visData;
        const colorChanged = this.currentColorAttribute !== colorAttribute;
        const needsColorUpdate = dataChanged || colorChanged;

        // build the size scales and x,y axis
        this.updateChartTexts(meta);
        if(needsColorUpdate){
            this.updateColorScaleAndLegend(visData, colorAttribute);
            this.currentColorAttribute = colorAttribute;
        }
        this.updateAxis(visData,xAttribute,yAttribute);
        this.rebuildItemPixelCache(visData, xAttribute, yAttribute);

        this.svg.selectAll(".markerG")
            // all elements with the class .cellG (empty the first time)
            .data(visData,(itemData)=>itemData.index)
            .join(
                enter=>{
                    // all data items to add:
                    // doesn’exist in the select but exist in the new array
                    const itemG=enter.append("g")
                        .attr("class","markerG")
                        .style("opacity",this.defaultOpacity)
                        .on("click", (event,itemData)=>{
                            if(this.controllerMethods && this.controllerMethods.handleOnClick){
                                this.controllerMethods.handleOnClick(itemData);
                            }
                        })
                        .on("mouseenter", (event,itemData)=>{
                            if(this.controllerMethods && this.controllerMethods.handleOnMouseEnter){
                                this.controllerMethods.handleOnMouseEnter(itemData);
                            }
                        })
                        .on("mouseleave", ()=>{
                            if(this.controllerMethods && this.controllerMethods.handleOnMouseLeave){
                                this.controllerMethods.handleOnMouseLeave();
                            }
                        })
                    ;
                    itemG.each((itemData, itemIndex, nodes)=>{
                        this.markerGroupByIndex.set(itemData.index, nodes[itemIndex]);
                    });
                    // render element as child of each element "g"
                    itemG.append("circle")
                        .attr("class","markerCircle")
                        .attr("r",this.circleRadius)
                        .attr("stroke",this.markerStrokeColor)
                        .attr("stroke-width",this.markerStrokeWidth)
                    ;
                    itemG.append("title");
                    itemG.select("title")
                        .text((itemData)=>this.getItemTooltipText(itemData))
                    ;
                    this.updateMarkers(itemG,xAttribute,yAttribute,colorAttribute, true);
                },
                update=>{
                    update.each((itemData, itemIndex, nodes)=>{
                        this.markerGroupByIndex.set(itemData.index, nodes[itemIndex]);
                    });
                    this.updateMarkers(update,xAttribute,yAttribute,colorAttribute, needsColorUpdate)
                },
                exit =>{
                    exit.each((itemData)=>{
                        this.markerGroupByIndex.delete(itemData.index);
                    });
                    exit.remove()
                    ;
                }

            )

        this.bindBrushInteraction(visData, xAttribute, yAttribute, controllerMethods);
        this.lastVisDataRef = visData;
    }

    clear = function(){
        if(this.brushRafId !== null){
            window.cancelAnimationFrame(this.brushRafId);
            this.brushRafId = null;
        }
        this.pendingBrushSelection = null;
        this.lastBrushedIndexes = [];
        this.lastBrushDispatchMs = 0;
        this.itemPixelCache = [];
        this.itemByIndex.clear();
        this.markerGroupByIndex.clear();
        this.selectedIndexSet.clear();
        this.lastHoveredIndex = null;
        this.lastHoveredState = null;
        this.lastVisDataRef = null;
        this.currentColorAttribute = null;
        d3.select(this.el).selectAll("*").remove();
    }
}
export default ScatterplotD3;
