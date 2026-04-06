const clamp01 = (value)=>{
    if(value < 0){
        return 0;
    }
    if(value > 1){
        return 1;
    }
    return value;
};

const toFiniteNumber = (value, fallback = 0)=>{
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const getDefaultDimensionWeightInputs = (dimensions)=>{
    return dimensions.reduce((accumulator, dimension)=>{
        accumulator[dimension.id] = Math.round(dimension.defaultWeight * 100);
        return accumulator;
    }, {});
};

export const normalizeDimensionWeights = (weightInputs, dimensions)=>{
    const rawWeights = dimensions.map((dimension)=>{
        const inputValue = toFiniteNumber(weightInputs[dimension.id], dimension.defaultWeight * 100);
        return {
            id: dimension.id,
            weight: Math.max(0, inputValue)
        };
    });

    const rawWeightSum = rawWeights.reduce((total, item)=>total + item.weight, 0);
    if(rawWeightSum <= 0){
        return dimensions.reduce((accumulator, dimension)=>{
            accumulator[dimension.id] = dimension.defaultWeight;
            return accumulator;
        }, {});
    }

    return rawWeights.reduce((accumulator, item)=>{
        accumulator[item.id] = item.weight / rawWeightSum;
        return accumulator;
    }, {});
};

export const computeDimensionScore = (itemData, dimension)=>{
    const weightedScore = dimension.features.reduce((scoreTotal, feature)=>{
        const rawValue = clamp01(toFiniteNumber(itemData[feature.field], 0));
        const orientedValue = feature.direction === 'lower'
            ? (1 - rawValue)
            : rawValue
        ;
        return scoreTotal + (feature.weight * orientedValue);
    }, 0);

    return clamp01(weightedScore);
};

export const enrichDataWithLivability = (visData, dimensions, normalizedDimensionWeights, finalScoreField)=>{
    if(!Array.isArray(visData) || visData.length === 0){
        return [];
    }

    return visData.map((itemData)=>{
        const dimensionScores = {};
        let finalScore = 0;

        dimensions.forEach((dimension)=>{
            const dimensionScore = computeDimensionScore(itemData, dimension);
            dimensionScores[dimension.scoreField] = dimensionScore;
            finalScore += (normalizedDimensionWeights[dimension.id] || 0) * dimensionScore;
        });

        return {
            ...itemData,
            ...dimensionScores,
            [finalScoreField]: clamp01(finalScore)
        };
    });
};

export const formatNormalizedPercent = (ratio)=>`${(toFiniteNumber(ratio, 0) * 100).toFixed(1)}%`;
