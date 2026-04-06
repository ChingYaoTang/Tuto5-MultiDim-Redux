import * as d3 from 'd3'
import { getStateLabelFromFips } from '../../utils/usStateFips';
import { getFriendlyAttributeLabel } from '../../utils/attributeLabels';

// Beyond tutorial scope:
// Extends the Tuto create/render/update pattern with linked brush interactions,
// custom legend/metadata text, and performance-oriented highlight updates.

let scatterplotIdCounter = 0;

class ScatterplotD3 {
    margin = {top: 84, right: 130, bottom: 52, left: 82};
    size;
    height;
    width;
    rootSvg;
    svg;
    brushG;
    brushBehavior;
    brushRafId = null;
    isProgrammaticBrushClear = false;
    pendingBrushSelection = null;
    lastBrushPreviewIndexes = null;
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
    // Beyond tutorial scope: custom diverging interpolation tuning for better contrast.
    colorInterpolator = (value)=>{
        // low value -> red, high value -> blue
        const clampedValue = Math.max(0, Math.min(1, Number(value)));
        // Boost saturation around the middle so points are less washed out.
        const centeredValue = (clampedValue - 0.5) * 2;
        const boostedValue = Math.sign(centeredValue) * Math.pow(Math.abs(centeredValue), 0.78);
        const remappedValue = 0.5 + (boostedValue / 2);
        const trimmedValue = 0.1 + (0.8 * remappedValue);
        return d3.interpolateRdBu(trimmedValue);
    };
    // add specific class properties used for the vis render/updates
    defaultOpacity=0.78;
    transitionDuration=160;
    transitionEase=d3.easeCubicOut;
    circleRadius = 3;
    hoveredCircleRadius = 4.8;
    hoveredStateCircleRadius = 4.2;
    // Three-level highlight profile (restored):
    // selected > related > filtered
    selectedCircleRadius = 6.2;
    relatedCircleRadius = 3.9;
    markerStrokeColor = "#f8fafc";
    markerStrokeWidth = 0.9;
    hoveredStrokeColor = "#f59e0b";
    hoveredStrokeWidth = 2.2;
    hoveredStateStrokeWidth = 1.8;
    selectedStrokeColor = "#0f172a";
    selectedStrokeWidth = 3.2;
    relatedStrokeColor = "#64748b";
    relatedStrokeWidth = 1.4;
    hoveredStateOpacity = 0.92;
    relatedOpacity = 0.6;
    filteredOpacity = 0.1;
    xScale;
    yScale;
    controllerMethods;
    itemPixelCache = [];
    itemByIndex;
    indexesByState;
    markerGroupByIndex;
    markerLevelByIndex;
    selectedIndexSet = new Set();
    selectedStateSet = new Set();
    brushPreviewSelectedIndexSet = new Set();
    isBrushPreviewActive = false;
    isBrushing = false;
    lastHoveredIndex = null;
    lastHoveredStateIndexSet = new Set();
    lastVisDataRef = null;
    lastXAttribute = null;
    lastYAttribute = null;
    currentColorAttribute = null;
    attributeDirectionByField = null;
    lastAxisTransitionTs = 0;
    axisTransitionCooldownMs = 140;


    constructor(el){
        this.el=el;
        scatterplotIdCounter += 1;
        this.colorGradientId = `scatterplotColorGradient-${scatterplotIdCounter}`;
        this.colorScale = d3.scaleSequential(this.colorInterpolator).clamp(true);
        this.itemByIndex = new Map();
        this.indexesByState = new Map();
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

        // Create axis/grid layers once; later updates only modify these layers.
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
            .attr("y", -54)
            .text("Scatterplot")
        ;
        this.chartSubtitleText = this.svg.append("text")
            .attr("class","scatterplotSubtitle")
            .attr("x", 0)
            .attr("y", -34)
            .text("X vs Y (Color: attribute)")
        ;
        this.xAxisLabelText = this.svg.append("text")
            .attr("class","scatterplotXAxisLabel")
            .attr("x", this.width / 2)
            .attr("y", this.height + 34)
            .attr("text-anchor","middle")
            .text("X Axis")
        ;
        this.yAxisLabelText = this.svg.append("text")
            .attr("class","scatterplotYAxisLabel")
            .attr("transform",`translate(${-56},${this.height / 2}) rotate(-90)`)
            .attr("text-anchor","middle")
            .text("Y Axis")
        ;
        // Beyond tutorial scope: dynamic color legend and explanatory note.
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
        // Beyond tutorial scope: persistent brush layer for linked multiview selection.
        this.brushG = this.svg.append("g")
            .attr("class","brushG")
        ;
        this.bindBrushInteraction();
    }

    rebuildItemPixelCache = function(visData, xAttribute, yAttribute){
        this.itemPixelCache = [];
        this.itemByIndex.clear();
        this.indexesByState.clear();
        // Precompute screen coordinates so brush selection does not query DOM each frame.
        visData.forEach((item)=>{
            this.itemByIndex.set(item.index, item);
            if(item.state !== undefined && item.state !== null){
                const stateKey = String(item.state);
                if(!this.indexesByState.has(stateKey)){
                    this.indexesByState.set(stateKey, []);
                }
                this.indexesByState.get(stateKey).push(item.index);
            }
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

    getItemTooltipText = function(itemData, xAttributeName, yAttributeName){
        const formatNumericValue = (value)=>{
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? numericValue.toFixed(3) : "n/a";
        };
        const tooltipLines = [
            `Community: ${itemData.communityname}`,
            `State: ${getStateLabelFromFips(itemData.state)}`,
            `ViolentCrimesPerPop: ${formatNumericValue(itemData.ViolentCrimesPerPop)}`,
            `Normalized Population Index [0-1]: ${formatNumericValue(itemData.population)}`,
            `LivabilityScore: ${formatNumericValue(itemData.livabilityScore)}`
        ];

        if(xAttributeName){
            tooltipLines.push(
                `X (${getFriendlyAttributeLabel(xAttributeName)}): ${formatNumericValue(itemData[xAttributeName])}`
            );
        }
        if(yAttributeName){
            tooltipLines.push(
                `Y (${getFriendlyAttributeLabel(yAttributeName)}): ${formatNumericValue(itemData[yAttributeName])}`
            );
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

    getMarkerTransform = function(itemData, xAttribute, yAttribute){
        const xValue = this.getRawNumericValue(itemData, xAttribute);
        const yValue = this.getRawNumericValue(itemData, yAttribute);

        // put non-numeric values outside the chart area
        if(!Number.isFinite(xValue) || !Number.isFinite(yValue)){
            return `translate(${-9999},${-9999})`;
        }
        const xPos = this.xScale(xValue);
        const yPos = this.yScale(yValue);
        return `translate(${xPos},${yPos})`;
    }

    updateMarkers(
        selection,
        xAttribute,
        yAttribute,
        colorAttribute,
        {
            updateColor = true,
            updatePosition = true,
            animatePosition = true
        } = {}
    ){
        if(updatePosition){
            selection.interrupt("marker-position");
            if(animatePosition){
                selection
                    .transition("marker-position")
                    .duration(this.transitionDuration)
                    .ease(this.transitionEase)
                    .attr("transform", (itemData)=>this.getMarkerTransform(itemData, xAttribute, yAttribute))
                ;
            }else{
                selection
                    .attr("transform", (itemData)=>this.getMarkerTransform(itemData, xAttribute, yAttribute))
                ;
            }
        }
        if(updateColor){
            selection.select(".markerCircle")
                .interrupt("marker-color")
                .attr("fill", (itemData)=>{
                    const colorValue = Number(itemData[colorAttribute]);
                    if(!Number.isFinite(colorValue)){
                        return "#6b7280";
                    }
                    return this.colorScale(colorValue);
                })
                .attr("fill-opacity", 0.95)
            ;
        }
    }

    applyMarkerLevelStyle(index, level, allowRaise = true){
        const markerNode = this.markerGroupByIndex.get(index);
        if(!markerNode){
            return;
        }
        const markerSelection = d3.select(markerNode);
        const markerCircleSelection = markerSelection.select(".markerCircle");
        markerCircleSelection.interrupt();
        if(level === "selected"){
            if(allowRaise){
                markerSelection.raise();
            }
            markerSelection.style("opacity", 1);
            markerCircleSelection
                .attr("r", this.selectedCircleRadius)
                .attr("stroke", this.selectedStrokeColor)
                .attr("stroke-width", this.selectedStrokeWidth)
            ;
            return;
        }
        if(level === "related"){
            markerSelection.style("opacity", this.relatedOpacity);
            markerCircleSelection
                .attr("r", this.relatedCircleRadius)
                .attr("stroke", this.relatedStrokeColor)
                .attr("stroke-width", this.relatedStrokeWidth)
            ;
            return;
        }
        if(level === "filtered"){
            markerSelection.style("opacity", this.filteredOpacity);
            markerCircleSelection
                .attr("r", this.circleRadius)
                .attr("stroke", this.markerStrokeColor)
                .attr("stroke-width", this.markerStrokeWidth)
            ;
            return;
        }

        markerSelection.style("opacity", this.defaultOpacity);
        markerCircleSelection
            .attr("r", this.circleRadius)
            .attr("stroke", this.markerStrokeColor)
            .attr("stroke-width", this.markerStrokeWidth)
        ;
    }

    applyMarkerBaseCircleStyle(index){
        const markerNode = this.markerGroupByIndex.get(index);
        if(!markerNode){
            return;
        }
        const markerCircleNode = markerNode.querySelector(".markerCircle");
        if(!markerCircleNode){
            return;
        }
        markerCircleNode.setAttribute("r", this.circleRadius);
        markerCircleNode.setAttribute("stroke", this.markerStrokeColor);
        markerCircleNode.setAttribute("stroke-width", this.markerStrokeWidth);
    }

    applyMarkerBrushPreviewStyle(index, level){
        const markerNode = this.markerGroupByIndex.get(index);
        if(!markerNode){
            return;
        }
        const markerCircleNode = markerNode.querySelector(".markerCircle");
        if(level === "selected"){
            markerNode.style.opacity = "1";
            if(markerCircleNode){
                markerCircleNode.setAttribute("r", this.selectedCircleRadius);
                markerCircleNode.setAttribute("stroke", this.selectedStrokeColor);
                markerCircleNode.setAttribute("stroke-width", this.selectedStrokeWidth);
            }
            return;
        }
        if(level === "filtered"){
            markerNode.style.opacity = String(this.filteredOpacity);
            return;
        }
        markerNode.style.opacity = String(this.defaultOpacity);
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

    buildSelectionContext(selectedIndexes){
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
        return {
            selectedIndexSet,
            selectedStateSet,
            hasSelection: selectedIndexSet.size > 0
        };
    }

    applySelectionContextFull(selectionContext, allowRaise = true){
        const { selectedIndexSet, selectedStateSet, hasSelection } = selectionContext;
        for(const [index] of this.markerGroupByIndex.entries()){
            const nextLevel = this.getMarkerLevelForSelection(index, selectedIndexSet, selectedStateSet, hasSelection);
            const previousLevel = this.markerLevelByIndex.get(index);
            if(previousLevel === nextLevel){
                continue;
            }
            this.applyMarkerLevelStyle(index, nextLevel, allowRaise);
            this.markerLevelByIndex.set(index, nextLevel);
        }

        this.selectedIndexSet = selectedIndexSet;
        this.selectedStateSet = selectedStateSet;
    }

    resetBrushPreviewState = function(){
        this.brushPreviewSelectedIndexSet = new Set();
        this.isBrushPreviewActive = false;
    }

    applyBrushPreviewSelection(selectedIndexes){
        const nextSelectedSet = new Set(
            (selectedIndexes || [])
                .filter((index)=>index!==undefined && index!==null)
        );
        const hasNextSelection = nextSelectedSet.size > 0;
        const hadPreview = this.isBrushPreviewActive;
        const hadSelection = this.brushPreviewSelectedIndexSet.size > 0;

        // Brush preview uses only selected/filtered/default levels for speed.
        // Full selected/related styling is restored on brush end.
        if(!hadPreview || hadSelection !== hasNextSelection){
            for(const [index] of this.markerGroupByIndex.entries()){
                const nextLevel = hasNextSelection
                    ? (nextSelectedSet.has(index) ? "selected" : "filtered")
                    : "default"
                ;
                const previousLevel = this.markerLevelByIndex.get(index);
                if(previousLevel !== "default"){
                    this.applyMarkerBaseCircleStyle(index);
                }
                this.applyMarkerBrushPreviewStyle(index, nextLevel);
                this.markerLevelByIndex.set(index, nextLevel);
            }
            this.brushPreviewSelectedIndexSet = nextSelectedSet;
            this.isBrushPreviewActive = true;
            return;
        }

        if(!hasNextSelection){
            this.brushPreviewSelectedIndexSet = nextSelectedSet;
            this.isBrushPreviewActive = true;
            return;
        }

        for(const index of this.brushPreviewSelectedIndexSet){
            if(nextSelectedSet.has(index)){
                continue;
            }
            const previousLevel = this.markerLevelByIndex.get(index);
            const nextLevel = "filtered";
            if(previousLevel === nextLevel){
                continue;
            }
            this.applyMarkerBaseCircleStyle(index);
            this.applyMarkerBrushPreviewStyle(index, nextLevel);
            this.markerLevelByIndex.set(index, nextLevel);
        }
        for(const index of nextSelectedSet){
            if(this.brushPreviewSelectedIndexSet.has(index)){
                continue;
            }
            const previousLevel = this.markerLevelByIndex.get(index);
            const nextLevel = "selected";
            if(previousLevel === nextLevel){
                continue;
            }
            this.applyMarkerBrushPreviewStyle(index, nextLevel);
            this.markerLevelByIndex.set(index, nextLevel);
        }
        this.brushPreviewSelectedIndexSet = nextSelectedSet;
        this.isBrushPreviewActive = true;
    }

    highlightSelectedIndexes(selectedIndexes){
        this.resetBrushPreviewState();
        const selectionContext = this.buildSelectionContext(selectedIndexes);
        this.applySelectionContextFull(selectionContext, true);
    }

    highlightSelectedIndexesDuringBrush(selectedIndexes){
        this.applyBrushPreviewSelection(selectedIndexes);
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
            .interrupt()
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr("stroke", this.hoveredStrokeColor)
            .attr("stroke-width", this.hoveredStrokeWidth)
            .attr("r", this.hoveredCircleRadius)
        ;
        this.lastHoveredIndex = hoveredIndex;
    }

    clearHoveredStateHighlights(){
        if(!this.lastHoveredStateIndexSet || this.lastHoveredStateIndexSet.size === 0){
            return;
        }
        this.lastHoveredStateIndexSet.forEach((index)=>{
            this.resetMarkerToBaseStyle(index);
        });
        this.lastHoveredStateIndexSet = new Set();
    }

    highlightHoveredState(hoveredState){
        this.clearHoveredStateHighlights();
        if(hoveredState === null || hoveredState === undefined || hoveredState === ""){
            return;
        }
        const hoveredStateKey = String(hoveredState);
        if(this.selectedStateSet.has(hoveredStateKey)){
            return;
        }
        const hoveredIndexes = this.indexesByState.get(hoveredStateKey) || [];
        const nextHoveredStateIndexSet = new Set();
        hoveredIndexes.forEach((index)=>{
            const markerNode = this.markerGroupByIndex.get(index);
            if(!markerNode){
                return;
            }
            const markerSelection = d3.select(markerNode);
            markerSelection
                .raise()
                .style("opacity", this.hoveredStateOpacity)
            ;
            if(this.selectedIndexSet.has(index)){
                return;
            }
            markerSelection.select(".markerCircle")
                .interrupt()
                .attr("stroke", this.hoveredStrokeColor)
                .attr("stroke-width", this.hoveredStateStrokeWidth)
                .attr("r", this.hoveredStateCircleRadius)
            ;
            nextHoveredStateIndexSet.add(index);
        });
        this.lastHoveredStateIndexSet = nextHoveredStateIndexSet;
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

    // Beyond tutorial scope: supports directional axis reversal and transition cooldown.
    updateAxis = function(visData,xAttribute,yAttribute, animateTransition = true){
        const xAxisReversed = this.isLowerBetterAttribute(xAttribute);
        const yAxisReversed = this.isLowerBetterAttribute(yAttribute);
        this.xScale.range(xAxisReversed ? [this.width, 0] : [0, this.width]);
        this.yScale.range(yAxisReversed ? [0, this.height] : [this.height, 0]);

        // Compute domain from current encoded attributes.
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

        this.xGridG.interrupt("axis-update");
        this.yGridG.interrupt("axis-update");
        const xAxisG = this.svg.select(".xAxisG");
        const yAxisG = this.svg.select(".yAxisG");
        xAxisG.interrupt("axis-update");
        yAxisG.interrupt("axis-update");

        const xGridAxis = d3.axisBottom(this.xScale)
            .ticks(xTickCount)
            .tickSize(-this.height)
            .tickFormat("")
        ;
        const yGridAxis = d3.axisLeft(this.yScale)
            .ticks(yTickCount)
            .tickSize(-this.width)
            .tickFormat("")
        ;
        const xAxis = d3.axisBottom(this.xScale).ticks(xTickCount).tickFormat(d3.format(".2f"));
        const yAxis = d3.axisLeft(this.yScale).ticks(yTickCount).tickFormat(d3.format(".2f"));

        if(animateTransition){
            this.xGridG
                .transition("axis-update")
                .duration(this.transitionDuration)
                .ease(this.transitionEase)
                .call(xGridAxis)
            ;
            this.yGridG
                .transition("axis-update")
                .duration(this.transitionDuration)
                .ease(this.transitionEase)
                .call(yGridAxis)
            ;

            // Update already-created axis groups with new scale definitions.
            xAxisG
                .transition("axis-update")
                .duration(this.transitionDuration)
                .ease(this.transitionEase)
                .call(xAxis)
            ;
            yAxisG
                .transition("axis-update")
                .duration(this.transitionDuration)
                .ease(this.transitionEase)
                .call(yAxis)
            ;
            return;
        }

        this.xGridG.call(xGridAxis);
        this.yGridG.call(yGridAxis);
        xAxisG.call(xAxis);
        yAxisG.call(yAxis);
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

    dispatchBrushSelection = function(controllerMethods, selectedIndexes, brushSelection){
        if(!controllerMethods || !controllerMethods.handleOnBrushSelection){
            return;
        }
        const selectedItems = selectedIndexes
            .map((index)=>this.itemByIndex.get(index))
            .filter((item)=>item!==undefined)
        ;
        controllerMethods.handleOnBrushSelection(
            selectedItems,
            brushSelection,
            "end"
        );
    }

    setMarkerPointerEventsEnabled = function(enabled){
        if(!this.svg){
            return;
        }
        this.svg.selectAll(".markerG")
            .style("pointer-events", enabled ? null : "none")
        ;
    }

    // Beyond tutorial scope: requestAnimationFrame brush preview + synchronized dispatch.
    bindBrushInteraction = function(){
        if(!this.brushG || this.brushBehavior){
            return;
        }

        const handleBrush = (event)=>{
            if(event.type === "start"){
                this.isBrushing = true;
                this.lastBrushPreviewIndexes = null;
                this.setMarkerPointerEventsEnabled(false);
                if(this.lastHoveredIndex !== null){
                    this.resetMarkerToBaseStyle(this.lastHoveredIndex);
                    this.lastHoveredIndex = null;
                }
                if(this.controllerMethods && this.controllerMethods.handleOnMouseLeave){
                    this.controllerMethods.handleOnMouseLeave();
                }
            }

            if(this.isProgrammaticBrushClear){
                if(event.type === "end"){
                    this.isProgrammaticBrushClear = false;
                    this.isBrushing = false;
                    this.lastBrushPreviewIndexes = null;
                    this.resetBrushPreviewState();
                    this.setMarkerPointerEventsEnabled(true);
                }
                return;
            }

            if(event.type === "end"){
                if(this.brushRafId !== null){
                    window.cancelAnimationFrame(this.brushRafId);
                    this.brushRafId = null;
                    this.pendingBrushSelection = null;
                }
                const endSelection = event.selection;
                const endIndexes = this.getSelectedIndexesInsideBrushSelection(endSelection);
                this.lastBrushPreviewIndexes = endIndexes;
                this.highlightSelectedIndexes(endIndexes);
                this.isBrushing = false;
                this.setMarkerPointerEventsEnabled(true);
                this.dispatchBrushSelection(this.controllerMethods, endIndexes, endSelection);
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
                if(
                    this.lastBrushPreviewIndexes
                    && this.areIndexArraysEqual(this.lastBrushPreviewIndexes, selectedIndexes)
                ){
                    return;
                }
                this.lastBrushPreviewIndexes = selectedIndexes;
                // keep brush drag smooth by updating local markers every frame.
                this.highlightSelectedIndexesDuringBrush(selectedIndexes);
            });
        };

        this.brushBehavior = d3.brush()
            .extent([[0, 0], [this.width, this.height]])
            .on("start", handleBrush)
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

    clearBrushSelection = function(){
        if(!this.brushG || !this.brushBehavior){
            return;
        }
        if(this.brushRafId !== null){
            window.cancelAnimationFrame(this.brushRafId);
            this.brushRafId = null;
        }
        this.pendingBrushSelection = null;
        this.isProgrammaticBrushClear = true;
        this.isBrushing = false;
        this.lastBrushPreviewIndexes = null;
        this.resetBrushPreviewState();
        this.setMarkerPointerEventsEnabled(true);
        this.brushG.call(this.brushBehavior.move, null);
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
        const axisAttributeChanged = this.lastXAttribute !== xAttribute || this.lastYAttribute !== yAttribute;
        const colorChanged = this.currentColorAttribute !== colorAttribute;
        const needsColorUpdate = dataChanged || colorChanged;
        const needsAxisUpdate = dataChanged || axisAttributeChanged;
        const needsMarkerPositionUpdate = dataChanged || axisAttributeChanged;
        let shouldAnimateAxisAndMarker = axisAttributeChanged && !dataChanged;
        const needsTooltipUpdate = dataChanged || axisAttributeChanged;
        if(shouldAnimateAxisAndMarker){
            const now = window.performance ? window.performance.now() : Date.now();
            shouldAnimateAxisAndMarker = (now - this.lastAxisTransitionTs) >= this.axisTransitionCooldownMs;
            this.lastAxisTransitionTs = now;
        }

        // Typical D3 update cycle: update scales/axes first, then join data to marks.
        this.updateChartTexts(meta);
        if(needsColorUpdate){
            this.updateColorScaleAndLegend(visData, colorAttribute);
            this.currentColorAttribute = colorAttribute;
        }
        if(needsAxisUpdate){
            this.updateAxis(visData,xAttribute,yAttribute, shouldAnimateAxisAndMarker);
            this.rebuildItemPixelCache(visData, xAttribute, yAttribute);
        }

        this.svg.selectAll(".markerG")
            // Keyed join keeps marker identity stable across updates.
            .data(visData,(itemData)=>itemData.index)
            .join(
                enter=>{
                    // Enter selection: create missing marker groups.
                    const itemG=enter.append("g")
                        .attr("class","markerG")
                        .style("opacity",this.defaultOpacity)
                        .style("pointer-events", this.isBrushing ? "none" : null)
                        .on("click", (event,itemData)=>{
                            if(this.isBrushing){
                                return;
                            }
                            if(this.controllerMethods && this.controllerMethods.handleOnClick){
                                this.controllerMethods.handleOnClick(itemData);
                            }
                        })
                        .on("mouseenter", (event,itemData)=>{
                            if(this.isBrushing){
                                return;
                            }
                            if(this.controllerMethods && this.controllerMethods.handleOnMouseEnter){
                                this.controllerMethods.handleOnMouseEnter(itemData);
                            }
                        })
                        .on("mouseleave", ()=>{
                            if(this.isBrushing){
                                return;
                            }
                            if(this.controllerMethods && this.controllerMethods.handleOnMouseLeave){
                                this.controllerMethods.handleOnMouseLeave();
                            }
                        })
                    ;
                    itemG.each((itemData, itemIndex, nodes)=>{
                        this.markerGroupByIndex.set(itemData.index, nodes[itemIndex]);
                    });
                    // Create mark primitives once; their attributes are updated below.
                    itemG.append("circle")
                        .attr("class","markerCircle")
                        .attr("r",this.circleRadius)
                        .attr("stroke",this.markerStrokeColor)
                        .attr("stroke-width",this.markerStrokeWidth)
                    ;
                    itemG.append("title");
                    itemG.select("title")
                        .text((itemData)=>this.getItemTooltipText(itemData, xAttribute, yAttribute))
                    ;
                    this.updateMarkers(itemG,xAttribute,yAttribute,colorAttribute, {
                        updateColor: true,
                        updatePosition: true,
                        animatePosition: false
                    });
                },
                update=>{
                    update.each((itemData, itemIndex, nodes)=>{
                        this.markerGroupByIndex.set(itemData.index, nodes[itemIndex]);
                    });
                    if(needsTooltipUpdate){
                        update.select("title")
                            .text((itemData)=>this.getItemTooltipText(itemData, xAttribute, yAttribute))
                        ;
                    }
                    this.updateMarkers(update,xAttribute,yAttribute,colorAttribute, {
                        updateColor: needsColorUpdate,
                        updatePosition: needsMarkerPositionUpdate,
                        animatePosition: shouldAnimateAxisAndMarker
                    })
                },
                exit =>{
                    // Exit selection: remove markers no longer present in data.
                    exit.each((itemData)=>{
                        this.markerGroupByIndex.delete(itemData.index);
                    });
                    exit.remove()
                    ;
                }

            )

        this.svg
            .on("mousemove.hoverclear", (event)=>{
                const target = event && event.target ? event.target : null;
                const isMarkerTarget = Boolean(
                    target
                    && typeof target.closest === "function"
                    && target.closest(".markerG")
                );
                if(!isMarkerTarget && this.lastHoveredIndex !== null){
                    this.resetMarkerToBaseStyle(this.lastHoveredIndex);
                    this.lastHoveredIndex = null;
                    if(this.controllerMethods && this.controllerMethods.handleOnMouseLeave){
                        this.controllerMethods.handleOnMouseLeave();
                    }
                }
            })
            .on("mouseleave.hoverclear", ()=>{
                if(this.lastHoveredIndex !== null){
                    this.resetMarkerToBaseStyle(this.lastHoveredIndex);
                    this.lastHoveredIndex = null;
                }
                if(this.controllerMethods && this.controllerMethods.handleOnMouseLeave){
                    this.controllerMethods.handleOnMouseLeave();
                }
            })
        ;

        this.bindBrushInteraction();
        this.lastVisDataRef = visData;
        this.lastXAttribute = xAttribute;
        this.lastYAttribute = yAttribute;
    }

    clear = function(){
        if(this.brushRafId !== null){
            window.cancelAnimationFrame(this.brushRafId);
            this.brushRafId = null;
        }
        this.pendingBrushSelection = null;
        this.isProgrammaticBrushClear = false;
        this.isBrushing = false;
        this.lastBrushPreviewIndexes = null;
        this.itemPixelCache = [];
        this.itemByIndex.clear();
        this.indexesByState.clear();
        this.markerGroupByIndex.clear();
        this.markerLevelByIndex.clear();
        this.resetBrushPreviewState();
        this.selectedIndexSet.clear();
        this.selectedStateSet.clear();
        this.lastHoveredIndex = null;
        this.lastHoveredStateIndexSet.clear();
        this.lastVisDataRef = null;
        this.lastXAttribute = null;
        this.lastYAttribute = null;
        this.currentColorAttribute = null;
        this.attributeDirectionByField = null;
        this.lastAxisTransitionTs = 0;
        // Unmount cleanup.
        d3.select(this.el).selectAll("*").remove();
    }
}
export default ScatterplotD3;
