
async function testApi() {
    const coinId = 'bitcoin';
    // 2020-01-01
    const from = 1577836800;
    // Now
    const to = Math.floor(Date.now() / 1000);

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;

    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return;
        }
        const data = await response.json();
        console.log(`Success! Data points: ${data.prices.length}`);
        console.log('First point:', data.prices[0]);
        console.log('Last point:', data.prices[data.prices.length - 1]);
    } catch (error) {
        console.error('Fetch failed:', error);
    }
}

testApi();
