import * as d3 from 'd3'
import { getStateLabelFromFips, normalizeFipsStateCode } from '../../utils/usStateFips';
import { getFriendlyAttributeLabel } from '../../utils/attributeLabels';

class HierarchyD3 {
    margin = {top: 42, right: 6, bottom: 6, left: 6};
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
    hierarchyTitleText;
    tooltipXAttributeName = null;
    tooltipYAttributeName = null;
    currentLayoutType = 'treemap';
    defaultLeafOpacity = 0.88;
    dimmedLeafOpacity = 0.08;
    relatedLeafOpacity = 0.54;
    transitionDuration = 160;
    transitionEase = d3.easeCubicOut;
    selectedCommunityIndexSet = new Set();
    selectedStateSet = new Set();
    currentRenderHeight = 0;
    selectedStrokeColor = '#000000';
    hoverStrokeColor = '#000000';
    relatedStrokeColor = '#64748b';
    selectedStrokeWidth = 4.6;
    hoverStrokeWidth = 3.8;
    relatedStrokeWidth = 1.9;

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

        this.hierarchyTitleText = this.svg.append('text')
            .attr('class', 'hierarchyTitle')
            .attr('x', 0)
            .attr('y', -14)
            .text(this.getMergedHeaderText(this.currentLayoutType))
        ;

        this.colorScale = d3.scaleSequential((value)=>{
            const trimmedValue = 0.08 + (0.84 * value);
            return d3.interpolateRdBu(trimmedValue);
        }).clamp(true);
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

    getLegendTextByLayout(layoutType){
        const sizeEncodingText = layoutType === 'treemap'
            ? 'Tile area = population'
            : 'Node radius = population'
        ;
        return `${sizeEncodingText} | Color = livability score (red low -> blue high)`;
    }

    getMergedHeaderText(layoutType){
        return `State and Community Livability | ${this.getLegendTextByLayout(layoutType)}`;
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
        const livabilityValues = visData
            .map((item)=>this.getNumericValue(item.livabilityScore, NaN))
            .filter((value)=>Number.isFinite(value))
        ;
        let minValue = livabilityValues.length > 0 ? d3.min(livabilityValues) : 0;
        let maxValue = livabilityValues.length > 0 ? d3.max(livabilityValues) : 1;

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
                    const livabilityScore = this.getNumericValue(itemData.livabilityScore, NaN);
                    return {
                        name: this.getCommunityLabel(itemData),
                        nodeType: 'community',
                        // area/radius encodes population; keep a tiny lower bound to preserve visibility.
                        layoutWeight: Math.max(population, 0.0001),
                        population: population,
                        violentCrime: violentCrime,
                        medIncome: this.getNumericValue(itemData.medIncome, 0),
                        livabilityScore: livabilityScore,
                        itemData: itemData
                    };
                });
                const livabilityValues = children
                    .map((child)=>child.livabilityScore)
                    .filter((value)=>Number.isFinite(value))
                ;

                return {
                    name: stateName,
                    nodeType: 'state',
                    stateValue: items.length>0 ? items[0].state : null,
                    stateItems: items,
                    communityCount: items.length,
                    totalPopulation: d3.sum(children, (child)=>child.population) || 0,
                    meanViolentCrime: d3.mean(children, (child)=>child.violentCrime) || 0,
                    meanLivabilityScore: livabilityValues.length > 0
                        ? (d3.mean(livabilityValues) || 0)
                        : null,
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

        if(width >= 96 && height >= 13){
            return `${stateName}`;
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
        const formatNumericValue = (value)=>{
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? numericValue.toFixed(3) : 'n/a';
        };
        const itemData = node.data.itemData || {};
        const tooltipLines = [
            `Community: ${node.data.name}`,
            `State: ${node.parent.data.name}`,
            `ViolentCrimesPerPop: ${formatNumericValue(itemData.ViolentCrimesPerPop)}`,
            `Normalized Population Index [0-1]: ${formatNumericValue(itemData.population)}`,
            `LivabilityScore: ${formatNumericValue(itemData.livabilityScore)}`
        ];

        if(this.tooltipXAttributeName){
            tooltipLines.push(
                `X (${getFriendlyAttributeLabel(this.tooltipXAttributeName)}): ${formatNumericValue(itemData[this.tooltipXAttributeName])}`
            );
        }
        if(this.tooltipYAttributeName){
            tooltipLines.push(
                `Y (${getFriendlyAttributeLabel(this.tooltipYAttributeName)}): ${formatNumericValue(itemData[this.tooltipYAttributeName])}`
            );
        }
        return tooltipLines.join('\n');
    }

    getStateTooltipText(node){
        const normalizedCode = normalizeFipsStateCode(node.data.stateValue);
        const stateCodeText = normalizedCode !== null
            ? String(normalizedCode).padStart(2, '0')
            : 'n/a'
        ;
        const tooltipLines = [
            `State: ${getStateLabelFromFips(node.data.stateValue)}`,
            `State code (FIPS): ${stateCodeText}`,
            `Communities: ${node.data.communityCount}`,
            `Total Normalized Population Index: ${node.data.totalPopulation.toFixed(3)}`
        ];
        return tooltipLines.join('\n');
    }

    bindCommunityEvents(selection, controllerMethods){
        selection
            .on('click', (event, node)=>{
                if(event && typeof event.stopPropagation === 'function'){
                    event.stopPropagation();
                }
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
                if(event && typeof event.stopPropagation === 'function'){
                    event.stopPropagation();
                }
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
        this.backgroundRect.on('click', (event)=>{
            if(event && typeof event.stopPropagation === 'function'){
                event.stopPropagation();
            }
            if(controllerMethods && controllerMethods.handleOnClickBackground){
                controllerMethods.handleOnClickBackground();
            }
        });
    }

    bindSvgBlankClick(controllerMethods){
        if(!this.svg){
            return;
        }
        this.svg.on('click.clearSelection', (event)=>{
            if(!controllerMethods || !controllerMethods.handleOnClickBackground){
                return;
            }
            const target = event && event.target ? event.target : null;
            const clickedInteractiveNode = Boolean(
                target
                && typeof target.closest === 'function'
                && target.closest('.communityNode, .stateNode, .stateLabel')
            );
            if(clickedInteractiveNode){
                return;
            }
            controllerMethods.handleOnClickBackground();
        });
    }

    updateNativeTitle(selection, titleAccessor){
        if(!selection){
            return;
        }
        selection.selectAll('title')
            .data((node)=>[node])
            .join('title')
            .text((node)=>titleAccessor(node))
        ;
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
        this.updateNativeTitle(stateJoin, (node)=>this.getStateTooltipText(node));
        
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
        this.updateNativeTitle(stateLabelJoin, (node)=>this.getStateTooltipText(node));

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
            .attr('fill', (node)=>{
                const livabilityValue = this.getNumericValue(node.data.livabilityScore, NaN);
                return Number.isFinite(livabilityValue)
                    ? this.colorScale(livabilityValue)
                    : '#94a3b8'
                ;
            })
        ;

        this.updateNativeTitle(communityJoin, (node)=>this.getCommunityTooltipText(node));
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
        this.updateNativeTitle(stateJoin, (node)=>this.getStateTooltipText(node));
        
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
        this.updateNativeTitle(stateLabelJoin, (node)=>this.getStateTooltipText(node));

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
            .attr('fill', (node)=>{
                const livabilityValue = this.getNumericValue(node.data.livabilityScore, NaN);
                return Number.isFinite(livabilityValue)
                    ? this.colorScale(livabilityValue)
                    : '#94a3b8'
                ;
            })
        ;

        this.updateNativeTitle(communityJoin, (node)=>this.getCommunityTooltipText(node));
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
        this.updateNativeTitle(stateJoin, (node)=>this.getStateTooltipText(node));

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
            .text((node)=>`${node.data.name}`)
        ;
        this.bindStateEvents(stateLabelJoin, controllerMethods);
        this.updateNativeTitle(stateLabelJoin, (node)=>this.getStateTooltipText(node));

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
            .attr('fill', (node)=>{
                const livabilityValue = this.getNumericValue(node.data.livabilityScore, NaN);
                return Number.isFinite(livabilityValue)
                    ? this.colorScale(livabilityValue)
                    : '#94a3b8'
                ;
            })
        ;
        this.updateNativeTitle(communityJoin, (node)=>this.getCommunityTooltipText(node));
    }

    clearLayersForLayout(){
        this.linkLayer.selectAll('*').remove();
        this.communityLayer.selectAll('*').remove();
        this.stateLayer.selectAll('*').remove();
        this.labelLayer.selectAll('*').remove();
    }

    renderHierarchy(visData, controllerMethods, layoutType = 'treemap', tooltipAttributes = {}){
        if(!Array.isArray(visData) || visData.length === 0){
            return;
        }

        this.currentLayoutType = layoutType;
        this.tooltipXAttributeName = tooltipAttributes.xAttributeName || null;
        this.tooltipYAttributeName = tooltipAttributes.yAttributeName || null;
        if(this.hierarchyTitleText){
            this.hierarchyTitleText.text(this.getMergedHeaderText(layoutType));
        }
        this.bindBackgroundEvents(controllerMethods);
        this.bindSvgBlankClick(controllerMethods);
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
        const stateLabelSelection = this.labelLayer.selectAll('.stateLabel');
        this.selectedCommunityIndexSet = selectedIndexSet;
        this.selectedStateSet = selectedStateSet;

        if(selectedIndexSet.size === 0){
            communityNodeSelection.style('opacity', this.defaultLeafOpacity);
            communityNodeSelection.select('.communityShape')
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 0.5)
                .attr('stroke-opacity', 1)
            ;
            stateNodeSelection.select('.stateShape')
                .attr('stroke', '#264653')
                .attr('stroke-width', 1.2)
                .attr('stroke-opacity', 1)
                .attr('stroke-dasharray', null)
            ;
            stateLabelSelection
                .style('opacity', 1)
                .style('font-weight', 500)
                .attr('fill', '#111827')
            ;
            return;
        }

        communityNodeSelection
            .style('opacity', (node)=>{
                if(selectedIndexSet.has(node.data.itemData.index)){
                    return 1;
                }
                const parentStateName = node.parent && node.parent.data ? node.parent.data.name : null;
                if(parentStateName && selectedStateSet.has(parentStateName)){
                    return this.relatedLeafOpacity;
                }
                return this.dimmedLeafOpacity;
            })
        ;
        communityNodeSelection.select('.communityShape')
            .attr('stroke', (node)=>{
                if(selectedIndexSet.has(node.data.itemData.index)){
                    return this.selectedStrokeColor;
                }
                const parentStateName = node.parent && node.parent.data ? node.parent.data.name : null;
                if(parentStateName && selectedStateSet.has(parentStateName)){
                    return this.relatedStrokeColor;
                }
                return '#ffffff';
            })
            .attr('stroke-width', (node)=>{
                if(selectedIndexSet.has(node.data.itemData.index)){
                    return this.selectedStrokeWidth;
                }
                const parentStateName = node.parent && node.parent.data ? node.parent.data.name : null;
                if(parentStateName && selectedStateSet.has(parentStateName)){
                    return this.relatedStrokeWidth;
                }
                return 0.5;
            })
            .attr('stroke-opacity', (node)=>{
                if(selectedIndexSet.has(node.data.itemData.index)){
                    return 1;
                }
                const parentStateName = node.parent && node.parent.data ? node.parent.data.name : null;
                if(parentStateName && selectedStateSet.has(parentStateName)){
                    return 0.95;
                }
                return 1;
            })
        ;
        stateNodeSelection.select('.stateShape')
            .attr('stroke', (node)=>selectedStateSet.has(node.data.name) ? this.selectedStrokeColor : '#264653')
            .attr('stroke-width', (node)=>selectedStateSet.has(node.data.name) ? this.selectedStrokeWidth : 1.2)
            .attr('stroke-opacity', (node)=>selectedStateSet.has(node.data.name) ? 1 : 0.4)
            .attr('stroke-dasharray', null)
        ;
        stateLabelSelection
            .style('opacity', (node)=>selectedStateSet.has(node.data.name) ? 1 : 0.45)
            .style('font-weight', (node)=>selectedStateSet.has(node.data.name) ? 700 : 500)
            .attr('fill', (node)=>selectedStateSet.has(node.data.name) ? '#0f172a' : '#64748b')
        ;
        communityNodeSelection
            .filter((node)=>selectedIndexSet.has(node.data.itemData.index))
            .raise()
        ;
        stateNodeSelection
            .filter((node)=>selectedStateSet.has(node.data.name))
            .raise()
        ;
        stateLabelSelection
            .filter((node)=>selectedStateSet.has(node.data.name))
            .raise()
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

        const hoveredCommunitySelection = this.communityLayer.selectAll('.communityNode')
            .filter((node)=>node.data.itemData.index === hoveredIndex)
        ;
        hoveredCommunitySelection
            .raise()
            .style('opacity', 1)
        ;
        if(this.selectedCommunityIndexSet.has(hoveredIndex)){
            return;
        }
        hoveredCommunitySelection.select('.communityShape')
            .attr('stroke', this.hoverStrokeColor)
            .attr('stroke-width', this.hoverStrokeWidth)
            .attr('stroke-opacity', 1)
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
        const stateLabelSelection = this.labelLayer.selectAll('.stateLabel')
            .filter((node)=>node.data.name === hoveredStateName)
        ;

        stateNodeSelection.select('.stateShape')
            .attr('stroke', this.hoverStrokeColor)
            .attr('stroke-width', this.hoverStrokeWidth)
            .attr('stroke-dasharray', null)
            .attr('stroke-opacity', 1)
        ;
        stateLabelSelection
            .style('opacity', 1)
            .style('font-weight', 700)
            .attr('fill', this.hoverStrokeColor)
        ;
    }

    clear = function(){
        d3.select(this.el).selectAll('*').remove();
    }
}

export default HierarchyD3;
