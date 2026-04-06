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
        // low value -> red, high value -> blue
        const trimmedValue = 0.08 + (0.84 * value);
        return d3.interpolateRdBu(trimmedValue);
    };
    // add specific class properties used for the vis render/updates
    defaultOpacity=0.5;
    transitionDuration=160;
    transitionEase=d3.easeCubicOut;
    circleRadius = 3;
    hoveredCircleRadius = 4.8;
    // Three-level highlight profile (restored):
    // selected > related > filtered
    selectedCircleRadius = 6.2;
    relatedCircleRadius = 3.9;
    markerStrokeColor = "#f8fafc";
    markerStrokeWidth = 0.9;
    hoveredStrokeColor = "#f59e0b";
    hoveredStrokeWidth = 2.2;
    selectedStrokeColor = "#0f172a";
    selectedStrokeWidth = 3.2;
    relatedStrokeColor = "#64748b";
    relatedStrokeWidth = 1.4;
    relatedOpacity = 0.6;
    filteredOpacity = 0.1;
    xScale;
    yScale;
    controllerMethods;
    itemPixelCache = [];
    itemByIndex;
    markerGroupByIndex;
    markerLevelByIndex;
    selectedIndexSet = new Set();
    selectedStateSet = new Set();
    lastHoveredIndex = null;
    lastVisDataRef = null;
    currentColorAttribute = null;
    attributeDirectionByField = null;


    constructor(el){
        this.el=el;
        scatterplotIdCounter += 1;
        this.colorGradientId = `scatterplotColorGradient-${scatterplotIdCounter}`;
        this.colorScale = d3.scaleSequential(this.colorInterpolator).clamp(true);
        this.itemByIndex = new Map();
        this.markerGroupByIndex = new Map();
        this.markerLevelByIndex = new Map();
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
            .attr("x", 0)
            .attr("y", -10)
            .attr("text-anchor", "start")
            .text("Legend")
        ;
        this.colorLegendNoteText = this.colorLegendG.append("text")
            .attr("class","scatterplotColorLegendNote")
            .attr("x", 0)
            .attr("y", this.colorLegendHeight + 14)
            .attr("text-anchor", "start")
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
            const xValue = this.getRawNumericValue(item, xAttribute);
            const yValue = this.getRawNumericValue(item, yAttribute);
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
        const tooltipLines = [
            `State: ${getStateNameWithCodeFromFips(itemData.state)}`,
            `Community: ${itemData.communityname}`,
            `ViolentCrimesPerPop: ${safeNumber(itemData.ViolentCrimesPerPop)}`,
            `Population index: ${safeNumber(itemData.population)} (${populationPercent})`
        ];
        const livabilityScore = Number(itemData.livabilityScore);
        if(Number.isFinite(livabilityScore)){
            tooltipLines.push(`LivabilityScore: ${safeNumber(livabilityScore)}`);
        }
        return tooltipLines.join("\n");
    }

    getRawNumericValue(itemData, attributeName){
        const rawValue = Number(itemData[attributeName]);
        return rawValue;
    }

    isLowerBetterAttribute(attributeName){
        const direction = this.attributeDirectionByField
            ? this.attributeDirectionByField[attributeName]
            : null
        ;
        return direction === 'lower';
    }

    updateMarkers(selection,xAttribute,yAttribute,colorAttribute, updateColor=true){
        // transform selection
        selection
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr("transform", (item)=>{
                // use scales to return shape position from data values
                const xValue = this.getRawNumericValue(item, xAttribute);
                const yValue = this.getRawNumericValue(item, yAttribute);

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

    applyMarkerLevelStyle(index, level){
        const markerNode = this.markerGroupByIndex.get(index);
        if(!markerNode){
            return;
        }
        const markerSelection = d3.select(markerNode);
        if(level === "selected"){
            markerSelection
                .raise()
                .style("opacity", 1)
            ;
            markerSelection.select(".markerCircle")
                .attr("r", this.selectedCircleRadius)
                .attr("stroke", this.selectedStrokeColor)
                .attr("stroke-width", this.selectedStrokeWidth)
            ;
            return;
        }
        if(level === "related"){
            markerSelection.style("opacity", this.relatedOpacity);
            markerSelection.select(".markerCircle")
                .attr("r", this.relatedCircleRadius)
                .attr("stroke", this.relatedStrokeColor)
                .attr("stroke-width", this.relatedStrokeWidth)
            ;
            return;
        }
        if(level === "filtered"){
            markerSelection.style("opacity", this.filteredOpacity);
            markerSelection.select(".markerCircle")
                .attr("r", this.circleRadius)
                .attr("stroke", this.markerStrokeColor)
                .attr("stroke-width", this.markerStrokeWidth)
            ;
            return;
        }

        markerSelection.style("opacity", this.defaultOpacity);
        markerSelection.select(".markerCircle")
            .attr("r", this.circleRadius)
            .attr("stroke", this.markerStrokeColor)
            .attr("stroke-width", this.markerStrokeWidth)
        ;
    }

    getMarkerLevelForSelection(index, selectedIndexSet, selectedStateSet, hasSelection){
        if(!hasSelection){
            return "default";
        }
        if(selectedIndexSet.has(index)){
            return "selected";
        }
        const itemData = this.itemByIndex.get(index);
        if(itemData && selectedStateSet.has(String(itemData.state))){
            return "related";
        }
        return "filtered";
    }

    highlightSelectedIndexes(selectedIndexes){
        const selectedIndexSet = new Set(
            (selectedIndexes || [])
                .filter((index)=>index!==undefined && index!==null)
        );
        const selectedStateSet = new Set();
        for(const index of selectedIndexSet){
            const itemData = this.itemByIndex.get(index);
            if(itemData && itemData.state !== undefined && itemData.state !== null){
                selectedStateSet.add(String(itemData.state));
            }
        }
        const hasSelection = selectedIndexSet.size > 0;

        for(const [index] of this.markerGroupByIndex.entries()){
            const nextLevel = this.getMarkerLevelForSelection(index, selectedIndexSet, selectedStateSet, hasSelection);
            const previousLevel = this.markerLevelByIndex.get(index);
            if(previousLevel === nextLevel){
                continue;
            }
            this.applyMarkerLevelStyle(index, nextLevel);
            this.markerLevelByIndex.set(index, nextLevel);
        }

        this.selectedIndexSet = selectedIndexSet;
        this.selectedStateSet = selectedStateSet;
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
        const markerLevel = this.markerLevelByIndex.get(index) || "default";
        this.applyMarkerLevelStyle(index, markerLevel);
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
        // State hover highlight is intentionally disabled in scatterplot:
        // only the directly hovered point should be emphasized.
        void hoveredState;
    }

    updateChartTexts(meta){
        if(!meta){
            return;
        }
        const setMultilineSvgText = (textSelection, textValue, lineHeight = 12)=>{
            if(!textSelection){
                return;
            }
            const x = Number(textSelection.attr("x")) || 0;
            const lines = String(textValue || "")
                .split("\n")
                .map((line)=>line.trim())
                .filter((line)=>line.length > 0)
            ;
            textSelection.text(null);
            if(lines.length === 0){
                return;
            }
            lines.forEach((line, index)=>{
                textSelection.append("tspan")
                    .attr("x", x)
                    .attr("dy", index === 0 ? 0 : lineHeight)
                    .text(line)
                ;
            });
        };
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
            this.colorLegendTitleText.text(meta.colorLabel || "attribute");
        }
        if(this.colorLegendNoteText){
            setMultilineSvgText(this.colorLegendNoteText, meta.colorUnit || "", 12);
        }
    }

    updateColorScaleAndLegend(visData, colorAttribute){
        const colorValues = visData
            .map((itemData)=>Number(itemData[colorAttribute]))
            .filter((value)=>Number.isFinite(value))
        ;
        let minValue = colorValues.length > 0 ? d3.min(colorValues) : 0;
        let maxValue = colorValues.length > 0 ? d3.max(colorValues) : 1;
        const isLivabilityColor = String(colorAttribute) === 'livabilityScore';

        if(minValue === maxValue){
            minValue = minValue - 0.01;
            maxValue = maxValue + 0.01;
        }
        this.colorScale.domain([minValue, maxValue]);

        const colorLegendScale = d3.scaleLinear()
            .domain([minValue, maxValue])
            .range([this.colorLegendHeight, 0])
        ;
        const tickFormatter = isLivabilityColor
            ? d3.format(".2f")
            : (minValue>=0 && maxValue<=1.00001
                ? d3.format(".0%")
                : d3.format(".2~g"))
        ;
        this.colorLegendAxisG
            .call(d3.axisRight(colorLegendScale).ticks(5).tickFormat(tickFormatter))
        ;
    }

    updateAxis = function(visData,xAttribute,yAttribute){
        const xAxisReversed = this.isLowerBetterAttribute(xAttribute);
        const yAxisReversed = this.isLowerBetterAttribute(yAttribute);
        this.xScale.range(xAxisReversed ? [this.width, 0] : [0, this.width]);
        this.yScale.range(yAxisReversed ? [0, this.height] : [this.height, 0]);

        // compute min max using d3.min/max(visData.map(item=>item.attribute))
        const xValues = visData
            .map((item)=>this.getRawNumericValue(item, xAttribute))
            .filter((value)=>Number.isFinite(value))
        ;
        const yValues = visData
            .map((item)=>this.getRawNumericValue(item, yAttribute))
            .filter((value)=>Number.isFinite(value))
        ;

        let xMin = xValues.length>0 ? d3.min(xValues) : 0;
        let xMax = xValues.length>0 ? d3.max(xValues) : 1;
        let yMin = yValues.length>0 ? d3.min(yValues) : 0;
        let yMax = yValues.length>0 ? d3.max(yValues) : 1;

        // For normalized metrics, keep axis domain fixed to [0,1]
        // so the top tick "1" is always visible and comparable.
        if(xMin >= 0 && xMax <= 1.00001){
            xMin = 0;
            xMax = 1;
        }
        if(yMin >= 0 && yMax <= 1.00001){
            yMin = 0;
            yMax = 1;
        }

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

    renderScatterplot = function (
        visData,
        xAttribute,
        yAttribute,
        colorAttribute,
        meta,
        controllerMethods,
        attributeDirectionByField = null
    ){
        this.controllerMethods = controllerMethods;
        this.attributeDirectionByField = attributeDirectionByField || null;
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
        this.markerLevelByIndex.clear();
        this.selectedIndexSet.clear();
        this.selectedStateSet.clear();
        this.lastHoveredIndex = null;
        this.lastVisDataRef = null;
        this.currentColorAttribute = null;
        this.attributeDirectionByField = null;
        d3.select(this.el).selectAll("*").remove();
    }
}
export default ScatterplotD3;
