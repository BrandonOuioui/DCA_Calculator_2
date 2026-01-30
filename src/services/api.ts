/* ===================================
   CoinGecko API 服務
   負責取得歷史價格資料
=================================== */

import type { PriceDataPoint, CoinOption } from '../types';

// API 基礎 URL
const CG_BASE_URL = 'https://api.coingecko.com/api/v3';
const CC_BASE_URL = 'https://min-api.cryptocompare.com/data/v2';

// 幣種 ID 映射 (CoinGecko ID -> CryptoCompare Symbol)
const COIN_MAP: Record<string, string> = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'binancecoin': 'BNB',
    'solana': 'SOL',
    'ripple': 'XRP',
    'cardano': 'ADA',
    'dogecoin': 'DOGE',
    'polkadot': 'DOT',
    'avalanche-2': 'AVAX',
    'chainlink': 'LINK',
    'matic-network': 'MATIC',
    'shiba-inu': 'SHIB',
    'litecoin': 'LTC',
    'uniswap': 'UNI'
};



/**
 * 從 CryptoCompare 取得歷史價格 (支援長天數)
 */
/**
 * 從 CryptoCompare 取得完整歷史價格
 */
async function fetchFromCryptoCompare(symbol: string): Promise<PriceDataPoint[]> {
    // 使用 allData=true 取得該幣種所有歷史數據
    const url = `${CC_BASE_URL}/histoday?fsym=${symbol}&tsym=USD&allData=true`;
    const response = await fetch(url);
    const result = await response.json();

    if (result.Response === 'Error') {
        throw { code: 'CC_ERROR', message: result.Message };
    }

    const data = result.Data.Data;
    if (!data || data.length === 0) return [];

    // 轉換格式
    return data.map((d: any) => ({
        timestamp: d.time * 1000,
        price: d.close
    }));
}

/**
 * 取得熱門幣種列表 (用於下拉選單)
 */
export async function fetchCoinList(): Promise<CoinOption[]> {
    try {
        const url = `${CG_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        return data.map((coin: { id: string; symbol: string; name: string }) => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name
        }));
    } catch (e) {
        console.error('CoinGecko list failed, using fallback list');
        // 預設列表
        return [
            { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
            { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
            { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
            { id: 'solana', symbol: 'SOL', name: 'Solana' },
        ];
    }
}

/**
 * 取得歷史價格資料
 * 即使指定了 from/to，為了計算 ATH，我們傾向抓取完整歷史數據
 */
export async function fetchPriceHistory(
    coinId: string,
    _from?: number, // 保留參數介面，但內部抓全量
    _to?: number
): Promise<PriceDataPoint[]> {
    // 1. 嘗試 CryptoCompare (優先支援長歷史)
    const symbol = COIN_MAP[coinId];
    if (symbol) {
        try {
            console.log(`Fetching full history from CryptoCompare: ${symbol}`);
            return await fetchFromCryptoCompare(symbol);
        } catch (e) {
            console.warn('CryptoCompare failed, falling back to CoinGecko', e);
        }
    }

    // 2. 回退 CoinGecko (使用 days=max 抓全量)
    // 注意: CoinGecko days=max 資料粒度會自動調整 (每日/每四日)，適合長歷史
    const url = `${CG_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=max&interval=daily`;

    try {
        const response = await fetch(url);

        if (response.status === 429) {
            throw { code: 'RATE_LIMIT', message: 'API 請求過於頻繁，請稍後再試' };
        }

        if (!response.ok) {
            throw { code: `HTTP_${response.status}`, message: 'API 請求失敗' };
        }

        const data = await response.json();

        if (!data.prices || data.prices.length === 0) {
            throw { code: 'NO_DATA', message: '無價格資料' };
        }

        return data.prices.map(([timestamp, price]: [number, number]) => ({
            timestamp,
            price
        }));
    } catch (err: any) {
        if (err.code) throw err;
        throw { code: 'UNKNOWN', message: '無法取得價格資料' };
    }
}

/**
 * 取得實時價格與 ATH (用於實時計算機)
 */
export async function fetchRealTimeData(coinId: string): Promise<{ currentPrice: number, ath: number }> {
    try {
        const url = `${CG_BASE_URL}/coins/markets?vs_currency=usd&ids=${coinId}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('API Request Failed');
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            throw new Error('No Data Found');
        }

        const coinData = data[0];
        // CoinGecko API 回傳的 ath 是該幣種的歷史最高價
        // 我們直接使用它，這樣最準確
        return {
            currentPrice: coinData.current_price,
            ath: coinData.ath
        };
    } catch (e) {
        console.error('Fetch Real-time Data Failed', e);
        throw e;
    }
}
