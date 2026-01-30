/* ===================================
   DCA 回測計算器 - 主頁面
   整合所有元件，管理全域狀態
=================================== */

import { useState, useCallback } from 'react';
import { TrendingUp, Github, AlertCircle, X } from 'lucide-react';
import type { BacktestConfig, DrawdownTier, BacktestResult, PriceDataPoint, ApiError } from './types';
import { fetchPriceHistory } from './services/api';
import { runBacktest } from './utils/calculator';
import ControlPanel from './components/ControlPanel';
import BacktestChart from './components/BacktestChart';
import ResultsSummary from './components/ResultsSummary';
import TradeLog from './components/TradeLog';

export default function App() {
    // 狀態管理
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingChart, setIsLoadingChart] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prices, setPrices] = useState<PriceDataPoint[]>([]);
    const [result, setResult] = useState<BacktestResult | null>(null);

    /**
     * 選擇幣種後載入歷史走勢圖
     * 使用 CoinGecko 免費 API 最大範圍：約 1 年
     */
    const handleCoinChange = useCallback(async (coinId: string) => {
        setIsLoadingChart(true);
        setError(null);
        setResult(null); // 清除舊的回測結果

        try {
            // CoinGecko 免費版限制：最多取約 365 天的資料
            const now = Math.floor(Date.now() / 1000);
            const oneYearAgo = now - (365 * 24 * 60 * 60);

            const priceData = await fetchPriceHistory(coinId, oneYearAgo, now);
            setPrices(priceData);
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.message || '無法載入價格資料');
            console.error('載入走勢圖失敗:', err);
            setPrices([]);
        } finally {
            setIsLoadingChart(false);
        }
    }, []);

    /**
     * 執行回測
     */
    async function handleRunBacktest(config: BacktestConfig, tiers: DrawdownTier[]) {
        setIsLoading(true);
        setError(null);

        try {
            // 1. 取得歷史價格
            const fromTimestamp = Math.floor(config.startDate.getTime() / 1000);
            const toTimestamp = Math.floor(config.endDate.getTime() / 1000);

            const priceData = await fetchPriceHistory(config.coinId, fromTimestamp, toTimestamp);
            setPrices(priceData);

            // 2. 執行回測計算
            const backtestResult = runBacktest(priceData, config, tiers);
            setResult(backtestResult);

        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.message || '發生未知錯誤');
            console.error('回測失敗:', err);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * 關閉錯誤提示
     */
    function dismissError() {
        setError(null);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* --- 頂部導覽列 --- */}
            <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-sky-500 to-cyan-400 rounded-xl">
                            <TrendingUp className="text-slate-900" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-100">DCA 回測計算器</h1>
                            <p className="text-xs text-slate-400">高點回撤加碼策略驗證工具</p>
                        </div>
                    </div>

                    <a
                        href="https://github.com/BrandonOuioui/DCA_Calculator_2"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <Github size={20} />
                    </a>
                </div>
            </header>

            {/* --- 錯誤提示 --- */}
            {error && (
                <div className="max-w-7xl mx-auto px-6 mt-6">
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between fade-in">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                            <span className="text-red-300">{error}</span>
                        </div>
                        <button
                            onClick={dismissError}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* --- 主內容區 --- */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* 左側：控制面板 */}
                    <aside className="lg:col-span-4">
                        <ControlPanel
                            onRunBacktest={handleRunBacktest}
                            onCoinChange={handleCoinChange}
                            isLoading={isLoading}
                        />
                    </aside>

                    {/* 右側：結果區域 (排版順序: 圖表 -> 結果 -> 交易紀錄) */}
                    <section className="lg:col-span-8 space-y-6">
                        {/* 1. 價格走勢圖 (最上方) */}
                        <div className="fade-in">
                            <BacktestChart
                                prices={prices}
                                trades={result?.trades || []}
                                fundsDepletedDate={result?.fundsDepletedDate}
                                isLoading={isLoadingChart}
                            />
                        </div>

                        {/* 2. 回測結果摘要 */}
                        {result && (
                            <div className="fade-in">
                                <ResultsSummary result={result} />
                            </div>
                        )}

                        {/* 3. 交易紀錄 (最下方) */}
                        {result && result.trades.length > 0 && (
                            <div className="fade-in">
                                <TradeLog trades={result.trades} />
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {/* --- 頁尾 --- */}
            <footer className="border-t border-slate-700/50 mt-12">
                <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-slate-500">
                    <p>資料來源: <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">CoinGecko API</a></p>
                    <p className="mt-1">此工具僅供教育與研究用途，不構成投資建議</p>
                </div>
            </footer>
        </div>
    );
}
