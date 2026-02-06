/* ===================================
   TypeScript 型別定義
   定義所有資料結構
=================================== */

/**
 * 回測設定參數
 */
export interface BacktestConfig {
    coinId: string;           // 幣種 ID (CoinGecko)
    startDate: Date;          // 開始日期
    endDate: Date;            // 結束日期
    initialCapital: number;   // 初始資金 (USD)
    baseDcaAmount: number;    // 基礎定投金額 (USD)
    dcaFrequency: number;     // 定投頻率 (天)
}

/**
 * 回撤級距設定
 * 例如: { threshold: -0.1, multiplier: 1.2 } 表示跌 10% 時買 1.2 倍
 */
export interface DrawdownTier {
    id: string;               // 唯一識別碼
    threshold: number;        // 跌幅閾值 (負數，如 -0.1 表示 -10%)
    multiplier: number;       // 加碼倍率
}

/**
 * 單筆交易紀錄
 */
export interface TradeRecord {
    date: Date;               // 交易日期
    price: number;            // 當時價格
    ath: number;              // 當時的 ATH
    drawdown: number;         // 當時的跌幅
    multiplier: number;       // 使用的加碼倍率
    amount: number;           // 投入金額 (USD)
    coinsBought: number;      // 買入數量
    totalCoins: number;       // 累計持倉
    remainingCash: number;    // 剩餘現金
    insufficientFunds: boolean; // 是否資金不足
}

/**
 * 回測結果摘要
 */
export interface BacktestResult {
    trades: TradeRecord[];    // 所有交易紀錄
    totalInvested: number;    // 總投入成本
    totalCoins: number;       // 持倉總量
    averagePrice: number;     // 持倉均價
    finalValue: number;       // 目前最終價值 (Latest Price)
    roi: number;              // 目前投報率 (Latest Price)
    finalValueAtLastBuy: number; // 最後一筆投入當下的價值
    roiAtLastBuy: number;        // 最後一筆投入當下的投報率
    maxDrawdown: number;      // 最大回撤 (%)
    fundsDepleted: boolean;   // 是否資金枯竭
    fundsDepletedDate?: Date; // 資金枯竭日期
    executionDuration: number; // Days until depleted or finished
    executionStartDate: Date;  // 實際開始執行日期
    executionEndDate: Date;    // 實際結束執行日期 (或資金耗盡日)
}

/**
 * CoinGecko API 回傳的價格資料點
 */
export interface PriceDataPoint {
    timestamp: number;        // Unix 時間戳 (毫秒)
    price: number;            // 價格 (USD)
}

/**
 * 幣種資訊 (用於下拉選單)
 */
export interface CoinOption {
    id: string;               // CoinGecko ID
    symbol: string;           // 幣種符號 (e.g., BTC)
    name: string;             // 幣種名稱 (e.g., Bitcoin)
}

/**
 * API 請求狀態
 */
export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 錯誤訊息
 */
export interface ApiError {
    code: string;
    message: string;
}
/**
 * 儲存的策略
 */
export interface SavedStrategy {
    id: string;
    name: string;
    created: number; // Timestamp
    config: BacktestConfig;
    tiers: DrawdownTier[];
    result: {
        roi: number;
        roiAtLastBuy?: number; // Optional for backward compatibility
        maxDrawdown: number;
        finalValue: number;
        finalValueAtLastBuy?: number; // Optional for backward compatibility
        totalInvested: number;
        totalCoins: number; // Added
        averagePrice: number;
        executionDuration?: number; // Added
        executionStartDate?: Date; // Added
        executionEndDate?: Date;   // Added
    };
}
