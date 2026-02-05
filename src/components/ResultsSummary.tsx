/* ===================================
   回測結果摘要元件
   顯示關鍵指標卡片
=================================== */

import { TrendingUp, TrendingDown, Coins, DollarSign, PiggyBank, AlertTriangle } from 'lucide-react';
import type { BacktestResult } from '../types';

interface ResultsSummaryProps {
    result: BacktestResult;
}

/**
 * 格式化數字 (加上千分位)
 */
function formatNumber(num: number, decimals = 2): string {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * 格式化貨幣
 */
function formatCurrency(num: number): string {
    return `$${formatNumber(num)}`;
}

export default function ResultsSummary({ result }: ResultsSummaryProps) {
    // const isProfit = result.roi >= 0; // 移除，改用 result.roiAtLastBuy 判斷

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-gradient mb-6">回測結果</h2>

            {/* 資金枯竭警告 */}
            {/* 資金耗盡提示 (中性資訊) */}
            {result.fundsDepleted && (
                <div className="mb-6 p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="text-sky-400 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="text-sky-400 font-medium">資金已於 {result.fundsDepletedDate?.toLocaleDateString('zh-TW')} 耗盡</p>
                        <p className="text-sky-400/70 text-sm mt-1">
                            隨後的期間將不再進行投入，僅計算持有資產的價值變化。
                        </p>
                    </div>
                </div>
            )}

            {/* 指標網格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* 投報率 */}
                <div className={`stat-card ${result.roiAtLastBuy >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
                    <div className={`p-3 rounded-full mb-3 ${result.roiAtLastBuy >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {result.roiAtLastBuy >= 0 ? (
                            <TrendingUp className="text-green-400" size={24} />
                        ) : (
                            <TrendingDown className="text-red-400" size={24} />
                        )}
                    </div>
                    <span className={`stat-value ${result.roiAtLastBuy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {result.roiAtLastBuy >= 0 ? '+' : ''}{formatNumber(result.roiAtLastBuy)}%
                    </span>
                    <span className="stat-label flex flex-col items-center">
                        <span>投報率 (ROI)</span>
                        <span className="text-[10px] opacity-60 mt-0.5">
                            現今: {result.roi >= 0 ? '+' : ''}{formatNumber(result.roi)}%
                        </span>
                    </span>
                </div>

                {/* 最終價值 */}
                <div className="stat-card">
                    <div className="p-3 rounded-full mb-3 bg-sky-500/10">
                        <DollarSign className="text-sky-400" size={24} />
                    </div>
                    <span className="stat-value">{formatCurrency(result.finalValueAtLastBuy ?? result.finalValue)}</span>
                    <span className="stat-label flex flex-col items-center">
                        <span>最終價值</span>
                        {result.totalCoins > 0 && (
                            <span className="text-[10px] text-sky-400/80 mt-0.5">
                                (結算價: {formatCurrency((result.finalValueAtLastBuy ?? result.finalValue) / result.totalCoins)})
                            </span>
                        )}
                        <span className="text-[10px] opacity-60 mt-0.5">
                            現今: {formatCurrency(result.finalValue)}
                        </span>
                    </span>
                </div>

                {/* 總投入 */}
                <div className="stat-card">
                    <div className="p-3 rounded-full mb-3 bg-purple-500/10">
                        <PiggyBank className="text-purple-400" size={24} />
                    </div>
                    <span className="stat-value text-purple-400">{formatCurrency(result.totalInvested)}</span>
                    <span className="stat-label">總投入成本</span>
                </div>

                {/* 持倉數量 */}
                <div className="stat-card">
                    <div className="p-3 rounded-full mb-3 bg-amber-500/10">
                        <Coins className="text-amber-400" size={24} />
                    </div>
                    <span className="stat-value text-amber-400">{formatNumber(result.totalCoins, 6)}</span>
                    <span className="stat-label">持倉數量</span>
                </div>

                {/* 均價 */}
                <div className="stat-card">
                    <div className="p-3 rounded-full mb-3 bg-cyan-500/10">
                        <DollarSign className="text-cyan-400" size={24} />
                    </div>
                    <span className="stat-value text-cyan-400">{formatCurrency(result.averagePrice)}</span>
                    <span className="stat-label">持倉均價</span>
                </div>

                {/* 執行期間 */}
                <div className="stat-card">
                    <div className="p-3 rounded-full mb-3 bg-slate-500/10">
                        <Coins className="text-slate-400" size={24} />
                    </div>
                    <span className="stat-value text-slate-300">
                        {result.executionDuration || '-'} <span className="text-sm font-normal text-slate-500">天</span>
                    </span>
                    <span className="stat-label">執行期間</span>
                </div>

                {/* 最大回撤 */}
                <div className="stat-card border-orange-500/30">
                    <div className="p-3 rounded-full mb-3 bg-orange-500/10">
                        <TrendingDown className="text-orange-400" size={24} />
                    </div>
                    <span className="stat-value text-orange-400">{formatNumber(result.maxDrawdown)}%</span>
                    <span className="stat-label">最大回撤</span>
                </div>
            </div>

            {/* 交易次數 */}
            <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                <span className="text-slate-400">
                    共執行 <span className="text-sky-400 font-semibold">{result.trades.length}</span> 筆定投
                </span>
            </div>
        </div>
    );
}
