/* ===================================
   回測圖表元件
   使用 Lightweight Charts 繪製走勢圖與回撤曲線
=================================== */

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, SeriesMarker, Time, MouseEventParams } from 'lightweight-charts';
import type { PriceDataPoint, TradeRecord } from '../types';
import { Loader2 } from 'lucide-react';

interface BacktestChartProps {
    prices: PriceDataPoint[];
    trades: TradeRecord[];
    fundsDepletedDate?: Date;
    isLoading?: boolean;
}

interface TooltipData {
    date: string;
    price: number;
    drawdown: number;
    buyInfo?: {
        multiplier: number;
        amount: number;
    };
    x: number;
    y: number;
}

export default function BacktestChart({ prices, trades, isLoading }: BacktestChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const priceSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const drawdownSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
    const [showDrawdown, setShowDrawdown] = useState(true);

    // 初始化圖表
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 建立圖表
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: '#334155', visible: false },
                horzLines: { color: '#334155', visible: false },
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            crosshair: {
                vertLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelVisible: true },
                horzLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelVisible: true },
            },
            timeScale: {
                borderColor: '#475569',
                timeVisible: true,
            },
            // 左軸：價格 (Price)
            leftPriceScale: {
                visible: true,
                borderColor: '#475569',
                scaleMargins: {
                    top: 0.1,    // 留一點空間
                    bottom: 0.1,
                },
            },
            // 右軸：回撤 (Drawdown %)
            rightPriceScale: {
                visible: true,
                borderColor: '#475569',
                scaleMargins: {
                    top: 0,
                    bottom: 0,
                },
            },
        });

        const drawdownSeries = chart.addAreaSeries({
            lineColor: 'rgba(251, 146, 60, 0.6)', // 明顯的邊線 (60%)
            topColor: 'rgba(251, 146, 60, 0.45)', // 飽滿的橘色 (45%) - 非常明顯
            bottomColor: 'rgba(251, 146, 60, 0.05)',
            lineWidth: 1,
            priceScaleId: 'right', // 右軸
            priceFormat: {
                type: 'percent',
                precision: 2,
            },
            autoscaleInfoProvider: () => ({
                priceRange: {
                    minValue: 0,
                    maxValue: 100,
                },
            }),
        });

        // 2. 價格線 (線圖 - 前景層) - 改用左軸
        const priceSeries = chart.addLineSeries({
            color: '#38bdf8', // Sky-400
            lineWidth: 2,
            priceScaleId: 'left', // 左軸
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },

        });

        chartRef.current = chart;
        priceSeriesRef.current = priceSeries;
        drawdownSeriesRef.current = drawdownSeries;

        // Tooltip 監聽
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > chartContainerRef.current!.clientWidth ||
                param.point.y < 0
            ) {
                setTooltipData(null);
                return;
            }

            const priceData = param.seriesData.get(priceSeries) as { value: number; time: Time } | undefined;
            const drawdownData = param.seriesData.get(drawdownSeries) as { value: number; time: Time } | undefined;

            if (priceData) {
                // 查找交易
                const trade = trades.find(t =>
                    Math.floor(t.date.getTime() / 1000) === (param.time as number)
                );

                setTooltipData({
                    date: new Date((param.time as number) * 1000).toLocaleDateString(),
                    price: priceData.value,
                    drawdown: drawdownData ? drawdownData.value : 0,
                    buyInfo: trade ? {
                        multiplier: trade.multiplier,
                        amount: trade.amount
                    } : undefined,
                    x: param.point.x,
                    y: param.point.y
                });
            }
        });

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [trades]); // Re-create chart if trades change reference? Usually safe.

    // Effect: Toggle Drawdown Visibility
    useEffect(() => {
        if (drawdownSeriesRef.current) {
            drawdownSeriesRef.current.applyOptions({
                visible: showDrawdown
            });
        }
    }, [showDrawdown]);

    // 更新資料
    useEffect(() => {
        if (!priceSeriesRef.current || !drawdownSeriesRef.current || !chartRef.current) return;

        let runningAth = 0;
        const drawdownChartData = [];
        const priceChartData = [];

        for (const p of prices) {
            runningAth = Math.max(runningAth, p.price);
            const drawdown = runningAth > 0
                ? ((runningAth - p.price) / runningAth) * 100
                : 0;

            const time = Math.floor(p.timestamp / 1000) as Time;

            priceChartData.push({ time, value: p.price });
            drawdownChartData.push({ time, value: drawdown });
        }

        priceSeriesRef.current.setData(priceChartData);
        drawdownSeriesRef.current.setData(drawdownChartData);

        // 設定買入標記 (小圓點)
        // 顏色邏輯：每 0.5 為一個級距
        const getMarkerColor = (m: number) => {
            if (m < 1.5) return '#38bdf8';      // 1.0 - 1.49x: Sky Blue (Default)
            if (m < 2.0) return '#facc15';      // 1.5 - 1.99x: Yellow
            if (m < 2.5) return '#fb923c';      // 2.0 - 2.49x: Orange
            if (m < 3.0) return '#ef4444';      // 2.5 - 2.99x: Red
            return '#d946ef';                   // >= 3.0x: Fuchsia/Purple
        };

        const markers: SeriesMarker<Time>[] = trades
            .filter(t => !t.insufficientFunds)
            .map(trade => {
                return {
                    time: Math.floor(trade.date.getTime() / 1000) as Time,
                    position: 'inBar',
                    color: getMarkerColor(trade.multiplier),
                    shape: 'circle',
                    text: undefined,
                    size: 0.6,
                };
            });

        priceSeriesRef.current.setMarkers(markers);
        chartRef.current.timeScale().fitContent();
    }, [prices, trades]);

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gradient">價格走勢與回撤</h2>
                </div>

                <div className="flex items-center gap-6">
                    {/* 圖例 (每 0.5 為一級距) */}
                    <div className="flex items-center gap-4 text-xs text-slate-400 hidden sm:flex">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                            <span>1.0-1.5x</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            <span>1.5-2.0x</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                            <span>2.0-2.5x</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span>2.5-3.0x</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
                            <span>&gt;3.0x</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 bg-orange-400/50" />
                            <span>Drawdown</span>
                        </div>
                    </div>

                    {/* 切換開關 */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showDrawdown}
                            onChange={e => setShowDrawdown(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-slate-300">顯示回撤背景</span>
                    </label>
                </div>
            </div>

            {/* 圖表容器 */}
            <div className="relative">
                <div ref={chartContainerRef} className="w-full" />

                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10">
                        <div className="flex items-center gap-2 text-sky-400">
                            <Loader2 className="animate-spin" size={24} />
                            <span>載入中...</span>
                        </div>
                    </div>
                )}

                {/* Tooltip */}
                {tooltipData && (
                    <div
                        className="absolute pointer-events-none z-20 bg-slate-800/95 border border-slate-600 rounded p-3 text-xs shadow-xl backdrop-blur-sm"
                        style={{
                            left: tooltipData.x,
                            top: tooltipData.y,
                            transform: 'translate(10px, 10px)'
                        }}
                    >
                        <div className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">
                            {tooltipData.date}
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-center">
                            <span className="text-sky-400">Price:</span>
                            <span className="font-mono text-right text-white">${tooltipData.price.toLocaleString()}</span>

                            {showDrawdown && (
                                <>
                                    <span className="text-orange-400">Drawdown:</span>
                                    <span className="font-mono text-right text-white">{tooltipData.drawdown.toFixed(2)}%</span>
                                </>
                            )}

                            {tooltipData.buyInfo && (
                                <>
                                    <div className="col-span-2 h-px bg-slate-700 my-0.5" />
                                    <span className="text-emerald-400">Multiplier:</span>
                                    <span className="font-mono text-right font-bold text-emerald-400">{tooltipData.buyInfo.multiplier}x</span>

                                    <span className="text-emerald-400">Buy:</span>
                                    <span className="font-mono text-right text-white">${tooltipData.buyInfo.amount.toFixed(0)}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!isLoading && prices.length === 0 && (
                <div className="h-[500px] flex items-center justify-center text-slate-500">
                    請選擇幣種以載入走勢圖
                </div>
            )}
        </div>
    );
}
