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
            height: 500, // 增加高度以容納下方區域
            crosshair: {
                vertLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelVisible: true },
                horzLine: { color: '#475569', width: 1, style: LineStyle.Dashed, labelVisible: true },
            },
            timeScale: {
                borderColor: '#475569',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: '#475569',
                scaleMargins: {
                    top: 0.05,
                    bottom: 0.3, // 預留下方 30% 給回撤圖
                },
            },
            // 左側座標軸用於回撤
            leftPriceScale: {
                visible: true,
                borderColor: '#475569',
                scaleMargins: {
                    top: 0.75, // 回撤圖顯示在下方 25%
                    bottom: 0,
                },
            },
        });

        // 1. 價格線 (右軸)
        const priceSeries = chart.addLineSeries({
            color: '#38bdf8',
            lineWidth: 2,
            priceScaleId: 'right',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        // 2. 回撤曲線 (左軸 - 區域圖)
        const drawdownSeries = chart.addAreaSeries({
            lineColor: '#ef4444',
            topColor: 'rgba(239, 68, 68, 0.1)',
            bottomColor: 'rgba(239, 68, 68, 0.5)',
            lineWidth: 1,
            priceScaleId: 'left',
            priceFormat: {
                type: 'percent',
                precision: 2,
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

            // 取得對應時間的資料
            // 這裡我們需要從原始資料中查找，因為 param.seriesData 可能不包含所有我們需要的 info
            // 但我們可以建立一個 Map 來快速查找
            // 由於效能考量，我們在 subscribe 裡面做查找
            // 這裡簡化：從 param.seriesData 取得價格和回撤

            const priceData = param.seriesData.get(priceSeries) as { value: number; time: Time } | undefined;
            const drawdownData = param.seriesData.get(drawdownSeries) as { value: number; time: Time } | undefined;

            if (priceData) {
                // 查找是否有交易在該時間點
                const trade = trades.find(t =>
                    Math.floor(t.date.getTime() / 1000) === (param.time as number)
                );

                setTooltipData({
                    date: new Date((param.time as number) * 1000).toLocaleDateString(),
                    price: priceData.value,
                    drawdown: drawdownData ? drawdownData.value : 0, // 負數百分比
                    buyInfo: trade ? {
                        multiplier: trade.multiplier,
                        amount: trade.amount
                    } : undefined,
                    x: param.point.x,
                    y: param.point.y
                });
            }
        });

        // 響應式調整
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
    }, [trades]); // 依賴 trades 以便 tooltip 查找

    // 更新資料
    useEffect(() => {
        if (!priceSeriesRef.current || !drawdownSeriesRef.current || !chartRef.current) return;

        // 計算每日回撤
        let runningAth = 0;
        const drawdownChartData = [];
        const priceChartData = [];

        for (const p of prices) {
            runningAth = Math.max(runningAth, p.price);
            const drawdown = runningAth > 0
                ? ((runningAth - p.price) / runningAth) * 100 // 改為正數 (回徹百分比)
                : 0;

            const time = Math.floor(p.timestamp / 1000) as Time;

            priceChartData.push({ time, value: p.price });
            drawdownChartData.push({ time, value: drawdown });
        }

        priceSeriesRef.current.setData(priceChartData);
        drawdownSeriesRef.current.setData(drawdownChartData);

        // 設定買入標記 (過濾掉資金不足的，且使用圓點)
        const markers: SeriesMarker<Time>[] = trades
            .filter(t => !t.insufficientFunds) // 過濾資金不足
            .map(trade => {
                // 根據倍率決定顏色
                let color = '#22c55e'; // 綠色 (1x)
                if (trade.multiplier > 1 && trade.multiplier <= 1.5) {
                    color = '#38bdf8'; // 天藍 (1.2-1.5x)
                } else if (trade.multiplier > 1.5 && trade.multiplier <= 2) {
                    color = '#a855f7'; // 紫色 (1.5-2x)
                } else if (trade.multiplier > 2) {
                    color = '#ec4899'; // 粉紅 (>2x)
                }

                return {
                    time: Math.floor(trade.date.getTime() / 1000) as Time,
                    position: 'inBar', // 顯示在K線上
                    color,
                    shape: 'circle',   // 改為圓點
                    text: undefined,
                    size: 0.5,         // 縮小 (0~1 之間嗎?) LWC size 是倍率，預設 1
                };
            });

        priceSeriesRef.current.setMarkers(markers);

        // 自動縮放
        chartRef.current.timeScale().fitContent();
    }, [prices, trades]);

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gradient">價格走勢與回撤</h2>

                {/* 圖例 */}
                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>買入 (1x)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-sky-400" />
                        <span>加碼 (1.2-1.5x)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span>大额 (1.5-2x)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-pink-500" />
                        <span>梭哈 (&gt;2x)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-red-500/50" />
                        <span>回撤曲線</span>
                    </div>
                </div>
            </div>

            {/* 圖表容器 */}
            <div className="relative">
                <div ref={chartContainerRef} className="w-full" />

                {/* 載入中覆蓋層 */}
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10">
                        <div className="flex items-center gap-2 text-sky-400">
                            <Loader2 className="animate-spin" size={24} />
                            <span>載入價格資料中...</span>
                        </div>
                    </div>
                )}

                {/* 自定義 Tooltip */}
                {tooltipData && (
                    <div
                        className="absolute pointer-events-none z-20 bg-slate-800/90 border border-slate-600 rounded p-2 text-xs shadow-xl backdrop-blur-sm"
                        style={{
                            left: tooltipData.x,
                            top: tooltipData.y,
                            transform: 'translate(10px, 10px)' // 偏移一點以免遮擋滑鼠
                        }}
                    >
                        <div className="font-bold text-slate-200 mb-1">{tooltipData.date}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-slate-400">價格:</span>
                            <span className="text-cyan-400 font-mono text-right">${tooltipData.price.toLocaleString()}</span>

                            <span className="text-slate-400">回撤:</span>
                            <span className={`font-mono text-right ${tooltipData.drawdown <= -20 ? 'text-red-400' : 'text-orange-400'}`}>
                                {tooltipData.drawdown.toFixed(2)}%
                            </span>

                            {tooltipData.buyInfo && (
                                <>
                                    <div className="col-span-2 my-1 border-t border-slate-600/50"></div>
                                    <span className="text-slate-300 font-bold">買入倍率:</span>
                                    <span className="text-emerald-400 font-bold text-right">{tooltipData.buyInfo.multiplier}x</span>

                                    <span className="text-slate-400">金額:</span>
                                    <span className="text-slate-200 text-right">${tooltipData.buyInfo.amount.toFixed(0)}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 無資料提示 */}
            {!isLoading && prices.length === 0 && (
                <div className="h-[500px] flex items-center justify-center text-slate-500">
                    請選擇幣種以載入走勢圖
                </div>
            )}
        </div>
    );
}
