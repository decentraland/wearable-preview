/**
 * Returns a random number between 1 and 159 to be used for default profile generation.
 * This is used when a profile is set to 'default' to generate a random numbered profile (e.g., 'default42').
 */
export const getRandomProfileNumber = () => Math.floor(Math.random() * 159) + 1

/**
 * Generates a random default profile string in the format 'default{number}'.
 */
export const getRandomDefaultProfile = () => `default${getRandomProfileNumber()}`
