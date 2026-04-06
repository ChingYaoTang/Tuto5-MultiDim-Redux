import './App.css';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ScatterplotContainer from './components/scatterplot/ScatterplotContainer';
import HierarchyContainer from './components/hierarchy/HierarchyContainer';
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

// Scatter dropdown order:
// [dimension score] -> [that dimension's selected features], repeated by dimension.
// Excludes the overall livability score.
const SCATTER_ATTRIBUTE_OPTIONS = Array.from(
    new Set(
        LIVABILITY_DIMENSIONS.flatMap((dimension)=>[
            dimension.scoreField,
            ...dimension.features.map((feature)=>feature.field)
        ])
    )
).filter((fieldName)=>fieldName !== LIVABILITY_SCORE_FIELD);

const getDefaultDimensionRatings = ()=>{
    return LIVABILITY_DIMENSIONS.reduce((accumulator, dimension)=>{
        accumulator[dimension.id] = Number((dimension.defaultWeight * 10).toFixed(1));
        return accumulator;
    }, {});
};

const toClampedRating = (value)=>{
    const numericValue = Number(value);
    if(!Number.isFinite(numericValue)){
        return 0;
    }
    return Math.max(0, Math.min(10, numericValue));
};

// a component is a piece of code which render a part of the user interface
function App() {
    const dataSet = useSelector((state)=>state.dataSet);
    const dataSetSize = dataSet.length;
    const dispatch = useDispatch();

    const [dimensionRatings, setDimensionRatings] = useState(
        ()=>getDefaultDimensionRatings()
    );

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

    // did mount / did unmount profile
    useEffect(()=>{
        console.log('App did mount');
        dispatch(getDataSet());
        return ()=>{
            console.log('App did unmount');
        };
    }, [dispatch]);

    // update profile: runs only when dependency changes
    useEffect(()=>{
        console.log('App dependency update: dataSetSize=', dataSetSize);
    }, [dataSetSize]);

    const handleDimensionRatingChange = (dimensionId, nextInputValue)=>{
        const clampedValue = toClampedRating(nextInputValue);
        setDimensionRatings((previousInputs)=>({
            ...previousInputs,
            [dimensionId]: clampedValue
        }));
    };

    return (
        <div className="App">
            <section className="livabilityControlPanel">
                <div className="livabilityControlHeader">
                    <div>
                        <h2 className="livabilityControlTitle">Livability Control Panel</h2>
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
                                    <span className="dimensionWeightUnit">Score</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={rawInputValue}
                                        onChange={(event)=>handleDimensionRatingChange(dimension.id, event.target.value)}
                                        className="dimensionWeightNumberInput"
                                        aria-label={`${dimension.label} score numeric input`}
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
                    xAttributeName={'medIncome'}
                    yAttributeName={'ViolentCrimesPerPop'}
                    colorAttributeName={LIVABILITY_SCORE_FIELD}
                    xAttributeOptions={SCATTER_ATTRIBUTE_OPTIONS}
                    yAttributeOptions={SCATTER_ATTRIBUTE_OPTIONS}
                    title={'Community Indicator Relationship Explorer'}
                />
                <HierarchyContainer visDataOverride={visDataWithLivability} />
            </div>
        </div>
    );
}

export default App;
