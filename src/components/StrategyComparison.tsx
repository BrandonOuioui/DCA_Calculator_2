import { useState, useEffect } from 'react';
import { Save, Trash2, FolderOpen, ArrowUpRight, TrendingDown } from 'lucide-react';
import type { BacktestConfig, DrawdownTier, BacktestResult, SavedStrategy } from '../types';

interface StrategyComparisonProps {
    currentConfig: BacktestConfig | null;
    currentTiers: DrawdownTier[] | null;
    currentResult: BacktestResult | null;
    standardResult: BacktestResult | null;
    onLoadStrategy: (config: BacktestConfig, tiers: DrawdownTier[]) => void;
}

export default function StrategyComparison({
    currentConfig,
    currentTiers,
    currentResult,
    standardResult,
    onLoadStrategy
}: StrategyComparisonProps) {
    const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
    const [strategyName, setStrategyName] = useState('');

    // 初始載入
    useEffect(() => {
        const saved = localStorage.getItem('dca_strategies');
        if (saved) {
            try {
                // 這裡 parse 出來的 date 是字串，但我們在這個元件只做顯示
                // 真正傳給 onLoadStrategy 時需要轉回 Date
                setStrategies(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse strategies', e);
            }
        }
    }, []);

    const handleSave = () => {
        if (!currentConfig || !currentTiers || !currentResult) return;

        const newStrategy: SavedStrategy = {
            id: crypto.randomUUID(),
            name: strategyName.trim() || `策略 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            created: Date.now(),
            config: currentConfig,
            tiers: currentTiers,
            result: {
                roi: currentResult.roi,
                roiAtLastBuy: currentResult.roiAtLastBuy,
                maxDrawdown: currentResult.maxDrawdown,
                finalValue: currentResult.finalValue,
                finalValueAtLastBuy: currentResult.finalValueAtLastBuy,
                totalInvested: currentResult.totalInvested,
                totalCoins: currentResult.totalCoins,
                averagePrice: currentResult.averagePrice,
                executionDuration: currentResult.executionDuration
            }
        };

        const updated = [...strategies, newStrategy];
        setStrategies(updated);
        localStorage.setItem('dca_strategies', JSON.stringify(updated));
        setStrategyName('');
    };

    const handleDelete = (id: string) => {
        const updated = strategies.filter(s => s.id !== id);
        setStrategies(updated);
        localStorage.setItem('dca_strategies', JSON.stringify(updated));
    };

    const handleLoad = (strategy: SavedStrategy) => {
        // 深拷貝並恢復 Date 物件
        const config = { ...strategy.config };
        config.startDate = new Date(config.startDate);
        config.endDate = new Date(config.endDate); // 雖然現在沒用到，但習慣上恢復

        onLoadStrategy(config, strategy.tiers);

        // 捲動到頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="card mt-8">
            <div className="flex items-center gap-2 mb-6">
                <FolderOpen className="text-sky-400" size={24} />
                <h2 className="text-xl font-bold text-gradient">策略管理與比較</h2>
            </div>

            {/* 儲存區塊 */}
            <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                <div className="flex-1 w-full">
                    <label className="block text-xs text-slate-400 mb-1">策略名稱</label>
                    <input
                        type="text"
                        value={strategyName}
                        onChange={e => setStrategyName(e.target.value)}
                        placeholder="例如：BTC 激進抄底 (1.5x)"
                        className="input-field w-full"
                        maxLength={30}
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={!currentResult}
                    className="btn btn-primary whitespace-nowrap flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Save size={18} />
                    儲存當前策略
                </button>
            </div>

            {/* 列表區塊 */}
            {strategies.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                    尚未儲存任何策略
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">策略名稱</th>
                                <th className="px-4 py-3">設定摘要</th>
                                <th className="px-4 py-3 text-right">投入成本</th>
                                <th className="px-4 py-3 text-right">持倉數量</th>
                                <th className="px-4 py-3 text-right">持倉均價</th>
                                <th className="px-4 py-3 text-right">執行期間</th>
                                <th className="px-4 py-3 text-right">最終價值</th>
                                <th className="px-4 py-3 text-right">ROI</th>
                                <th className="px-4 py-3 text-right">最大回撤</th>
                                <th className="px-4 py-3 rounded-r-lg text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {/* Standard DCA Row */}
                            {standardResult && (
                                <tr className="bg-slate-800/30 border-l-2 border-l-sky-500">
                                    <td className="px-4 py-4 font-bold text-sky-400 cursor-help" title={`回測期間: ${currentConfig?.startDate.toLocaleDateString()} - ${currentConfig?.endDate.toLocaleDateString()}`}>
                                        一般定投 (Benchmark)
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            基準對照
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-slate-400">
                                        <div>{currentConfig?.coinId.toUpperCase()}</div>
                                        <div className="text-xs">
                                            每 {currentConfig?.dcaFrequency} 天 ${currentConfig?.baseDcaAmount}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            (無加碼策略)
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        ${standardResult.totalInvested.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        {standardResult.totalCoins.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        ${standardResult.averagePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        {standardResult.executionStartDate && standardResult.executionEndDate ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-slate-400">
                                                    {standardResult.executionStartDate.toLocaleDateString('zh-TW')} ~
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {standardResult.executionEndDate.toLocaleDateString('zh-TW')}
                                                </span>
                                                <span className="text-slate-200">({standardResult.executionDuration} 天)</span>
                                            </div>
                                        ) : (
                                            <span>{standardResult.executionDuration || '-'} 天</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-200 font-bold">
                                        <div>${(standardResult.finalValueAtLastBuy ?? standardResult.finalValue).toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500 font-normal">
                                            (現: ${standardResult.finalValue.toLocaleString()})
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className={`flex items-center justify-end gap-1 ${(standardResult.roiAtLastBuy ?? standardResult.roi) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {(standardResult.roiAtLastBuy ?? standardResult.roi) >= 0 ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />}
                                            {(standardResult.roiAtLastBuy ?? standardResult.roi).toFixed(2)}%
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            (現: {standardResult.roi.toFixed(2)}%)
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-orange-400">
                                        {standardResult.maxDrawdown.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="text-xs text-slate-500">-</span>
                                    </td>
                                </tr>
                            )}
                            {strategies.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-4 font-medium text-slate-200 cursor-help" title={s.tiers.map((t, i) => `第 ${i + 1} 階: 跌幅 ${Math.abs(Math.round(t.threshold * 100))}% → 買入 ${t.multiplier} 倍`).join('\n')}>
                                        {s.name}
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {new Date(s.created).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-slate-400">
                                        <div>{s.config.coinId.toUpperCase()}</div>
                                        <div className="text-xs">
                                            每 {s.config.dcaFrequency} 天 ${s.config.baseDcaAmount}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        ${s.result.totalInvested.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        {s.result.totalCoins?.toLocaleString(undefined, { maximumFractionDigits: 6 }) || '-'}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        ${s.result.averagePrice?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '-'}
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-300">
                                        {s.result.executionDuration || '-'} 天
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-200 font-bold">
                                        <div>${(s.result.finalValueAtLastBuy ?? s.result.finalValue).toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-500 font-normal">
                                            (現: ${s.result.finalValue.toLocaleString()})
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className={`flex items-center justify-end gap-1 ${(s.result.roiAtLastBuy ?? s.result.roi) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {(s.result.roiAtLastBuy ?? s.result.roi) >= 0 ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />}
                                            {(s.result.roiAtLastBuy ?? s.result.roi).toFixed(2)}%
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            (現: {s.result.roi.toFixed(2)}%)
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-orange-400">
                                        {s.result.maxDrawdown.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleLoad(s)}
                                                className="p-1.5 hover:bg-sky-500/20 text-sky-400 rounded transition-colors"
                                                title="載入設定"
                                            >
                                                <FolderOpen size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                title="刪除"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
