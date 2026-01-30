import { useState, useEffect } from 'react';
import { Calculator, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { fetchRealTimeData } from '../services/api';
import type { DrawdownTier } from '../types';

interface RealTimeCalculatorProps {
    coinId: string;
    baseAmount: number;
    tiers: DrawdownTier[];
}

export default function RealTimeCalculator({ coinId, baseAmount, tiers }: RealTimeCalculatorProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<{ price: number, ath: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    // 倒數計時器
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleCalculate = async () => {
        if (cooldown > 0) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchRealTimeData(coinId);
            setData({
                price: result.currentPrice,
                ath: result.ath
            });
            setCooldown(10); // 成功後冷卻 10 秒
        } catch (err) {
            setError('無法取得即時價格 (可能觸發頻率限制)');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // 計算邏輯
    let drawdown = 0;
    let multiplier = 1;
    let suggestedAmount = baseAmount;
    let activeTierIndex = -1;

    if (data) {
        // 1. 計算回撤 (正數，例如下跌 50% => 0.5)
        // ATH = 100, Price = 50 => (100-50)/100 = 0.5 (50%)
        if (data.ath > 0) {
            drawdown = (data.ath - data.price) / data.ath;
        }

        // 2. 匹配策略 (由深到淺檢查：例如先檢查 -50%，再檢查 -30%)
        // Tiers 通常是排序好的? 為了安全我們 sort 一下: 跌越多 (threshold 越負) 排越前
        // threshold input is -0.5 for -50%
        // drawdown is 0.5
        // if drawdown >= abs(threshold)

        const sortedTiers = [...tiers].sort((a, b) => Math.abs(b.threshold) - Math.abs(a.threshold));

        for (let i = 0; i < sortedTiers.length; i++) {
            const tier = sortedTiers[i];
            // 比較絕對值：如果當前跌幅 (0.5) >= 級距跌幅 (0.3)
            if (drawdown >= Math.abs(tier.threshold)) {
                multiplier = tier.multiplier;
                activeTierIndex = tiers.findIndex(t => t.id === tier.id); // 用原始 id 找回顯示用的 index
                break; // 找到最深的滿足條件就停止
            }
        }

        suggestedAmount = baseAmount * multiplier;
    }

    return (
        <div className="card mt-6 border-t-4 border-t-emerald-500">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calculator className="text-emerald-400" size={24} />
                    <h3 className="text-lg font-bold text-slate-100">實時買入試算</h3>
                </div>
                {data && (
                    <span className="text-xs text-slate-500">
                        {new Date().toLocaleTimeString()}
                    </span>
                )}
            </div>

            <p className="text-sm text-slate-400 mb-4">
                根據當前市場價格與您的策略設定，計算現在該投入多少金額。
            </p>

            {/* 結果顯示區 */}
            {data ? (
                <div className="space-y-4 animate-fade-in">
                    {/* 價格資訊 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 mb-1">目前價格</div>
                            <div className="text-lg font-mono text-slate-200">
                                ${data.price.toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 mb-1">歷史最高 (ATH)</div>
                            <div className="text-lg font-mono text-slate-200">
                                ${data.ath.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* 計算結果 */}
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 text-sm">目前回撤</span>
                            <span className="text-orange-400 font-bold">
                                -{(drawdown * 100).toFixed(2)}%
                            </span>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 text-sm">觸發倍率</span>
                            <span className="text-sky-400 font-bold">
                                {multiplier}x
                                {activeTierIndex !== -1 && (
                                    <span className="text-xs text-slate-500 font-normal ml-2">
                                        (策略第 {activeTierIndex + 1} 階)
                                    </span>
                                )}
                            </span>
                        </div>

                        <div className="border-t border-emerald-500/20 my-3 pt-2 flex justify-between items-center">
                            <span className="text-emerald-200 font-medium">建議買入金額</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 line-through">
                                    ${baseAmount}
                                </span>
                                <ArrowRight size={14} className="text-emerald-400" />
                                <span className="text-2xl font-bold text-emerald-400 text-shadow-glow">
                                    ${suggestedAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-6 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
                    <p className="text-sm text-slate-500">
                        點擊下方按鈕取得報價
                    </p>
                </div>
            )}

            {/*錯誤訊息*/}
            {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-2 text-sm text-red-300">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* 按鈕 */}
            <button
                onClick={handleCalculate}
                disabled={isLoading || cooldown > 0}
                className="btn w-full mt-4 bg-slate-700 hover:bg-slate-600 text-slate-200 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <>
                        <RefreshCw className="animate-spin" size={18} />
                        查詢中...
                    </>
                ) : cooldown > 0 ? (
                    <>
                        <RefreshCw size={18} />
                        冷卻中 ({cooldown}s)
                    </>
                ) : (
                    <>
                        <RefreshCw size={18} />
                        {data ? '重新取得報價' : '取得即時報價'}
                    </>
                )}
            </button>
        </div>
    );
}
