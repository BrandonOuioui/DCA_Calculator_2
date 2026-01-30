/* ===================================
   交易紀錄表格元件
   顯示每筆定投的詳細資料
=================================== */

import { useState } from 'react';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import type { TradeRecord } from '../types';

interface TradeLogProps {
    trades: TradeRecord[];
}

// 排序欄位類型
type SortField = 'date' | 'price' | 'ath' | 'drawdown' | 'multiplier' | 'amount';
type SortDirection = 'asc' | 'desc';

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * 格式化數字
 */
function formatNumber(num: number, decimals = 2): string {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

export default function TradeLog({ trades }: TradeLogProps) {
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    /**
     * 切換排序
     */
    function toggleSort(field: SortField) {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }

    /**
     * 排序交易紀錄
     */
    function getSortedTrades(): TradeRecord[] {
        return [...trades].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'date':
                    comparison = a.date.getTime() - b.date.getTime();
                    break;
                case 'price':
                    comparison = a.price - b.price;
                    break;
                case 'ath':
                    comparison = a.ath - b.ath;
                    break;
                case 'drawdown':
                    comparison = a.drawdown - b.drawdown;
                    break;
                case 'multiplier':
                    comparison = a.multiplier - b.multiplier;
                    break;
                case 'amount':
                    comparison = a.amount - b.amount;
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * 排序圖示
     */
    function SortIcon({ field }: { field: SortField }) {
        if (sortField !== field) return null;
        return sortDirection === 'asc'
            ? <ChevronUp size={14} className="inline ml-1" />
            : <ChevronDown size={14} className="inline ml-1" />;
    }

    /**
     * 取得跌幅顏色
     */
    function getDrawdownColor(drawdown: number): string {
        if (drawdown >= -0.1) return 'text-slate-300';
        if (drawdown >= -0.2) return 'text-yellow-400';
        if (drawdown >= -0.3) return 'text-orange-400';
        return 'text-red-400';
    }

    /**
     * 取得倍率標籤樣式
     */
    function getMultiplierStyle(multiplier: number): string {
        if (multiplier <= 1) return 'bg-slate-600';
        if (multiplier <= 1.5) return 'bg-sky-500/30 text-sky-300';
        if (multiplier <= 2) return 'bg-purple-500/30 text-purple-300';
        return 'bg-pink-500/30 text-pink-300';
    }

    const sortedTrades = getSortedTrades();

    return (
        <div className="card">
            <h2 className="text-xl font-bold text-gradient mb-6">交易紀錄</h2>

            {/* 表格容器 */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    {/* 表頭 */}
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th
                                className="py-3 px-4 text-left text-slate-400 font-medium cursor-pointer hover:text-slate-200"
                                onClick={() => toggleSort('date')}
                            >
                                日期 <SortIcon field="date" />
                            </th>
                            <th
                                className="py-3 px-4 text-right text-slate-400 font-medium cursor-pointer hover:text-slate-200"
                                onClick={() => toggleSort('price')}
                            >
                                價格 <SortIcon field="price" />
                            </th>
                            <th
                                className="py-3 px-4 text-right text-slate-400 font-medium cursor-pointer hover:text-slate-200"
                                onClick={() => toggleSort('ath')}
                            >
                                當前 ATH <SortIcon field="ath" />
                            </th>
                            <th
                                className="py-3 px-4 text-right text-slate-400 font-medium cursor-pointer hover:text-slate-200"
                                onClick={() => toggleSort('drawdown')}
                            >
                                跌幅 <SortIcon field="drawdown" />
                            </th>
                            <th
                                className="py-3 px-4 text-center text-slate-400 font-medium cursor-pointer hover:text-slate-200"
                                onClick={() => toggleSort('multiplier')}
                            >
                                倍率 <SortIcon field="multiplier" />
                            </th>
                            <th
                                className="py-3 px-4 text-right text-slate-400 font-medium cursor-pointer hover:text-slate-200"
                                onClick={() => toggleSort('amount')}
                            >
                                買入金額 <SortIcon field="amount" />
                            </th>
                            <th className="py-3 px-4 text-right text-slate-400 font-medium">
                                累計持倉
                            </th>
                        </tr>
                    </thead>

                    {/* 表身 */}
                    <tbody>
                        {sortedTrades.map((trade, index) => (
                            <tr
                                key={index}
                                className={`
                  border-b border-slate-700/50 
                  hover:bg-slate-700/30 transition-colors
                  ${trade.insufficientFunds ? 'bg-red-500/5' : ''}
                `}
                            >
                                {/* 日期 */}
                                <td className="py-3 px-4 text-slate-200">
                                    <div className="flex items-center gap-2">
                                        {trade.insufficientFunds && (
                                            <AlertCircle size={14} className="text-red-400" />
                                        )}
                                        {formatDate(trade.date)}
                                        {trade.insufficientFunds && <span className="text-xs text-red-400">(餘額不足)</span>}
                                    </div>
                                </td>

                                {/* 價格 */}
                                <td className="py-3 px-4 text-right text-slate-200 font-mono">
                                    ${formatNumber(trade.price)}
                                </td>

                                {/* 當前 ATH */}
                                <td className="py-3 px-4 text-right text-amber-400 font-mono">
                                    ${formatNumber(trade.ath)}
                                </td>

                                {/* 跌幅 */}
                                <td className={`py-3 px-4 text-right font-mono ${getDrawdownColor(trade.drawdown)}`}>
                                    {formatNumber(trade.drawdown * 100)}%
                                </td>

                                {/* 倍率 */}
                                <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMultiplierStyle(trade.multiplier)}`}>
                                        {trade.multiplier}x
                                    </span>
                                </td>

                                {/* 買入金額 */}
                                <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                                    ${formatNumber(trade.amount)}
                                </td>

                                {/* 累計持倉 */}
                                <td className="py-3 px-4 text-right text-sky-400 font-mono">
                                    {formatNumber(trade.totalCoins, 6)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 無資料提示 */}
            {trades.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                    尚無交易紀錄
                </div>
            )}
        </div>
    );
}
