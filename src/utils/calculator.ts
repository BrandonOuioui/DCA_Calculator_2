/* ===================================
   回測核心運算邏輯
   實作動態 ATH 計算與階梯式加碼
=================================== */

import type {
    BacktestConfig,
    DrawdownTier,
    TradeRecord,
    BacktestResult,
    PriceDataPoint
} from '../types';

/**
 * 根據跌幅查找對應的加碼倍率
 * 
 * 邏輯說明：
 * 級距表: [0%, 1x], [-10%, 1.2x], [-20%, 1.5x], [-30%, 2x]
 * 若跌幅 = -15%，我們要找「跌幅剛好落入哪個區間」
 * -15% 落在 -10% ~ -20% 之間，所以應該使用 -10% 對應的 1.2x
 * 
 * 實作方式：
 * 1. 按閾值升序排序（從 -30% 到 0%）
 * 2. 找「第一個 threshold >= drawdown」的級距
 */
export function getMultiplier(drawdown: number, tiers: DrawdownTier[]): number {
    // 按閾值升序排序（從最低 -30% 到最高 0%）
    const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);

    // 從最低閾值開始找，找到第一個 threshold >= drawdown 的
    for (const tier of sortedTiers) {
        if (tier.threshold >= drawdown) {
            return tier.multiplier;
        }
    }

    // 若跌幅未達任何閾值（價格創新高），使用基礎倍率 1x
    return 1;
}

/**
 * 將價格資料按日聚合
 * CoinGecko 可能回傳多筆同一天的資料，取每日最後一筆
 */
function aggregateDailyPrices(prices: PriceDataPoint[]): PriceDataPoint[] {
    const dailyMap = new Map<string, PriceDataPoint>();

    for (const point of prices) {
        const date = new Date(point.timestamp);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        dailyMap.set(dateKey, point); // 覆蓋舊值，保留最後一筆
    }

    // 轉回陣列並按時間排序
    return Array.from(dailyMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 主回測函式
 * 核心邏輯：每個定投日計算 ATH、跌幅、倍率，執行買入
 */
export function runBacktest(
    prices: PriceDataPoint[],
    config: BacktestConfig,
    tiers: DrawdownTier[]
): BacktestResult {
    // 1. 聚合每日價格
    const dailyPrices = aggregateDailyPrices(prices);

    // 2. 初始化狀態
    let runningAth = 0;           // 動態 ATH
    let remainingCash = config.initialCapital; // 剩餘現金
    let totalCoins = 0;           // 累計持倉
    let totalInvested = 0;        // 累計投入
    let maxDrawdown = 0;          // 最大回撤
    let fundsDepleted = false;
    let fundsDepletedDate: Date | undefined;

    const trades: TradeRecord[] = [];

    // 計算定投日 (從第一天開始，每 N 天一次)
    const startTimestamp = config.startDate.getTime();

    // 3. 遍歷每日價格
    for (const pricePoint of dailyPrices) {
        const currentDate = new Date(pricePoint.timestamp);
        const currentPrice = pricePoint.price;

        // 更新動態 ATH (核心邏輯：從歷史第一天就開始計算)
        runningAth = Math.max(runningAth, currentPrice);

        // 計算當前跌幅
        const drawdown = runningAth > 0
            ? (currentPrice - runningAth) / runningAth
            : 0;

        // 檢查是否早於用戶設定的開始日期
        // 若早於開始日，我們只計算 ATH，不執行任何交易或記錄
        if (currentDate.getTime() < startTimestamp) {
            continue;
        }

        // 更新最大回撤 (只統計回測區間內)
        maxDrawdown = Math.min(maxDrawdown, drawdown);

        // 檢查是否為定投日 (相對於開始日期)
        const daysSinceStart = Math.floor(
            (pricePoint.timestamp - startTimestamp) / (24 * 60 * 60 * 1000)
        );
        const isDcaDay = daysSinceStart >= 0 && daysSinceStart % config.dcaFrequency === 0;

        if (!isDcaDay) continue;

        // 4. 計算倍率與買入金額
        const multiplier = getMultiplier(drawdown, tiers);
        const buyAmount = config.baseDcaAmount * multiplier;

        // 5. 檢查資金是否足夠
        const insufficientFunds = remainingCash < buyAmount;

        if (insufficientFunds && !fundsDepleted) {
            fundsDepleted = true;
            fundsDepletedDate = currentDate;
        }

        // 計算實際買入金額 (若資金不足則用剩餘現金)
        const actualBuyAmount = insufficientFunds
            ? Math.max(0, remainingCash)
            : buyAmount;

        // 計算買入數量
        const coinsBought = actualBuyAmount / currentPrice;

        // 更新狀態
        if (actualBuyAmount > 0) {
            remainingCash -= actualBuyAmount;
            totalCoins += coinsBought;
            totalInvested += actualBuyAmount;
        }

        // 6. 記錄交易
        trades.push({
            date: currentDate,
            price: currentPrice,
            ath: runningAth,
            drawdown,
            multiplier,
            amount: actualBuyAmount,
            coinsBought,
            totalCoins,
            remainingCash,
            insufficientFunds
        });
    }

    // 7. 計算最終結果
    const lastPrice = dailyPrices[dailyPrices.length - 1]?.price || 0;
    const finalValue = totalCoins * lastPrice;
    const averagePrice = totalInvested > 0 ? totalInvested / totalCoins : 0;
    const roi = totalInvested > 0
        ? ((finalValue - totalInvested) / totalInvested) * 100
        : 0;

    return {
        trades,
        totalInvested,
        totalCoins,
        averagePrice,
        finalValue,
        roi,
        maxDrawdown: maxDrawdown * 100, // 轉為百分比
        fundsDepleted,
        fundsDepletedDate
    };
}

/**
 * 產生預設級距表
 */
export function getDefaultTiers(): DrawdownTier[] {
    return [
        { id: '1', threshold: 0, multiplier: 1 },
        { id: '2', threshold: -0.1, multiplier: 1.2 },
        { id: '3', threshold: -0.2, multiplier: 1.5 },
        { id: '4', threshold: -0.3, multiplier: 2 },
    ];
}
