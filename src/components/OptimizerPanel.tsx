/* ===================================
   Optimizer Panel Component
   UI for running the Genetic Algorithm and displaying results.
=================================== */

import { useState } from 'react';
import { Sparkles, Check, Trophy, Loader2 } from 'lucide-react';
import type { BacktestConfig, DrawdownTier, PriceDataPoint } from '../types';
import { runGeneticOptimizer, StrategyGenome } from '../utils/optimizer';

interface OptimizerPanelProps {
    prices: PriceDataPoint[];
    currentConfig: BacktestConfig;
    onApplyStrategy: (tiers: DrawdownTier[]) => void;
    controlPanelPrice?: number; // Current price for comparison
}

export default function OptimizerPanel({
    prices,
    currentConfig,
    onApplyStrategy,
    controlPanelPrice
}: OptimizerPanelProps) {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [generation, setGeneration] = useState(0);
    const [topStrategies, setTopStrategies] = useState<StrategyGenome[]>([]);
    const [showResults, setShowResults] = useState(false);

    async function handleStartOptimization() {
        if (prices.length === 0) {
            alert('請先選擇幣種以載入價格資料');
            return;
        }

        setIsOptimizing(true);
        setShowResults(true);
        setProgress(0);
        setGeneration(0);
        setTopStrategies([]);

        try {
            // Run the genetic algorithm
            const result = await runGeneticOptimizer(
                prices,
                currentConfig,
                (prog, gen) => {
                    setProgress(prog);
                    setGeneration(gen);
                }
            );

            setTopStrategies(result.topStrategies);
        } catch (error) {
            console.error('Optimization failed:', error);
            alert('優化過程發生錯誤，請稍後再試');
        } finally {
            setIsOptimizing(false);
            setProgress(100);
        }
    }

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mt-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-400" size={20} />
                    <h3 className="font-bold text-slate-200">AI 策略最佳化</h3>
                </div>
            </div>

            <p className="text-xs text-slate-400 mb-4">
                使用基因演算法 (Genetic Algorithm) 自動尋找最佳的「單調遞增」加碼策略。
                這將會測試數萬種組合，找出 ROI 最高的配置。
            </p>

            {/* Start Button */}
            {!isOptimizing && !showResults && (
                <button
                    onClick={handleStartOptimization}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all"
                >
                    <Sparkles size={18} />
                    開始尋找最佳策略
                </button>
            )}

            {/* Progress UI */}
            {(isOptimizing || showResults) && (
                <div className="space-y-4 fade-in">
                    {/* Status Bar */}
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                            <span>演化世代: {generation} / 50</span>
                            <span>{isOptimizing ? '計算中...' : '完成'}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="space-y-3">
                        {topStrategies.length === 0 && isOptimizing && (
                            <div className="text-center py-4 text-slate-500 flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" size={16} />
                                正在培育優良策略...
                            </div>
                        )}

                        {topStrategies.map((strategy, index) => (
                            <div
                                key={index}
                                className="bg-slate-900 border border-slate-700/50 rounded-lg p-3 hover:border-amber-500/30 transition-colors group"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {index === 0 && <Trophy className="text-yellow-400" size={16} />}
                                        <span className="text-slate-300 font-bold">
                                            {strategy.labels && strategy.labels.length > 0
                                                ? strategy.labels[0]
                                                : `Strategy #${index + 1}`}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div className="bg-slate-900/50 p-2 rounded-lg">
                                        <div className="text-xs text-slate-400">平均買入價</div>
                                        <div className="text-sm font-mono text-slate-200">
                                            ${strategy.averagePrice?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '-'}
                                            {controlPanelPrice && strategy.averagePrice && (
                                                <span className={`ml-1 text-xs ${controlPanelPrice > strategy.averagePrice ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    ({((controlPanelPrice - strategy.averagePrice) / strategy.averagePrice * 100).toFixed(1)}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 p-2 rounded-lg">
                                        <div className="text-xs text-slate-400">囤幣數量</div>
                                        <div className="text-sm font-mono text-slate-200">
                                            {strategy.totalCoins?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || '-'}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 p-2 rounded-lg col-span-2">
                                        <div className="text-xs text-slate-400">執行期間</div>
                                        <div className="text-sm font-mono text-slate-200">
                                            {strategy.executionStartDate && strategy.executionEndDate ? (
                                                <span>
                                                    {strategy.executionStartDate.toLocaleDateString('zh-TW')} ~ {strategy.executionEndDate.toLocaleDateString('zh-TW')}
                                                    <span className="text-xs text-slate-500 ml-2">({strategy.executionDuration} 天)</span>
                                                </span>
                                            ) : (
                                                '-'
                                            )}
                                            {strategy.fundsDepletedDate && <span className="text-red-400 ml-1 text-xs">(提前耗盡)</span>}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/50 p-2 rounded-lg col-span-2">
                                        <div className="text-xs text-slate-400">投資報酬率 (ROI)</div>
                                        <div className="text-sm font-bold text-emerald-400">
                                            +{strategy.fitness.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Visualization of the Curve */}
                                <div className="h-8 flex items-end gap-0.5 mb-3 opacity-80">
                                    {strategy.genes.map((val, i) => (
                                        <div
                                            key={i}
                                            className="w-full bg-sky-500/30 rounded-t-sm hover:bg-sky-400 transition-colors"
                                            style={{ height: `${(val / 3) * 100}%` }}
                                            title={`Level ${i + 1}: ${val}x`}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={() => onApplyStrategy(strategy.tiers)}
                                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <Check size={14} />
                                    套用此策略
                                </button>
                            </div>
                        ))}
                    </div>

                    {!isOptimizing && (
                        <button
                            onClick={handleStartOptimization}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                        >
                            重新計算
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
