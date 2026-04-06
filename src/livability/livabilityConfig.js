// Beyond tutorial scope:
// Custom multi-dimension livability domain model and default weights.
export const LIVABILITY_SCORE_FIELD = 'livabilityScore';

export const LIVABILITY_DIMENSIONS = [
    {
        id: 'safety',
        label: 'Safety',
        scoreField: 'livabilitySafetyScore',
        defaultWeight: 0.30,
        features: [
            { field: 'ViolentCrimesPerPop', weight: 0.45, direction: 'lower' },
            { field: 'PctVacantBoarded', weight: 0.22, direction: 'lower' },
            { field: 'NumInShelters', weight: 0.17, direction: 'lower' },
            { field: 'LemasPctOfficDrugU', weight: 0.16, direction: 'lower' }
        ]
    },
    {
        id: 'economy',
        label: 'Economy',
        scoreField: 'livabilityEconomyScore',
        defaultWeight: 0.20,
        features: [
            { field: 'PctUnemployed', weight: 0.32, direction: 'lower' },
            { field: 'medIncome', weight: 0.28, direction: 'higher' },
            { field: 'PctEmploy', weight: 0.20, direction: 'higher' },
            { field: 'PctBSorMore', weight: 0.20, direction: 'higher' }
        ]
    },
    {
        id: 'housingAffordability',
        label: 'Housing Affordability',
        scoreField: 'livabilityHousingAffordabilityScore',
        defaultWeight: 0.15,
        features: [
            { field: 'MedRentPctHousInc', weight: 0.45, direction: 'lower' },
            { field: 'OwnOccLowQuart', weight: 0.25, direction: 'lower' },
            { field: 'MedOwnCostPctInc', weight: 0.20, direction: 'lower' },
            { field: 'MedOwnCostPctIncNoMtg', weight: 0.10, direction: 'lower' }
        ]
    },
    {
        id: 'housingQuality',
        label: 'Housing Quality',
        scoreField: 'livabilityHousingQualityScore',
        defaultWeight: 0.15,
        features: [
            { field: 'PctHousNoPhone', weight: 0.30, direction: 'lower' },
            { field: 'HousVacant', weight: 0.30, direction: 'lower' },
            { field: 'PctWOFullPlumb', weight: 0.25, direction: 'lower' },
            { field: 'MedYrHousBuilt', weight: 0.15, direction: 'higher' }
        ]
    },
    {
        id: 'socialCohesion',
        label: 'Social Cohesion',
        scoreField: 'livabilitySocialCohesionScore',
        defaultWeight: 0.10,
        features: [
            { field: 'PctFam2Par', weight: 0.42, direction: 'higher' },
            { field: 'MalePctDivorce', weight: 0.35, direction: 'lower' },
            { field: 'MalePctNevMarr', weight: 0.23, direction: 'lower' }
        ]
    },
    {
        id: 'residentialStability',
        label: 'Residential Stability',
        scoreField: 'livabilityResidentialStabilityScore',
        defaultWeight: 0.10,
        features: [
            { field: 'PctHousOwnOcc', weight: 0.45, direction: 'higher' },
            { field: 'PctSameHouse85', weight: 0.35, direction: 'higher' },
            { field: 'PctSameState85', weight: 0.20, direction: 'higher' }
        ]
    }
];
