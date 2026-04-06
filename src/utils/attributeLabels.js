const ATTRIBUTE_LABELS = {
    livabilityScore: 'Livability Score',
    livabilitySafetyScore: 'Safety Score',
    livabilityEconomyScore: 'Economy Score',
    livabilityHousingAffordabilityScore: 'Housing Affordability Score',
    livabilityHousingQualityScore: 'Housing Quality Score',
    livabilitySocialCohesionScore: 'Social Cohesion Score',
    livabilityResidentialStabilityScore: 'Residential Stability Score',

    ViolentCrimesPerPop: 'Violent Crime Rate (per capita)',
    PctVacantBoarded: 'Boarded Vacant Housing (%)',
    NumInShelters: 'Residents in Shelters',
    LemasPctOfficDrugU: 'Police Drug Unit Officers (%)',

    PctUnemployed: 'Unemployment Rate (%)',
    medIncome: 'Median Income',
    PctEmploy: 'Employment Rate (%)',
    PctBSorMore: "Bachelor's Degree or Higher (%)",

    MedRentPctHousInc: 'Rent as % of Household Income (Median)',
    OwnOccLowQuart: 'Owner-Occupied Value (Lower Quartile)',
    MedOwnCostPctInc: 'Owner Cost as % of Income (Median)',
    MedOwnCostPctIncNoMtg: 'Owner Cost % Income (No Mortgage, Median)',

    PctHousNoPhone: 'Households Without Phone (%)',
    HousVacant: 'Vacant Housing Units',
    PctWOFullPlumb: 'Housing Without Full Plumbing (%)',
    MedYrHousBuilt: 'Median Year Housing Built',

    PctFam2Par: 'Two-Parent Families (%)',
    MalePctDivorce: 'Male Divorce Rate (%)',
    MalePctNevMarr: 'Male Never-Married Rate (%)',

    PctHousOwnOcc: 'Owner-Occupied Housing (%)',
    PctSameHouse85: 'Same House Since 1985 (%)',
    PctSameState85: 'Same State Since 1985 (%)'
};

const formatFallbackLabel = (attributeName)=>{
    return String(attributeName || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (char)=>char.toUpperCase())
    ;
};

const attachUnitHint = (attributeName, labelText)=>{
    const fieldName = String(attributeName || '');
    const lowerFieldName = fieldName.toLowerCase();
    const currentLabel = String(labelText || '');
    const lowerLabel = currentLabel.toLowerCase();

    // Preserve common dataset unit semantics for readability.
    if(lowerFieldName.includes('pct') && !currentLabel.includes('%')){
        return `${currentLabel} (%)`;
    }
    if((lowerFieldName.includes('perpop') || lowerFieldName.includes('percap'))
        && !lowerLabel.includes('per capita')
        && !lowerLabel.includes('per cap')){
        return `${currentLabel} (per capita)`;
    }
    return currentLabel;
};

export const getFriendlyAttributeLabel = (attributeName)=>{
    const baseLabel = attributeName in ATTRIBUTE_LABELS
        ? ATTRIBUTE_LABELS[attributeName]
        : formatFallbackLabel(attributeName)
    ;
    return attachUnitHint(attributeName, baseLabel);
};
