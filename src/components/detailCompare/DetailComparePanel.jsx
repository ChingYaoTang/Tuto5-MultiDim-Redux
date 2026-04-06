import './DetailComparePanel.css';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { LIVABILITY_DIMENSIONS, LIVABILITY_SCORE_FIELD } from '../../livability/livabilityConfig';
import { getFriendlyAttributeLabel } from '../../utils/attributeLabels';
import { getStateLabelFromFips } from '../../utils/usStateFips';
import { setHoveredItem, setHoveredState, setSelectedItems } from '../../redux/ItemInteractionSlice';

// Beyond tutorial scope:
// Adds narrative summary/detail/compare logic on top of the linked views.

const GUIDE_HINTS = [
    'Brush points in the scatterplot to compare communities.',
    'Click a state in the hierarchy to focus its communities.'
];

const FIELD_DIRECTION_BY_NAME = LIVABILITY_DIMENSIONS.reduce((accumulator, dimension)=>{
    accumulator[dimension.scoreField] = 'higher';
    dimension.features.forEach((feature)=>{
        accumulator[feature.field] = feature.direction;
    });
    return accumulator;
}, {
    [LIVABILITY_SCORE_FIELD]: 'higher'
});

const toFiniteNumber = (value, fallback = NaN)=>{
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toScoreText = (value)=>{
    const numericValue = toFiniteNumber(value, NaN);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : 'n/a';
};

const toPrText = (percentileRank)=>{
    return Number.isFinite(percentileRank) ? `PR ${Math.round(percentileRank)}` : 'PR n/a';
};

const toCompactAttributeLabel = (fieldName)=>{
    const rawLabel = getFriendlyAttributeLabel(fieldName);
    return rawLabel.replace(/\s*\([^)]*\)/g, '');
};

const getCommunityLabel = (itemData)=>{
    const name = itemData && itemData.communityname;
    if(name === undefined || name === null || name === '?'){
        return `community-${itemData && itemData.index !== undefined ? itemData.index : 'unknown'}`;
    }
    return String(name);
};

const getDimensionScoreSummary = (itemData)=>{
    return LIVABILITY_DIMENSIONS.map((dimension)=>({
        id: dimension.id,
        label: dimension.label,
        fieldName: dimension.scoreField,
        score: toFiniteNumber(itemData[dimension.scoreField], NaN)
    }));
};

const getDimensionExtremes = (itemData)=>{
    const sortedScores = getDimensionScoreSummary(itemData)
        .filter((item)=>Number.isFinite(item.score))
        .sort((left, right)=>left.score - right.score)
    ;

    if(sortedScores.length === 0){
        return {
            strongest: null,
            weakest: null,
            strongestTwo: []
        };
    }

    return {
        strongest: sortedScores[sortedScores.length - 1],
        weakest: sortedScores[0],
        strongestTwo: [...sortedScores]
            .reverse()
            .slice(0, 2)
    };
};

const getSelectionModeLabel = (selectedItemCount)=>{
    if(selectedItemCount === 0){
        return 'Guide';
    }
    if(selectedItemCount === 1){
        return 'Detail';
    }
    return 'Compare';
};

const getPercentileDescriptor = (itemData, fieldName, visData)=>{
    const value = toFiniteNumber(itemData[fieldName], NaN);

    if(!Number.isFinite(value)){
        return 'data unavailable';
    }

    const allValues = visData
        .map((item)=>toFiniteNumber(item[fieldName], NaN))
        .filter((itemValue)=>Number.isFinite(itemValue))
    ;

    if(allValues.length === 0){
        return 'data unavailable';
    }

    const lowerThanShare = Math.round((allValues.filter((itemValue)=>itemValue > value).length / allValues.length) * 100);
    const higherThanShare = Math.round((allValues.filter((itemValue)=>itemValue < value).length / allValues.length) * 100);
    const direction = FIELD_DIRECTION_BY_NAME[fieldName];

    if(direction === 'lower'){
        return `lower than ${lowerThanShare}% of communities`;
    }
    if(direction === 'higher'){
        return `higher than ${higherThanShare}% of communities`;
    }

    if(higherThanShare >= lowerThanShare){
        return `higher than ${higherThanShare}% of communities`;
    }
    return `lower than ${lowerThanShare}% of communities`;
};

const getPercentileRankByField = (itemData, fieldName, visData)=>{
    const value = toFiniteNumber(itemData[fieldName], NaN);
    if(!Number.isFinite(value)){
        return NaN;
    }

    const allValues = visData
        .map((item)=>toFiniteNumber(item[fieldName], NaN))
        .filter((itemValue)=>Number.isFinite(itemValue))
    ;
    if(allValues.length === 0){
        return NaN;
    }

    const lowerCount = allValues.filter((itemValue)=>itemValue < value).length;
    const equalCount = allValues.filter((itemValue)=>itemValue === value).length;
    return ((lowerCount + (0.5 * equalCount)) / allValues.length) * 100;
};

const toUniqueItemsByIndex = (items = [])=>{
    const seenIndexes = new Set();
    const uniqueItems = [];
    items.forEach((item)=>{
        const index = item && item.index;
        if(index === undefined || index === null){
            return;
        }
        const key = String(index);
        if(seenIndexes.has(key)){
            return;
        }
        seenIndexes.add(key);
        uniqueItems.push(item);
    });
    return uniqueItems;
};

const getBestStrengthForCompare = (itemData)=>{
    const { strongest } = getDimensionExtremes(itemData);
    if(!strongest){
        return 'n/a';
    }
    return `${strongest.label} (${toScoreText(strongest.score)})`;
};

const getMainWeaknessForCompare = (itemData)=>{
    const { weakest } = getDimensionExtremes(itemData);
    if(!weakest){
        return 'n/a';
    }
    return `${weakest.label} (${toScoreText(weakest.score)})`;
};

function DetailComparePanel({
    visData = [],
    selectedItems = [],
    xAttributeName,
    yAttributeName,
    colorAttributeName
}){
    const dispatch = useDispatch();
    const itemByIndex = useMemo(()=>{
        const map = new Map();
        visData.forEach((item)=>{
            if(item && item.index !== undefined && item.index !== null){
                map.set(String(item.index), item);
            }
        });
        return map;
    }, [visData]);

    const resolvedSelectedItems = useMemo(()=>{
        const mergedItems = (selectedItems || []).map((item)=>{
            if(!item || item.index === undefined || item.index === null){
                return null;
            }
            return itemByIndex.get(String(item.index)) || item;
        });
        return toUniqueItemsByIndex(mergedItems.filter((item)=>item));
    }, [selectedItems, itemByIndex]);

    const selectionCount = resolvedSelectedItems.length;
    const panelModeLabel = getSelectionModeLabel(selectionCount);
    const handleCompareCommunityClick = (itemData)=>{
        if(!itemData){
            return;
        }
        dispatch(setHoveredItem({}));
        dispatch(setHoveredState(null));
        dispatch(setSelectedItems({
            items: [itemData],
            source: 'summary-compare-click'
        }));
    };

    if(selectionCount === 0){
        return (
            <section className="detailComparePanel">
                <div className="detailCompareHeader">
                    <h2>Summary</h2>
                    <span className="detailCompareModeBadge">{panelModeLabel}</span>
                </div>
                <div className="detailCompareGuideMode">
                    {GUIDE_HINTS.map((hintText)=>(
                        <p key={hintText}>{hintText}</p>
                    ))}
                </div>
            </section>
        );
    }

    if(selectionCount === 1){
        const itemData = resolvedSelectedItems[0];
        const communityLabel = getCommunityLabel(itemData);
        const stateLabel = getStateLabelFromFips(itemData.state);
        const overallPercentileRank = getPercentileRankByField(itemData, LIVABILITY_SCORE_FIELD, visData);
        const dimensionSummary = getDimensionScoreSummary(itemData).map((dimension)=>({
            ...dimension,
            percentileRank: getPercentileRankByField(itemData, dimension.fieldName, visData)
        }));
        const evidenceFields = [
            xAttributeName,
            yAttributeName,
            colorAttributeName || LIVABILITY_SCORE_FIELD
        ]
            .filter((fieldName)=>fieldName && fieldName !== LIVABILITY_SCORE_FIELD)
            .filter((fieldName, index, allFields)=>allFields.indexOf(fieldName) === index)
        ;

        return (
            <section className="detailComparePanel">
                <div className="detailCompareHeader">
                    <h2>Summary</h2>
                    <span className="detailCompareModeBadge">{panelModeLabel}</span>
                </div>

                <article className="detailDecisionCard detailDecisionCardCompact">
                    <div className="detailSection detailHeaderSectionCompact">
                        <div className="detailCardHeaderRow">
                            <div className="detailIdentityBlock">
                                <p className="detailIdentityInlineRow">
                                    <span className="detailCommunityName detailCommunityNameInline">{communityLabel}</span>
                                    <span className="detailInlineMetaDivider">|</span>
                                    <span className="detailInlineState">State: {stateLabel}</span>
                                </p>
                            </div>
                            <div className="detailScorePill">
                                <span>Overall livability score</span>
                                <strong>{toScoreText(itemData[LIVABILITY_SCORE_FIELD])}</strong>
                                <small>{toPrText(overallPercentileRank)}</small>
                            </div>
                        </div>
                    </div>

                    <div className="detailSection detailMetricsSectionCompact">
                        <div className="compactMetricsColumn">
                            <h4>Dimension snapshot</h4>
                            <div className="dimensionScoreGrid compactDimensionScoreGrid">
                                {dimensionSummary.map((dimension)=>(
                                    <div key={dimension.id} className="dimensionScoreItem compactDimensionScoreItem">
                                        <span>{dimension.label}</span>
                                        <div className="dimensionScoreValueBox dimensionScoreValueInline">
                                            <strong>{toScoreText(dimension.score)}</strong>
                                            <small>{toPrText(dimension.percentileRank)}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="compactMetricsColumn compactIndicatorsColumn">
                            <h4 className="compactIndicatorsTitle">Key indicators in context</h4>
                            <ul className="detailBulletList compactIndicatorList">
                                {evidenceFields.map((fieldName, index)=>{
                                    const metricLabel = toCompactAttributeLabel(fieldName);
                                    const percentileDescriptor = getPercentileDescriptor(itemData, fieldName, visData);
                                    return (
                                        <li key={`${fieldName}-${index}`}>
                                            <span className="compactIndicatorLabel">{metricLabel}</span>
                                            <span className="compactIndicatorValue">
                                                {toScoreText(itemData[fieldName])} ({percentileDescriptor})
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </article>
            </section>
        );
    }

    const sortedItems = [...resolvedSelectedItems].sort((left, right)=>{
        return toFiniteNumber(right[LIVABILITY_SCORE_FIELD], -Infinity) - toFiniteNumber(left[LIVABILITY_SCORE_FIELD], -Infinity);
    });

    const limitedItems = sortedItems.slice(0, 5);
    const compareXHeaderLabel = toCompactAttributeLabel(xAttributeName);
    const compareYHeaderLabel = toCompactAttributeLabel(yAttributeName);
    const compareMetaLine = sortedItems.length > 5
        ? 'Sorted by overall score (descending). Showing top 5 by current livability score.'
        : 'Sorted by overall score (descending).'
    ;

    return (
        <section className="detailComparePanel">
            <div className="detailCompareHeader">
                <h2>Summary</h2>
                <span className="detailCompareModeBadge">{panelModeLabel}</span>
            </div>

            <div className="comparePanelBody">
                <p className="comparePanelMetaLine">{compareMetaLine}</p>
                <div className="compareTableWrap">
                    <table className="compareTable">
                        <thead>
                            <tr>
                                <th>Community</th>
                                <th>State</th>
                                <th>Overall score</th>
                                <th>{compareXHeaderLabel}</th>
                                <th>{compareYHeaderLabel}</th>
                                <th>Best strength</th>
                                <th>Main weakness</th>
                            </tr>
                        </thead>
                        <tbody>
                            {limitedItems.map((itemData)=>{
                                return (
                                    <tr key={String(itemData.index)}>
                                        <td>
                                            <button
                                                type="button"
                                                className="compareCommunityButton"
                                                onClick={()=>handleCompareCommunityClick(itemData)}
                                            >
                                                {getCommunityLabel(itemData)}
                                            </button>
                                        </td>
                                        <td>{getStateLabelFromFips(itemData.state)}</td>
                                        <td>{toScoreText(itemData[LIVABILITY_SCORE_FIELD])}</td>
                                        <td>{toScoreText(itemData[xAttributeName])}</td>
                                        <td>{toScoreText(itemData[yAttributeName])}</td>
                                        <td>{getBestStrengthForCompare(itemData)}</td>
                                        <td>{getMainWeaknessForCompare(itemData)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

export default DetailComparePanel;
