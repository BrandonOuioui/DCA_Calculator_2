/* ===================================
   控制面板元件
   使用者輸入回測參數
=================================== */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Play, RotateCcw } from 'lucide-react';
import type { BacktestConfig, DrawdownTier, CoinOption } from '../types';
import { fetchCoinList } from '../services/api';
import { getDefaultTiers } from '../utils/calculator';

// LocalStorage Key
const STORAGE_KEY = 'dca_calculator_config';

interface ControlPanelProps {
    onRunBacktest: (config: BacktestConfig, tiers: DrawdownTier[]) => void;
    onCoinChange?: (coinId: string) => void; // 幣種變更時觸發
    isLoading: boolean;
}

/**
 * 從 LocalStorage 載入設定
 */
function loadConfig(): { config: Partial<BacktestConfig>; tiers: DrawdownTier[] } {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                config: {
                    ...parsed.config,
                    startDate: parsed.config.startDate ? new Date(parsed.config.startDate) : undefined,
                    endDate: parsed.config.endDate ? new Date(parsed.config.endDate) : undefined,
                },
                tiers: parsed.tiers || getDefaultTiers()
            };
        }
    } catch (e) {
        console.warn('無法載入設定:', e);
    }
    return { config: {}, tiers: getDefaultTiers() };
}

/**
 * 儲存設定到 LocalStorage
 */
function saveConfig(config: BacktestConfig, tiers: DrawdownTier[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, tiers }));
    } catch (e) {
        console.warn('無法儲存設定:', e);
    }
}

export default function ControlPanel({ onRunBacktest, onCoinChange, isLoading }: ControlPanelProps) {
    // 載入已儲存的設定
    const saved = loadConfig();

    // 幣種列表
    const [coins, setCoins] = useState<CoinOption[]>([]);
    const [loadingCoins, setLoadingCoins] = useState(true);

    // 表單狀態
    const [coinId, setCoinId] = useState(saved.config.coinId || 'bitcoin');
    const [startDate, setStartDate] = useState(
        saved.config.startDate
            ? saved.config.startDate.toISOString().split('T')[0]
            : getDefaultStartDate()
    );
    // endDate 移除狀態，預設為當天 (邏輯上如果不設結束日，就是到最新)

    const [initialCapital, setInitialCapital] = useState(saved.config.initialCapital || 10000);
    const [baseDcaAmount, setBaseDcaAmount] = useState(saved.config.baseDcaAmount || 100);
    const [dcaFrequency, setDcaFrequency] = useState(saved.config.dcaFrequency || 7);

    // 回撤級距表
    const [tiers, setTiers] = useState<DrawdownTier[]>(saved.tiers);

    // 載入幣種列表
    useEffect(() => {
        fetchCoinList()
            .then(data => {
                setCoins(data);
                // 幣種列表載入完成後，自動載入預設幣種的走勢圖
                if (onCoinChange && data.length > 0) {
                    onCoinChange(coinId);
                }
            })
            .catch(console.error)
            .finally(() => setLoadingCoins(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * 取得預設開始日期 (6 個月前)
     */
    function getDefaultStartDate(): string {
        const date = new Date();
        date.setMonth(date.getMonth() - 6);
        return date.toISOString().split('T')[0];
    }

    /**
     * 幣種變更處理
     */
    function handleCoinChange(newCoinId: string) {
        setCoinId(newCoinId);
        if (onCoinChange) {
            onCoinChange(newCoinId);
        }
    }

    /**
     * 新增級距
     */
    function addTier() {
        const lastTier = tiers[tiers.length - 1];
        const newThreshold = lastTier ? lastTier.threshold - 0.1 : -0.1;
        const newMultiplier = lastTier ? lastTier.multiplier + 0.5 : 1.5;

        setTiers([
            ...tiers,
            {
                id: Date.now().toString(),
                threshold: Math.max(newThreshold, -0.9), // 最低 -90%
                multiplier: Math.min(newMultiplier, 10) // 最高 10x
            }
        ]);
    }

    /**
     * 刪除級距
     */
    function removeTier(id: string) {
        if (tiers.length <= 1) return; // 至少保留一個
        setTiers(tiers.filter(t => t.id !== id));
    }

    /**
     * 更新級距
     */
    function updateTier(id: string, field: 'threshold' | 'multiplier', value: number) {
        setTiers(tiers.map(t =>
            t.id === id ? { ...t, [field]: value } : t
        ));
    }

    /**
     * 重置級距為預設值
     */
    function resetTiers() {
        setTiers(getDefaultTiers());
    }

    /**
     * 提交表單
     */
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const config: BacktestConfig = {
            coinId,
            startDate: new Date(startDate),
            endDate: new Date(), // Always today
            initialCapital,
            baseDcaAmount,
            dcaFrequency
        };

        // 儲存設定
        saveConfig(config, tiers);

        // 執行回測
        onRunBacktest(config, tiers);
    }

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-gradient mb-6">參數設定</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* --- 幣種選擇 --- */}
                <div>
                    <label className="label">選擇幣種</label>
                    <select
                        value={coinId}
                        onChange={e => handleCoinChange(e.target.value)}
                        className="input-field"
                        disabled={loadingCoins}
                    >
                        {loadingCoins ? (
                            <option>載入中...</option>
                        ) : (
                            coins.map(coin => (
                                <option key={coin.id} value={coin.id}>
                                    {coin.name} ({coin.symbol})
                                </option>
                            ))
                        )}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                        選擇後自動載入近一年價格走勢
                    </p>
                </div>

                {/* --- 日期區間 --- */}
                <div>
                    <label className="label">開始日期</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="input-field"
                    />
                </div>

                {/* 日期限制說明 */}
                <p className="text-xs text-sky-400/80 -mt-4">
                    💡 支援長期回測 (數據來源: CryptoCompare/CoinGecko)
                </p>

                {/* --- 資金設定 --- */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="label">初始資金 (USD)</label>
                        <input
                            type="number"
                            min={100}
                            step={100}
                            value={initialCapital}
                            onChange={e => setInitialCapital(Number(e.target.value))}
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="label">基礎定投 (USD)</label>
                        <input
                            type="number"
                            min={10}
                            step={10}
                            value={baseDcaAmount}
                            onChange={e => setBaseDcaAmount(Number(e.target.value))}
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="label">頻率 (天)</label>
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={dcaFrequency}
                            onChange={e => setDcaFrequency(Number(e.target.value))}
                            className="input-field"
                        />
                    </div>
                </div>

                {/* --- 回撤級距表 --- */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="label mb-0">回撤級距表</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={resetTiers}
                                className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                                title="重置為預設值"
                            >
                                <RotateCcw size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={addTier}
                                className="p-2 text-sky-400 hover:text-sky-300 transition-colors"
                                title="新增級距"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {tiers.map((tier, index) => (
                            <div key={tier.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                                <span className="text-slate-500 w-6">{index + 1}.</span>

                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-slate-400 text-sm">跌幅 ≤</span>
                                    <input
                                        type="number"
                                        min={-90}
                                        max={0}
                                        step={5}
                                        value={tier.threshold * 100}
                                        onChange={e => updateTier(tier.id, 'threshold', Number(e.target.value) / 100)}
                                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center text-sm"
                                    />
                                    <span className="text-slate-400 text-sm">%</span>
                                </div>

                                <div className="flex items-center gap-2 flex-1">
                                    <span className="text-slate-400 text-sm">買入</span>
                                    <input
                                        type="number"
                                        min={0.1}
                                        max={10}
                                        step={0.1}
                                        value={tier.multiplier}
                                        onChange={e => updateTier(tier.id, 'multiplier', Number(e.target.value))}
                                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center text-sm"
                                    />
                                    <span className="text-slate-400 text-sm">倍</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeTier(tier.id)}
                                    disabled={tiers.length <= 1}
                                    className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- 提交按鈕 --- */}
                <button
                    type="submit"
                    disabled={isLoading || loadingCoins}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                            計算中...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            開始回測
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
