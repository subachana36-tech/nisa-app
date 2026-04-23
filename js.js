/**
 * NISA資産運用シミュレーター - クライアントサイド制御
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- リアルタイム時計の実装 ---
    const currentTimeElement = document.getElementById('current-time');

    function updateTime() {
        const now = new Date();

        // 年/月/日 時:分:秒 の形式でフォーマット
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const format = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;

        if (currentTimeElement) {
            currentTimeElement.innerText = format;
        }
    }

    // 最初に一度実行し、その後1秒ごとに更新
    updateTime();
    setInterval(updateTime, 1000);

    // --- スプレッドシート（CSV）からのデータ取得 ---
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTGHkK1d2NughZTHBX4scW9JLtz6rPYJQCZIdvlbej96WYSGi0O50DNc2KbaM2Q3DpfPF9ZAedWNMfe/pub?gid=0&single=true&output=csv';

    // 基準利回りの設定
    const baseRates = {
        'all-country': 0.05,
        'us-stock': 0.07,
        'japan-stock': 0.03,
        'india-stock': 0.09,
        'gold': 0.02
    };

    // 市場の騰落率（モメンタム）を保持する変数
    let marketMomentum = {
        'all-country': 0,
        'us-stock': 0,
        'india-stock': 0,
        'japan-stock': 0,
        'gold': 0
    };

    async function fetchMarketData() {
        try {
            const response = await fetch(CSV_URL);
            const csvText = await response.text();
            
            const rows = csvText.split('\n').map(row => row.split(','));
            const dataMap = {};
            rows.forEach(row => {
                if (row.length >= 2) {
                    dataMap[row[0].trim()] = parseFloat(row[1].trim());
                }
            });

            // マッピング定義
            const mappings = [
                { id: 'japan-stock', key: '日経平均', prevKey: '日経平均(前日)', valId: 'nikkei-value', chgId: 'nikkei-change' },
                { id: 'usd-jpy', key: '米ドル/円', prevKey: '米ドル/円(前日)', valId: 'usd-jpy-value', chgId: 'usd-jpy-change' },
                { id: 'ny-dow', key: 'NYダウ', prevKey: 'NYダウ(前日)', valId: 'dow-value', chgId: 'dow-change' },
                { id: 'us-stock', key: 'S&P500', prevKey: 'S&P500(前日)', valId: 'sp500-value', chgId: 'sp500-change' },
                { id: 'all-country', key: 'オルカン', prevKey: 'オルカン(前日)', valId: 'all-country-value', chgId: 'all-country-change' },
                { id: 'japan-stock-card', key: '日経平均', prevKey: '日経平均(前日)', valId: 'ewj-value', chgId: 'ewj-change' },
                { id: 'india-stock', key: 'インド株ETF (EPI)', prevKey: 'インド株ETF (前日)', valId: 'india-value', chgId: 'india-change' },
                { id: 'gold', key: '金(GLD)', prevKey: '金(前日)', valId: 'gld-value', chgId: 'gld-change' }
            ];

            mappings.forEach(m => {
                const current = dataMap[m.key];
                const previous = dataMap[m.prevKey];
                if (!isNaN(current)) {
                    updateElementUI(m.valId, m.chgId, current, previous);
                    
                    // 騰落率を計算して保存
                    if (!isNaN(previous) && previous !== 0) {
                        const changePercent = (current - previous) / previous;
                        marketMomentum[m.id] = changePercent;
                    }
                }
            });

        } catch (error) {
            console.error("Failed to fetch CSV data:", error);
        }
    }

    function updateElementUI(valId, chgId, current, previous) {
        const valueEl = document.getElementById(valId);
        const changeEl = document.getElementById(chgId);

        if (!valueEl || !changeEl) return;

        // 現在値の表示
        if (!isNaN(current)) {
            valueEl.innerText = current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // 前日比の計算
        if (!isNaN(current) && !isNaN(previous) && previous !== 0) {
            const change = current - previous;
            const changePercent = (change / previous) * 100;
            const changeText = (change >= 0 ? "+" : "") + change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const percentText = (change >= 0 ? "+" : "") + changePercent.toFixed(2) + "%";
            
            changeEl.innerText = `${changeText} (${percentText})`;
            
            // 色分け
            if (change >= 0) {
                changeEl.style.color = "#ff0000"; // 上昇: 赤
            } else {
                changeEl.style.color = "#008000"; // 下落: 緑
            }
        } else {
            changeEl.innerText = "--";
        }
    }

    // 初回実行
    fetchMarketData();
    // 1分ごとに更新（スプレッドシートの公開頻度に依存）
    setInterval(fetchMarketData, 60000);

    const runSimBtn = document.getElementById('run-simulation');
    const totalAssetsEl = document.getElementById('total-assets');

    if (runSimBtn && totalAssetsEl) {
        runSimBtn.addEventListener('click', () => {
            const selectedBrand = document.getElementById('asset-brand').value;
            
            // 基準利回り + (市場の騰落率 × 0.1)
            const base = baseRates[selectedBrand] || 0.05;
            const momentum = marketMomentum[selectedBrand] || 0;
            const annualRate = base + (momentum * 0.1);

            const years = parseInt(document.getElementById('asset-period').value);
            const monthlyAmountMan = parseFloat(document.getElementById('asset-amount').value);
            
            const monthlyAmount = monthlyAmountMan * 10000;
            const monthlyRate = annualRate / 12;
            const totalMonths = years * 12;

            let futureValue = 0;
            if (monthlyRate === 0) {
                futureValue = monthlyAmount * totalMonths;
            } else {
                futureValue = monthlyAmount * (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;
            }

            const totalInvestment = monthlyAmount * totalMonths;
            const totalProfit = futureValue - totalInvestment;

            // UI更新
            totalAssetsEl.innerText = Math.round(futureValue).toLocaleString();
            document.getElementById('total-investment').innerText = Math.round(totalInvestment).toLocaleString();
            document.getElementById('total-profit').innerText = (totalProfit >= 0 ? "+" : "") + Math.round(totalProfit).toLocaleString();
            document.getElementById('used-annual-rate').innerText = (annualRate * 100).toFixed(2);
            
            // バーの更新
            const principalPercent = Math.min(100, Math.max(0, (totalInvestment / futureValue) * 100));
            const profitPercent = Math.min(100, Math.max(0, (totalProfit / futureValue) * 100));
            document.getElementById('bar-principal').style.width = `${principalPercent}%`;
            document.getElementById('bar-profit').style.width = `${profitPercent}%`;

            totalAssetsEl.classList.remove('animate-pop');
            void totalAssetsEl.offsetWidth; 
            totalAssetsEl.classList.add('animate-pop');
        });
    }

    // --- カードクリックでシミュレーターへ連動 ---
    const cardMappings = [
        { cardId: 'sp500', value: 'us-stock' },
        { cardId: 'all-country', value: 'all-country' },
        { cardId: 'nikkei-index', value: 'japan-stock' },
        { cardId: 'india-nifty', value: 'india-stock' },
        { cardId: 'gold-market', value: 'gold' }
    ];

    cardMappings.forEach(m => {
        const card = document.getElementById(m.cardId);
        if (card) {
            card.addEventListener('click', () => {
                const selectEl = document.getElementById('asset-brand');
                const simulatorEl = document.querySelector('.asset-simulator');
                
                if (selectEl) {
                    selectEl.value = m.value;
                }
                
                if (simulatorEl) {
                    simulatorEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    });

    console.log("Real-time clock, Market data (CSV), and Simulator initialized.");
});

