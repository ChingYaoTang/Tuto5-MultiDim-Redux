import * as d3 from 'd3'
import { getStateLabelFromFips, getStateNameWithCodeFromFips } from '../../utils/usStateFips';

class HierarchyD3 {
    margin = {top: 64, right: 8, bottom: 6, left: 8};
    size;
    width;
    height;
    rootSvg;
    svg;
    communityLayer;
    stateLayer;
    labelLayer;
    linkLayer;
    backgroundRect;
    colorScale;
    layoutInfoText;
    currentLayoutType = 'treemap';
    defaultLeafOpacity = 0.85;
    dimmedLeafOpacity = 0.12;
    transitionDuration = 160;
    transitionEase = d3.easeCubicOut;
    selectedCommunityIndexSet = new Set();
    selectedStateSet = new Set();
    currentRenderHeight = 0;

    constructor(el){
        this.el = el;
    }

    create = function(config){
        this.size = {width: config.size.width, height: config.size.height};
        this.width = this.size.width - this.margin.left - this.margin.right;
        this.height = this.size.height - this.margin.top - this.margin.bottom;
        this.currentRenderHeight = this.height;

        this.rootSvg = d3.select(this.el).append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.currentRenderHeight + this.margin.top + this.margin.bottom)
        ;
        this.svg = this.rootSvg
            .append('g')
            .attr('class', 'hierarchySvgG')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`)
        ;

        this.svg.append('text')
            .attr('class', 'hierarchyTitle')
            .attr('x', 0)
            .attr('y', -40)
            .text('Hierarchy: state -> communityname')
        ;

        this.svg.append('text')
            .attr('class', 'hierarchyLegend')
            .attr('x', 0)
            .attr('y', -22)
            .text('Area/Radius = population | Color = ViolentCrimesPerPop')
        ;

        this.layoutInfoText = this.svg.append('text')
            .attr('class', 'hierarchyLayoutInfo')
            .attr('x', 0)
            .attr('y', -6)
            .text('Layout: treemap')
        ;

        this.colorScale = d3.scaleSequential(d3.interpolateYlOrRd).clamp(true);
        this.backgroundRect = this.svg.append('rect')
            .attr('class', 'hierarchyBackground')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.width)
            .attr('height', this.currentRenderHeight)
            .attr('fill', 'transparent')
        ;

        this.linkLayer = this.svg.append('g').attr('class', 'linkLayer');
        this.communityLayer = this.svg.append('g').attr('class', 'communityLayer');
        this.stateLayer = this.svg.append('g').attr('class', 'stateLayer');
        this.labelLayer = this.svg.append('g').attr('class', 'stateLabelLayer');
    }

    getNumericValue(value, fallback = 0){
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : fallback;
    }

    getStateLabel(stateValue){
        return getStateLabelFromFips(stateValue);
    }

    getCommunityLabel(itemData){
        const rawName = itemData.communityname;
        if(rawName === undefined || rawName === null || rawName === '?'){
            return `community-${itemData.index}`;
        }
        return String(rawName);
    }

    updateColorDomain(visData){
        const crimeValues = visData
            .map((item)=>this.getNumericValue(item.ViolentCrimesPerPop, NaN))
            .filter((value)=>Number.isFinite(value))
        ;
        let minValue = crimeValues.length > 0 ? d3.min(crimeValues) : 0;
        let maxValue = crimeValues.length > 0 ? d3.max(crimeValues) : 1;

        if(minValue === maxValue){
            minValue = minValue - 0.01;
            maxValue = maxValue + 0.01;
        }
        this.colorScale.domain([minValue, maxValue]);
    }

    buildHierarchyData(visData){
        const stateGroups = d3.group(visData, (itemData)=>this.getStateLabel(itemData.state));

        return {
            name: 'US',
            nodeType: 'root',
            children: Array.from(stateGroups, ([stateName, items])=>{
                const children = items.map((itemData)=>{
                    const population = this.getNumericValue(itemData.population, 0);
                    const violentCrime = this.getNumericValue(itemData.ViolentCrimesPerPop, 0);
                    return {
                        name: this.getCommunityLabel(itemData),
                        nodeType: 'community',
                        // area/radius encodes population; keep a tiny lower bound to preserve visibility.
                        layoutWeight: Math.max(population, 0.0001),
                        population: population,
                        violentCrime: violentCrime,
                        medIncome: this.getNumericValue(itemData.medIncome, 0),
                        itemData: itemData
                    };
                });

                return {
                    name: stateName,
                    nodeType: 'state',
                    stateValue: items.length>0 ? items[0].state : null,
                    stateItems: items,
                    communityCount: items.length,
                    meanViolentCrime: d3.mean(children, (child)=>child.violentCrime) || 0,
                    children: children
                };
            })
        };
    }

    buildHierarchyRoot(visData){
        const hierarchyData = this.buildHierarchyData(visData);
        return d3.hierarchy(hierarchyData)
            .sum((nodeData)=>nodeData.nodeType === 'community' ? nodeData.layoutWeight : 0)
            .sort((a, b)=>d3.descending(a.value, b.value))
        ;
    }

    computeLayoutRoot(visData, layoutType, renderHeight){
        const root = this.buildHierarchyRoot(visData);

        if(layoutType === 'pack'){
            d3.pack()
                .size([this.width, renderHeight])
                .padding(2)
                (root)
            ;
            return root;
        }

        if(layoutType === 'tree'){
            d3.tree()
                .size([renderHeight, this.width - 8])
                .separation((a, b)=>(a.parent === b.parent ? 1 : 1.6))
                (root)
            ;
            return root;
        }

        d3.treemap()
            .size([this.width, renderHeight])
            .paddingOuter(2)
            .paddingInner(1)
            .paddingTop((node)=>node.depth === 1 ? 16 : 0)
            (root)
        ;
        return root;
    }

    getStateNodes(root){
        return root.descendants().filter((node)=>node.depth === 1);
    }

    getCommunityNodes(root){
        return root.leaves();
    }

    getCompactStateLabel(stateName){
        if(!stateName){
            return '';
        }
        const words = String(stateName)
            .split(/\s+/)
            .filter((word)=>word && word.toLowerCase() !== 'of')
        ;
        if(words.length >= 2){
            return words.map((word)=>word[0].toUpperCase()).join('').slice(0, 3);
        }
        if(stateName.length <= 6){
            return stateName;
        }
        return `${stateName.slice(0, 3)}.`;
    }

    getTreemapStateLabel(node){
        const width = Math.max(0, node.x1 - node.x0);
        const height = Math.max(0, node.y1 - node.y0);
        const stateName = node.data.name;
        const communityCount = node.data.communityCount;

        if(width >= 96 && height >= 13){
            return `${stateName} (${communityCount})`;
        }
        if(width >= 62 && height >= 12){
            return `${stateName}`;
        }
        if(width >= 28 && height >= 10){
            return this.getCompactStateLabel(stateName);
        }
        return '';
    }

    getTreemapStateLabelY(node){
        const height = Math.max(0, node.y1 - node.y0);
        return node.y0 + Math.max(8, Math.min(11, height - 2));
    }

    getPackStateLabel(node){
        const radius = Math.max(0, node.r);
        const stateName = node.data.name;
        if(radius >= 52){
            return stateName;
        }
        if(radius >= 22){
            return this.getCompactStateLabel(stateName);
        }
        return '';
    }

    getPackStateLabelFontSize(node){
        const radius = Math.max(0, node.r);
        if(radius >= 56){
            return '10px';
        }
        if(radius >= 34){
            return '9px';
        }
        return '8px';
    }

    getLayoutRenderHeight(layoutType, visData){
        if(layoutType !== 'tree'){
            return this.height;
        }
        const leafCount = Array.isArray(visData) ? visData.length : 0;
        const adaptiveHeight = leafCount > 0 ? (leafCount * 2.8) : this.height;
        return Math.max(this.height, Math.min(7200, adaptiveHeight));
    }

    setRenderableHeight(renderHeight){
        this.currentRenderHeight = renderHeight;
        if(this.rootSvg){
            this.rootSvg.attr('height', this.currentRenderHeight + this.margin.top + this.margin.bottom);
        }
        if(this.backgroundRect){
            this.backgroundRect.attr('height', this.currentRenderHeight);
        }
    }

    getCommunityTooltipText(node){
        return `State: ${node.parent.data.name}\nCommunity: ${node.data.name}\nPopulation: ${node.data.population.toFixed(3)}\nViolentCrimesPerPop: ${node.data.violentCrime.toFixed(3)}\nMedIncome: ${node.data.medIncome.toFixed(3)}`;
    }

    getStateTooltipText(node){
        return `State: ${getStateNameWithCodeFromFips(node.data.stateValue)}\nCommunities: ${node.data.communityCount}\nMean ViolentCrimesPerPop: ${node.data.meanViolentCrime.toFixed(3)}`;
    }

    bindCommunityEvents(selection, controllerMethods){
        selection
            .on('click', (event, node)=>{
                if(controllerMethods && controllerMethods.handleOnClickCommunity){
                    controllerMethods.handleOnClickCommunity(node.data.itemData);
                }
            })
            .on('mouseenter', (event, node)=>{
                if(controllerMethods && controllerMethods.handleOnMouseEnterCommunity){
                    controllerMethods.handleOnMouseEnterCommunity(node.data.itemData);
                }
            })
            .on('mouseleave', ()=>{
                if(controllerMethods && controllerMethods.handleOnMouseLeaveCommunity){
                    controllerMethods.handleOnMouseLeaveCommunity();
                }
            })
        ;
    }

    bindStateEvents(selection, controllerMethods){
        selection
            .on('click', (event, node)=>{
                if(controllerMethods && controllerMethods.handleOnClickState){
                    controllerMethods.handleOnClickState(node.data);
                }
            })
            .on('mouseenter', (event, node)=>{
                if(controllerMethods && controllerMethods.handleOnMouseEnterState){
                    controllerMethods.handleOnMouseEnterState(node.data);
                }
            })
            .on('mouseleave', ()=>{
                if(controllerMethods && controllerMethods.handleOnMouseLeaveState){
                    controllerMethods.handleOnMouseLeaveState();
                }
            })
        ;
    }

    bindBackgroundEvents(controllerMethods){
        if(!this.backgroundRect){
            return;
        }
        this.backgroundRect.on('click', ()=>{
            if(controllerMethods && controllerMethods.handleOnClickBackground){
                controllerMethods.handleOnClickBackground();
            }
        });
    }

    renderRectBasedLayout(root, controllerMethods){
        const stateNodes = this.getStateNodes(root);
        const communityNodes = this.getCommunityNodes(root);

        const stateJoin = this.stateLayer
            .selectAll('.stateNode')
            .data(stateNodes, (node)=>node.data.name)
            .join(
                (enter)=>{
                    const stateNodeG = enter.append('g').attr('class', 'stateNode');
                    stateNodeG.append('rect').attr('class', 'stateShape');
                    stateNodeG.append('title');
                    return stateNodeG;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;

        stateJoin.select('.stateShape')
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('x', (node)=>node.x0)
            .attr('y', (node)=>node.y0)
            .attr('width', (node)=>Math.max(0, node.x1 - node.x0))
            .attr('height', (node)=>Math.max(0, node.y1 - node.y0))
            .attr('fill', 'none')
        ;
        this.bindStateEvents(stateJoin, controllerMethods);
        stateJoin.select('title')
            .text((node)=>this.getStateTooltipText(node))
        ;
        
        const stateLabelJoin = this.labelLayer
            .selectAll('.stateLabel')
            .data(stateNodes, (node)=>node.data.name)
            .join(
                (enter)=>{
                    const stateLabel = enter.append('text').attr('class', 'stateLabel');
                    stateLabel.append('title');
                    return stateLabel;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
            .attr('x', (node)=>node.x0 + 4)
            .attr('y', (node)=>this.getTreemapStateLabelY(node))
            .style('font-size', (node)=>{
                const width = Math.max(0, node.x1 - node.x0);
                if(width < 48){
                    return '8px';
                }
                if(width < 72){
                    return '9px';
                }
                return '10px';
            })
            .text((node)=>this.getTreemapStateLabel(node))
            .style('display', (node)=>this.getTreemapStateLabel(node) ? null : 'none')
        ;
        this.bindStateEvents(stateLabelJoin, controllerMethods);
        stateLabelJoin.select('title')
            .text((node)=>this.getStateTooltipText(node))
        ;

        const communityJoin = this.communityLayer
            .selectAll('.communityNode')
            .data(communityNodes, (node)=>node.data.itemData.index)
            .join(
                (enter)=>{
                    const communityNodeG = enter.append('g')
                        .attr('class', 'communityNode')
                        .style('opacity', this.defaultLeafOpacity)
                    ;
                    communityNodeG.append('rect').attr('class', 'communityShape');
                    communityNodeG.append('title');
                    return communityNodeG;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;

        this.bindCommunityEvents(communityJoin, controllerMethods);

        communityJoin.select('.communityShape')
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('x', (node)=>node.x0)
            .attr('y', (node)=>node.y0)
            .attr('width', (node)=>Math.max(0, node.x1 - node.x0))
            .attr('height', (node)=>Math.max(0, node.y1 - node.y0))
            .attr('fill', (node)=>this.colorScale(node.data.violentCrime))
        ;

        communityJoin.select('title')
            .text((node)=>this.getCommunityTooltipText(node))
        ;
    }

    renderPackLayout(root, controllerMethods){
        const stateNodes = this.getStateNodes(root);
        const communityNodes = this.getCommunityNodes(root);

        const stateJoin = this.stateLayer
            .selectAll('.stateNode')
            .data(stateNodes, (node)=>node.data.name)
            .join(
                (enter)=>{
                    const stateNodeG = enter.append('g').attr('class', 'stateNode');
                    stateNodeG.append('circle').attr('class', 'stateShape');
                    stateNodeG.append('title');
                    return stateNodeG;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;

        stateJoin.select('.stateShape')
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('cx', (node)=>node.x)
            .attr('cy', (node)=>node.y)
            .attr('r', (node)=>Math.max(0, node.r))
            .attr('fill', 'none')
        ;
        this.bindStateEvents(stateJoin, controllerMethods);
        stateJoin.select('title')
            .text((node)=>this.getStateTooltipText(node))
        ;
        
        const stateLabelJoin = this.labelLayer
            .selectAll('.stateLabel')
            .data(stateNodes, (node)=>node.data.name)
            .join(
                (enter)=>{
                    const stateLabel = enter.append('text').attr('class', 'stateLabel');
                    stateLabel.append('title');
                    return stateLabel;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
            .attr('x', (node)=>node.x)
            .attr('y', (node)=>node.y + 1)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', (node)=>this.getPackStateLabelFontSize(node))
            .style('display', (node)=>this.getPackStateLabel(node) ? null : 'none')
            .text((node)=>this.getPackStateLabel(node))
        ;
        this.bindStateEvents(stateLabelJoin, controllerMethods);
        stateLabelJoin.select('title')
            .text((node)=>this.getStateTooltipText(node))
        ;

        const communityJoin = this.communityLayer
            .selectAll('.communityNode')
            .data(communityNodes, (node)=>node.data.itemData.index)
            .join(
                (enter)=>{
                    const communityNodeG = enter.append('g')
                        .attr('class', 'communityNode')
                        .style('opacity', this.defaultLeafOpacity)
                    ;
                    communityNodeG.append('circle').attr('class', 'communityShape');
                    communityNodeG.append('title');
                    return communityNodeG;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;

        this.bindCommunityEvents(communityJoin, controllerMethods);

        communityJoin.select('.communityShape')
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('cx', (node)=>node.x)
            .attr('cy', (node)=>node.y)
            .attr('r', (node)=>Math.max(0, node.r))
            .attr('fill', (node)=>this.colorScale(node.data.violentCrime))
        ;

        communityJoin.select('title')
            .text((node)=>this.getCommunityTooltipText(node))
        ;
    }

    renderTreeLayout(root, controllerMethods){
        const stateNodes = this.getStateNodes(root);
        const communityNodes = this.getCommunityNodes(root);
        const linkGenerator = d3.linkHorizontal()
            .x((node)=>node.y)
            .y((node)=>node.x)
        ;
        const linkData = root.links().filter((link)=>link.target.depth > 0);
        const linkJoin = this.linkLayer
            .selectAll('.treeLink')
            .data(
                linkData,
                (link)=>link.target.depth === 2
                    ? `community-${link.target.data.itemData.index}`
                    : `state-${link.target.data.name}`
            )
            .join(
                (enter)=>enter.append('path').attr('class', 'treeLink'),
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;
        linkJoin
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('d', linkGenerator)
        ;

        const populationValues = communityNodes.map((node)=>this.getNumericValue(node.data.population, 0));
        let minPopulation = populationValues.length > 0 ? d3.min(populationValues) : 0;
        let maxPopulation = populationValues.length > 0 ? d3.max(populationValues) : 1;
        if(minPopulation === maxPopulation){
            minPopulation = Math.max(0, minPopulation - 0.01);
            maxPopulation = maxPopulation + 0.01;
        }
        const communityRadiusScale = d3.scaleSqrt()
            .domain([minPopulation, maxPopulation])
            .range([1.8, 4.8])
        ;

        const stateJoin = this.stateLayer
            .selectAll('.stateNode')
            .data(stateNodes, (node)=>node.data.name)
            .join(
                (enter)=>{
                    const stateNodeG = enter.append('g').attr('class', 'stateNode');
                    stateNodeG.append('circle').attr('class', 'stateShape');
                    stateNodeG.append('title');
                    return stateNodeG;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;
        stateJoin.select('.stateShape')
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('cx', (node)=>node.y)
            .attr('cy', (node)=>node.x)
            .attr('r', 5.2)
            .attr('fill', 'none')
        ;
        this.bindStateEvents(stateJoin, controllerMethods);
        stateJoin.select('title')
            .text((node)=>this.getStateTooltipText(node))
        ;

        const stateLabelJoin = this.labelLayer
            .selectAll('.stateLabel')
            .data(stateNodes, (node)=>node.data.name)
            .join(
                (enter)=>{
                    const stateLabel = enter.append('text').attr('class', 'stateLabel');
                    stateLabel.append('title');
                    return stateLabel;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
            .attr('x', (node)=>node.y + 8)
            .attr('y', (node)=>node.x + 4)
            .text((node)=>`${node.data.name} (${node.data.communityCount})`)
        ;
        this.bindStateEvents(stateLabelJoin, controllerMethods);
        stateLabelJoin.select('title')
            .text((node)=>this.getStateTooltipText(node))
        ;

        const communityJoin = this.communityLayer
            .selectAll('.communityNode')
            .data(communityNodes, (node)=>node.data.itemData.index)
            .join(
                (enter)=>{
                    const communityNodeG = enter.append('g')
                        .attr('class', 'communityNode')
                        .style('opacity', this.defaultLeafOpacity)
                    ;
                    communityNodeG.append('circle').attr('class', 'communityShape');
                    communityNodeG.append('title');
                    return communityNodeG;
                },
                (update)=>update,
                (exit)=>exit.remove()
            )
        ;
        this.bindCommunityEvents(communityJoin, controllerMethods);

        communityJoin.select('.communityShape')
            .transition().duration(this.transitionDuration).ease(this.transitionEase)
            .attr('cx', (node)=>node.y)
            .attr('cy', (node)=>node.x)
            .attr('r', (node)=>communityRadiusScale(this.getNumericValue(node.data.population, 0)))
            .attr('fill', (node)=>this.colorScale(node.data.violentCrime))
        ;
        communityJoin.select('title')
            .text((node)=>this.getCommunityTooltipText(node))
        ;
    }

    clearLayersForLayout(){
        this.linkLayer.selectAll('*').remove();
        this.communityLayer.selectAll('*').remove();
        this.stateLayer.selectAll('*').remove();
        this.labelLayer.selectAll('*').remove();
    }

    renderHierarchy(visData, controllerMethods, layoutType = 'treemap'){
        if(!Array.isArray(visData) || visData.length === 0){
            return;
        }

        this.currentLayoutType = layoutType;
        this.layoutInfoText.text(`Layout: ${layoutType}`);
        this.bindBackgroundEvents(controllerMethods);
        const renderHeight = this.getLayoutRenderHeight(layoutType, visData);
        this.setRenderableHeight(renderHeight);

        this.updateColorDomain(visData);
        const root = this.computeLayoutRoot(visData, layoutType, renderHeight);

        this.clearLayersForLayout();

        if(layoutType === 'pack'){
            this.renderPackLayout(root, controllerMethods);
            return;
        }

        if(layoutType === 'tree'){
            this.renderTreeLayout(root, controllerMethods);
            return;
        }

        this.renderRectBasedLayout(root, controllerMethods);
    }

    highlightSelectedItems(selectedItems){
        const selectedIndexSet = new Set(
            (selectedItems || [])
                .map((item)=>item.index)
                .filter((index)=>index !== undefined && index !== null)
        );
        const selectedStateSet = new Set(
            (selectedItems || [])
                .map((item)=>this.getStateLabel(item.state))
        );

        const communityNodeSelection = this.communityLayer.selectAll('.communityNode');
        const stateNodeSelection = this.stateLayer.selectAll('.stateNode');
        this.selectedCommunityIndexSet = selectedIndexSet;
        this.selectedStateSet = selectedStateSet;

        if(selectedIndexSet.size === 0){
            communityNodeSelection.style('opacity', this.defaultLeafOpacity);
            communityNodeSelection.select('.communityShape')
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 0.5)
            ;
            stateNodeSelection.select('.stateShape')
                .attr('stroke', '#264653')
                .attr('stroke-width', 1.2)
                .attr('stroke-dasharray', null)
            ;
            return;
        }

        communityNodeSelection
            .style('opacity', (node)=>selectedIndexSet.has(node.data.itemData.index) ? 1 : this.dimmedLeafOpacity)
        ;
        communityNodeSelection.select('.communityShape')
            .attr('stroke', (node)=>selectedIndexSet.has(node.data.itemData.index) ? '#7c2d12' : '#ffffff')
            .attr('stroke-width', (node)=>selectedIndexSet.has(node.data.itemData.index) ? 2.8 : 0.5)
        ;
        stateNodeSelection.select('.stateShape')
            .attr('stroke', (node)=>selectedStateSet.has(node.data.name) ? '#7c2d12' : '#264653')
            .attr('stroke-width', (node)=>selectedStateSet.has(node.data.name) ? 2.8 : 1.2)
            .attr('stroke-dasharray', null)
        ;
    }

    highlightHoveredItem(hoveredItem){
        const hoveredIndex = hoveredItem && hoveredItem.index !== undefined && hoveredItem.index !== null
            ? hoveredItem.index
            : null
        ;
        if(hoveredIndex === null){
            return;
        }

        const hoveredStateName = this.getStateLabel(hoveredItem.state);
        const hoveredCommunitySelection = this.communityLayer.selectAll('.communityNode')
            .filter((node)=>node.data.itemData.index === hoveredIndex)
        ;
        const hoveredStateSelection = this.stateLayer.selectAll('.stateNode')
            .filter((node)=>node.data.name === hoveredStateName)
        ;

        hoveredCommunitySelection
            .raise()
            .style('opacity', 1)
        ;
        if(this.selectedCommunityIndexSet.has(hoveredIndex)){
            return;
        }
        hoveredCommunitySelection.select('.communityShape')
            .attr('stroke', '#2563eb')
            .attr('stroke-width', 1.6)
        ;

        if(this.selectedStateSet.has(hoveredStateName)){
            return;
        }
        hoveredStateSelection.select('.stateShape')
            .attr('stroke', '#2563eb')
            .attr('stroke-width', 1.8)
            .attr('stroke-dasharray', '4 2')
        ;
    }

    highlightHoveredState(hoveredState){
        if(hoveredState === null || hoveredState === undefined || hoveredState === ""){
            return;
        }

        const hoveredStateName = this.getStateLabel(hoveredState);
        if(this.selectedStateSet.has(hoveredStateName)){
            return;
        }
        const stateNodeSelection = this.stateLayer.selectAll('.stateNode')
            .filter((node)=>node.data.name === hoveredStateName)
        ;
        const communityNodeSelection = this.communityLayer.selectAll('.communityNode')
            .filter((node)=>node.parent && node.parent.data && node.parent.data.name === hoveredStateName)
        ;

        stateNodeSelection.select('.stateShape')
            .attr('stroke', '#2563eb')
            .attr('stroke-width', 1.8)
            .attr('stroke-dasharray', '4 2')
        ;
        communityNodeSelection
            .style('opacity', 1)
        ;
        communityNodeSelection.select('.communityShape')
            .attr('stroke', '#2563eb')
            .attr('stroke-width', 1.1)
        ;
    }

    clear = function(){
        d3.select(this.el).selectAll('*').remove();
    }
}

export default HierarchyD3;
