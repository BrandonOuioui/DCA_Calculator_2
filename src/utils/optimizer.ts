/* ===================================
   Strategy Optimizer - Genetic Algorithm
   Finds the optimal DCA strategy using evolutionary computation.
   Constraint: Monotonically increasing multipliers.
=================================== */

import type { BacktestConfig, PriceDataPoint, DrawdownTier } from '../types';
import { runBacktest } from './calculator';

// --- Types ---

// A "Genome" is effectively an array of 16 multipliers (one for each 5% drop step from -5% to -80% + Zone 1)
// But to simplify mapping:
// Index 0: Zone 1 (0% to -15%) -> controls -5%, -10%, -15%
// Index 1: -20%
// Index 2: -25%
// ...
// Index 15: -90%
// Total Genes: 1 + (90-20)/5 + 1 = 1 + 14 + 1?
// Let's count:
// Zone 1 (-5, -10, -15): 1 gene
// -20, -25, -30, -35, -40, -45, -50, -55, -60, -65, -70, -75, -80, -85, -90: 15 genes
// Total: 16 Genes. Correct.

export interface StrategyGenome {
    genes: number[]; // Array of 16 multipliers
    fitness: number; // ROI
    tiers: DrawdownTier[]; // The actual tiers generated from genes
}

export interface OptimizationResult {
    bestGenome: StrategyGenome;
    generationsRun: number;
    topStrategies: StrategyGenome[]; // Top 3
}

// --- Constants ---
const POPULATION_SIZE = 500;
const GENERATIONS = 50;
const MUTATION_RATE = 0.1;
const ELITISM_COUNT = 50; // Keep top 10%

// Steps mapping
// Gene 0 -> -5, -10, -15
// Gene 1 -> -20
// ...
// Gene 15 -> -90
const STEPS_MAPPING = [
    [-5, -10, -15],              // Gene 0
    [-20], [-25], [-30], [-35],  // Genes 1-4
    [-40], [-45], [-50], [-55],  // Genes 5-8
    [-60], [-65], [-70], [-75],  // Genes 9-12
    [-80], [-85], [-90]          // Genes 13-15
];

// --- Helper Functions ---

function getRandomMultiplier(): number {
    // Range: 1.0 to 3.0, rounded to 1 decimal place? No, keep some precision, maybe 1 decimal is good for human readability.
    // Let's use 0.1 increments for cleaner UI.
    const val = 1.0 + Math.random() * 2.0; // 1.0 ~ 3.0
    return Math.round(val * 10) / 10;
}

/**
 * Generates a random genome that satisfies monotonicity:
 * genes[i] >= genes[i-1]
 */
function generateMonotonicGenome(): StrategyGenome {
    const genes: number[] = [];

    for (let i = 0; i < 16; i++) {
        // To ensure we reach 3.0 eventually but don't get stuck at 3.0 too early,
        // we essentially pick random points and sort them.
        // OR better: Just pick 16 random numbers and sort them.
        // This naturally creates a curve.
        genes.push(getRandomMultiplier());
    }

    // Sort to enforce monotonicity
    genes.sort((a, b) => a - b);

    return {
        genes,
        fitness: -Infinity,
        tiers: genesToTiers(genes)
    };
}

/**
 * Converts the 16 genes into the actual DrawdownTier objects used by the calculator.
 */
function genesToTiers(genes: number[]): DrawdownTier[] {
    const tiers: DrawdownTier[] = [];

    genes.forEach((multiplier, geneIndex) => {
        const thresholds = STEPS_MAPPING[geneIndex];
        thresholds.forEach(threshold => {
            tiers.push({
                id: `gen_${threshold}`, // simple unique id
                threshold: threshold / 100, // convert percentage to decimal (-5 -> -0.05)
                multiplier: multiplier
            });
        });
    });

    return tiers;
}

/**
 * Mutation: Randomly change a gene, but clamping it to neighbors to maintain monotonicity.
 */
function mutate(genome: StrategyGenome) {
    // Pick a random gene to mutate
    const idx = Math.floor(Math.random() * 16);

    // Determine bounds
    const lowerBound = idx === 0 ? 1.0 : genome.genes[idx - 1];
    const upperBound = idx === 15 ? 3.0 : genome.genes[idx + 1];

    // New random value within bounds
    // Note: If lowerBound == upperBound, mutation does nothing (locked). This is expected.
    if (upperBound > lowerBound) {
        const val = lowerBound + Math.random() * (upperBound - lowerBound);
        genome.genes[idx] = Math.round(val * 10) / 10;
    }

    // Recalculate tiers (fitness will be recalculated in the loop)
    genome.tiers = genesToTiers(genome.genes);
}

/**
 * Crossover: Combine two parents to make a child.
 * Method: Uniform Crossover with Validity Check?
 * Easier: Split point crossover?
 * Or simply: Take average of parents?
 * Let's use "One-Point Crossover" then Sort? No, sorting destroys the structure if parents are different.
 * 
 * Better for Monotonic: "Gene Pool Mix & Sort".
 * Take 8 genes from Parent A, 8 from Parent B. Combine and Sort.
 * This guarantees monotonicity and inheritance.
 */
function crossover(parentA: StrategyGenome, parentB: StrategyGenome): StrategyGenome {
    // Mix 50/50
    const rawGenes = [];
    for (let i = 0; i < 16; i++) {
        rawGenes.push(Math.random() < 0.5 ? parentA.genes[i] : parentB.genes[i]);
    }

    // IMPORTANT: Just taking genes might break monotonicity (e.g. A[5]=2.0, B[6]=1.5).
    // So we MUST sort the result.
    rawGenes.sort((a, b) => a - b);

    return {
        genes: rawGenes,
        fitness: -Infinity,
        tiers: genesToTiers(rawGenes)
    };
}

// --- Main Optimizer Function ---

export async function runGeneticOptimizer(
    prices: PriceDataPoint[],
    baseConfig: BacktestConfig,
    onProgress?: (progress: number, generation: number) => void
): Promise<OptimizationResult> {

    // 1. Initialize Population
    let population: StrategyGenome[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(generateMonotonicGenome());
    }

    // 2. Evolution Loop
    for (let gen = 0; gen < GENERATIONS; gen++) {

        // Reporting
        if (onProgress) {
            // Use setTimeout to allow UI to render? 
            // Since this is sync code running in async wrapper, we might block the UI.
            // In a perfect world we use Web Workers. 
            // For now, we rely on the fact that 500 backtests is fast (approx 20ms).
            // We can yield to event loop every generation.
            await new Promise(r => setTimeout(r, 0));
            onProgress((gen / GENERATIONS) * 100, gen + 1);
        }

        // A. Evaluate Fitness
        for (const genome of population) {
            // We optimize for ROI primarily.
            // Safety: If funds depleted, heavy penalty? 
            // Actually, runBacktest handles depleted funds (stops buying).
            // So ROI will naturally be lower if we run out of cash too early during a dip.
            const result = runBacktest(prices, baseConfig, genome.tiers);
            genome.fitness = result.roi;
        }

        // B. Sort by Fitness (Descending)
        population.sort((a, b) => b.fitness - a.fitness);

        // C. Elitism: Keep top performers immediately
        const survivors = population.slice(0, ELITISM_COUNT);

        // D. Create Next Generation
        const nextGen = [...survivors];

        // Fill the rest with children
        while (nextGen.length < POPULATION_SIZE) {
            // Tournament selection or random from top 50%?
            // Let's pick random parents from top 50% (Survive of the fittest pool)
            const parentPoolSize = Math.floor(POPULATION_SIZE * 0.4);
            const parentA = population[Math.floor(Math.random() * parentPoolSize)];
            const parentB = population[Math.floor(Math.random() * parentPoolSize)];

            let child = crossover(parentA, parentB);

            // Mutation
            if (Math.random() < MUTATION_RATE) {
                mutate(child);
            }

            nextGen.push(child);
        }

        population = nextGen;
    }

    // Final Sort
    population.sort((a, b) => b.fitness - a.fitness);

    return {
        bestGenome: population[0],
        generationsRun: GENERATIONS,
        topStrategies: population.slice(0, 3)
    };
}
