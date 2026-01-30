# Project Brief: Crypto Drawdown DCA Backtester

## 1. Project Overview
一個純前端的投資回測工具，旨在協助使用者驗證「高點回撤加碼 (Drawdown-based DCA)」策略的有效性。使用者可自定義回撤級距與加碼倍率，並透過歷史數據視覺化呈現投資績效。

## 2. User Requirements
- **核心功能**：透過 CoinGecko API 獲取歷史價格，執行階梯式 DCA 回測。
- **自定義參數**：
    - 初始資金 (Initial Capital)
    - 基礎定投金額 (Base DCA Amount)
    - 定投頻率 (天數)
    - 回撤級距表 (例如: -10% 買 1.2x, -20% 買 1.5x)
- **資料儲存**：使用 LocalStorage 暫存策略參數，無需後端。
- **視覺化需求**：互動式 K 線/走勢圖、買入點標記、詳細交易日誌、資產曲線。

## 3. Technical Logic
- **數據流 (Data Flow)**：
    1. 使用者輸入幣種與時間區間 -> 請求 CoinGecko API (`/coins/{id}/market_chart/range`)。
    2. 系統執行遍歷運算：
        - 維護一個 `running_ath` 變數：`current_ath = Math.max(previous_ath, current_price)`。
        - 計算當前跌幅：`drawdown = (current_price - current_ath) / current_ath`。
        - 根據「回撤級距表」判定加碼倍率。
    3. 扣款邏輯：檢查「剩餘現金」，若餘額不足以支付該次定投，則停止回測並報錯。
- **計算指標**：
    - 總成本 (Total Invested)
    - 持倉總量 (Total Assets)
    - 持倉均價 (Average Price)
    - 最終投報率 (ROI)
    - 最大回撤 (Max Drawdown)

## 4. Proposed Stack & Files
- **Frontend**: React.js (Vite), Tailwind CSS, Lucide React (Icons).
- **Charting**: Lightweight Charts (TradingView).
- **State Management**: React Hooks (useState, useEffect).
- **Files**:
    - `App.tsx`: 主頁面邏輯。
    - `components/ControlPanel.tsx`: 參數設定區。
    - `components/BacktestChart.tsx`: 歷史走勢圖。
    - `components/TradeLog.tsx`: 交易紀錄清單。
    - `utils/calculator.ts`: 回測核心邏輯運算。
    - `services/api.ts`: CoinGecko API 介接。

## 5. Potential Edge Cases
- **API 限制**：CoinGecko Free Tier 有 Rate Limit，需處理 429 錯誤。
- **數據斷層**：API 回傳數據缺失時，應跳出錯誤提示並停止計算。
- **邏輯邊界**：使用者設定的開始日期若無數據（幣種未上市），需導回最早可用日期。
- **資金枯竭**：加碼力道過猛導致初始資金提早用罄，需在圖表明確標註。