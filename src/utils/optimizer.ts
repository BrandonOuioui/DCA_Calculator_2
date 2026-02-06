/* ===================================
   Strategy Optimizer - Genetic Algorithm
   Finds the optimal DCA strategy using evolutionary computation.
   Constraint: Monotonically increasing multipliers.
=================================== */

import type { BacktestConfig, PriceDataPoint, DrawdownTier } from '../types';
import { runBacktest, aggregateDailyPrices } from './calculator';

// --- Types ---
// ... (StrategyGenome, OptimizationResult interfaces remain unchanged)
export interface StrategyGenome {
    genes: number[];
    fitness: number;
    tiers: DrawdownTier[];
    totalCoins?: number;
    averagePrice?: number;
    fundsDepletedDate?: Date;
    executionDuration?: number;
    executionStartDate?: Date;
    executionEndDate?: Date;
}

export interface OptimizationResult {
    bestGenome: StrategyGenome;
    generationsRun: number;
    topStrategies: StrategyGenome[];
}

// --- Constants ---
const POPULATION_SIZE = 500;
const GENERATIONS = 50;
const MUTATION_RATE = 0.1;
const ELITISM_COUNT = 50;
const BATCH_SIZE = 50; // New: Process 50 genomes per chunk

// Steps mapping... (STEPS_MAPPING remains unchanged)
const STEPS_MAPPING = [
    [-5, -10, -15],
    [-20], [-25], [-30], [-35],
    [-40], [-45], [-50], [-55],
    [-60], [-65], [-70], [-75],
    [-80], [-85], [-90]
];

// --- Helper Functions ---
function getRandomMultiplier(): number {
    const val = 1.0 + Math.random() * 2.0;
    return Math.round(val * 10) / 10;
}

function generateMonotonicGenome(): StrategyGenome {
    const genes: number[] = [];
    for (let i = 0; i < 16; i++) {
        genes.push(getRandomMultiplier());
    }
    genes.sort((a, b) => a - b);
    return {
        genes,
        fitness: -Infinity,
        tiers: genesToTiers(genes)
    };
}

function genesToTiers(genes: number[]): DrawdownTier[] {
    const tiers: DrawdownTier[] = [];
    genes.forEach((multiplier, geneIndex) => {
        const thresholds = STEPS_MAPPING[geneIndex];
        thresholds.forEach(threshold => {
            tiers.push({
                id: `gen_${threshold}`,
                threshold: threshold / 100,
                multiplier: multiplier
            });
        });
    });
    return tiers;
}

function mutate(genome: StrategyGenome) {
    const idx = Math.floor(Math.random() * 16);
    const lowerBound = idx === 0 ? 1.0 : genome.genes[idx - 1];
    const upperBound = idx === 15 ? 3.0 : genome.genes[idx + 1];
    if (upperBound > lowerBound) {
        const val = lowerBound + Math.random() * (upperBound - lowerBound);
        genome.genes[idx] = Math.round(val * 10) / 10;
    }
    genome.tiers = genesToTiers(genome.genes);
}

function crossover(parentA: StrategyGenome, parentB: StrategyGenome): StrategyGenome {
    const rawGenes = [];
    for (let i = 0; i < 16; i++) {
        rawGenes.push(Math.random() < 0.5 ? parentA.genes[i] : parentB.genes[i]);
    }
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

    // 0. Pre-optimization: Pre-calculate daily prices ONCE
    // This avoids doing it 25,000 times inside runBacktest
    const dailyPrices = aggregateDailyPrices(prices);

    // 1. Initialize Population
    let population: StrategyGenome[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(generateMonotonicGenome());
    }

    // 2. Evolution Loop
    for (let gen = 0; gen < GENERATIONS; gen++) {

        // A. Evaluate Fitness with Async Chunking
        for (let i = 0; i < population.length; i += BATCH_SIZE) {
            // Process a batch
            const batchEnd = Math.min(i + BATCH_SIZE, population.length);
            for (let j = i; j < batchEnd; j++) {
                const genome = population[j];

                // OPTIMIZATION: Use Lite Mode & Pre-aggregated data
                const result = runBacktest(dailyPrices, baseConfig, genome.tiers, {
                    liteMode: true,      // Don't create trade array (saves 45M objects)
                    preAggregated: true  // Don't re-sort daily prices (saves 25k sorts)
                });

                genome.fitness = result.roi;
                // Cache additional metrics
                genome.totalCoins = result.totalCoins;
                genome.averagePrice = result.averagePrice;
                genome.fundsDepletedDate = result.fundsDepletedDate;
                genome.fundsDepletedDate = result.fundsDepletedDate;
                genome.executionDuration = result.executionDuration;
                genome.executionStartDate = result.executionStartDate;
                genome.executionEndDate = result.executionEndDate;
            }

            // Yield to main thread every batch to keep UI responsive
            await new Promise(r => setTimeout(r, 0));
        }

        // Reporting (after all batches in this generation are done)
        if (onProgress) {
            onProgress((gen / GENERATIONS) * 100, gen + 1);
        }

        // B. Sort by Fitness (Descending)
        population.sort((a, b) => b.fitness - a.fitness);

        // C. Elitism: Keep top performers immediately
        const survivors = population.slice(0, ELITISM_COUNT);

        // D. Create Next Generation
        const nextGen = [...survivors];

        // Fill the rest with children
        while (nextGen.length < POPULATION_SIZE) {
            const parentPoolSize = Math.floor(POPULATION_SIZE * 0.4);
            const parentA = population[Math.floor(Math.random() * parentPoolSize)];
            const parentB = population[Math.floor(Math.random() * parentPoolSize)];

            let child = crossover(parentA, parentB);

            if (Math.random() < MUTATION_RATE) {
                mutate(child);
            }

            nextGen.push(child);
        }

        population = nextGen;
    }

    // Final Sort
    population.sort((a, b) => b.fitness - a.fitness);

    // Deduplicate to find distinct top strategies
    const uniqueStrategies: StrategyGenome[] = [];
    const seenGenes = new Set<string>();

    for (const genome of population) {
        // Create a unique signature for the genes
        const signature = genome.genes.map(g => g.toFixed(1)).join('|');

        if (!seenGenes.has(signature)) {
            seenGenes.add(signature);
            uniqueStrategies.push(genome);
        }

        // Stop once we have enough unique top strategies
        if (uniqueStrategies.length >= 3) break;
    }

    return {
        bestGenome: uniqueStrategies[0],
        generationsRun: GENERATIONS,
        topStrategies: uniqueStrategies
    };
}
