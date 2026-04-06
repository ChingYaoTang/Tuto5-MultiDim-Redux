import './App.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ScatterplotContainer from './components/scatterplot/ScatterplotContainer';
import HierarchyContainer from './components/hierarchy/HierarchyContainer';
import DetailComparePanel from './components/detailCompare/DetailComparePanel';
import { getDataSet } from './redux/DataSetSlice';
import { LIVABILITY_DIMENSIONS, LIVABILITY_SCORE_FIELD } from './livability/livabilityConfig';
import {
    enrichDataWithLivability
} from './livability/livabilityUtils';

const getDimensionTooltipText = (dimension)=>{
    return [
        `${dimension.label}`,
        '(Involved feature | Prefered direction | Weight):',
        ...dimension.features.map((feature)=>{
            const weightPercent = (feature.weight * 100).toFixed(0);
            const directionText = feature.direction === 'lower'
                ? 'lower is better'
                : 'higher is better'
            ;
            const weightedTransformText = feature.direction === 'lower'
                ? `(1-x) * ${weightPercent}%`
                : `(x) * ${weightPercent}%`
            ;
            return `- ${feature.field} | ${directionText} | ${weightedTransformText}`;
        })
    ].join('\n');
};

const CONTROL_PANEL_TOOLTIP_TEXT = [
    'How to use this panel:',
    '1) Give each dimension an integer importance from 0 to 10.',
    '2) Dimension weight = importance / sum of all six importance values.',
    '3) Hover each dimension name to inspect its feature-level rule.',
    '4) Updates are applied to all linked views in real time.'
].join('\n');

// Scatter dropdown order:
// [dimension importance input] -> [that dimension's selected features], repeated by dimension.
// Excludes the overall livability score.
const SCATTER_ATTRIBUTE_OPTIONS = Array.from(
    new Set(
        LIVABILITY_DIMENSIONS.flatMap((dimension)=>[
            dimension.scoreField,
            ...dimension.features.map((feature)=>feature.field)
        ])
    )
).filter((fieldName)=>fieldName !== LIVABILITY_SCORE_FIELD);
const DEFAULT_SCATTER_X_ATTRIBUTE = 'medIncome';
const DEFAULT_SCATTER_Y_ATTRIBUTE = 'ViolentCrimesPerPop';

const getDefaultDimensionRatings = ()=>{
    return LIVABILITY_DIMENSIONS.reduce((accumulator, dimension)=>{
        accumulator[dimension.id] = Math.round(dimension.defaultWeight * 10);
        return accumulator;
    }, {});
};

const toClampedRating = (value)=>{
    const numericValue = Number(value);
    if(!Number.isFinite(numericValue)){
        return 0;
    }
    return Math.max(0, Math.min(10, Math.round(numericValue)));
};

// a component is a piece of code which render a part of the user interface
function App() {
    const dataSet = useSelector((state)=>state.dataSet);
    const selectedItems = useSelector((state)=>state.itemInteraction.selectedItems);
    const dispatch = useDispatch();

    const [dimensionRatings, setDimensionRatings] = useState(
        ()=>getDefaultDimensionRatings()
    );
    const [selectedScatterXAttribute, setSelectedScatterXAttribute] = useState(DEFAULT_SCATTER_X_ATTRIBUTE);
    const [selectedScatterYAttribute, setSelectedScatterYAttribute] = useState(DEFAULT_SCATTER_Y_ATTRIBUTE);

    const normalizedDimensionWeights = useMemo(()=>{
        const totalRating = Object.values(dimensionRatings)
            .reduce((sum, value)=>sum + toClampedRating(value), 0)
        ;
        return LIVABILITY_DIMENSIONS.reduce((accumulator, dimension)=>{
            const ratingValue = toClampedRating(dimensionRatings[dimension.id]);
            accumulator[dimension.id] = totalRating > 0 ? (ratingValue / totalRating) : 0;
            return accumulator;
        }, {});
    }, [dimensionRatings]);

    const visDataWithLivability = useMemo(()=>{
        return enrichDataWithLivability(
            dataSet,
            LIVABILITY_DIMENSIONS,
            normalizedDimensionWeights,
            LIVABILITY_SCORE_FIELD
        );
    }, [dataSet, normalizedDimensionWeights]);

    useEffect(()=>{
        dispatch(getDataSet());
    }, [dispatch]);

    const handleDimensionRatingChange = (dimensionId, nextInputValue)=>{
        const clampedValue = toClampedRating(nextInputValue);
        setDimensionRatings((previousInputs)=>({
            ...previousInputs,
            [dimensionId]: clampedValue
        }));
    };

    const handleScatterAxisSelectionChange = useCallback((nextSelection = {})=>{
        const nextXAttribute = nextSelection.xAttributeName;
        const nextYAttribute = nextSelection.yAttributeName;

        if(typeof nextXAttribute === 'string' && nextXAttribute.length > 0){
            setSelectedScatterXAttribute((previousValue)=>(
                previousValue === nextXAttribute ? previousValue : nextXAttribute
            ));
        }
        if(typeof nextYAttribute === 'string' && nextYAttribute.length > 0){
            setSelectedScatterYAttribute((previousValue)=>(
                previousValue === nextYAttribute ? previousValue : nextYAttribute
            ));
        }
    }, []);

    return (
        <div className="App">
            <section className="livabilityControlPanel">
                <div className="livabilityControlHeader">
                    <div className="livabilityControlTitleRow">
                        <h2 className="livabilityControlTitle">Livability Control Panel</h2>
                        <span
                            className="panelInfoBadge"
                            title={CONTROL_PANEL_TOOLTIP_TEXT}
                            aria-label="How to use the livability control panel"
                        >
                            i
                        </span>
                    </div>
                </div>
                <div className="livabilityControlGrid">
                    {LIVABILITY_DIMENSIONS.map((dimension)=>{
                        const rawInputValue = dimensionRatings[dimension.id] ?? 0;
                        const tooltipText = getDimensionTooltipText(dimension);

                        return (
                            <div className="dimensionWeightCard" key={dimension.id}>
                                <div className="dimensionWeightHeader">
                                    <span
                                        className="dimensionLabel"
                                        title={tooltipText}
                                        aria-label={`${dimension.label} features and default internal feature weights`}
                                    >
                                        {dimension.label}
                                    </span>
                                </div>
                                <div className="dimensionWeightControls">
                                    <span className="dimensionWeightUnit">Importance</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="1"
                                        value={rawInputValue}
                                        onChange={(event)=>handleDimensionRatingChange(dimension.id, event.target.value)}
                                        className="dimensionWeightNumberInput"
                                        aria-label={`${dimension.label} importance numeric input`}
                                    />
                                    <span className="dimensionWeightUnit">/10</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div id={'MultiviewContainer'} className={'row'}>
                <ScatterplotContainer
                    visDataOverride={visDataWithLivability}
                    xAttributeName={selectedScatterXAttribute}
                    yAttributeName={selectedScatterYAttribute}
                    colorAttributeName={LIVABILITY_SCORE_FIELD}
                    xAttributeOptions={SCATTER_ATTRIBUTE_OPTIONS}
                    yAttributeOptions={SCATTER_ATTRIBUTE_OPTIONS}
                    title={'Community Indicator Relationship Explorer'}
                    onAxisSelectionChange={handleScatterAxisSelectionChange}
                />
                <HierarchyContainer
                    visDataOverride={visDataWithLivability}
                    tooltipXAttribute={selectedScatterXAttribute}
                    tooltipYAttribute={selectedScatterYAttribute}
                />
            </div>

            <DetailComparePanel
                visData={visDataWithLivability}
                selectedItems={selectedItems}
                xAttributeName={selectedScatterXAttribute}
                yAttributeName={selectedScatterYAttribute}
                colorAttributeName={LIVABILITY_SCORE_FIELD}
            />
        </div>
    );
}

export default App;
