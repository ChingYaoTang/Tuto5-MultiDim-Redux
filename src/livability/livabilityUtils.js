// Beyond tutorial scope:
// Utility layer for livability scoring, weight normalization, and enrichment.
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

const computeDimensionScore = (itemData, dimension)=>{
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
