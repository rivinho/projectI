// Main application functionality

let uploadedFiles = [];
let dealPipeline = JSON.parse(localStorage.getItem('dealPipeline') || '[]');

// Tab switching functionality
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'pipeline') loadPipeline();
    else if (tabName === 'industry') loadIndustryComparison();
}

// Pipeline management
function loadPipeline() {
    const content = document.getElementById('pipeline-content');
    
    if (dealPipeline.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>No companies analyzed yet</h3>
                <p>Companies you research will automatically appear here for tracking</p>
            </div>
        `;
        return;
    }

    const html = dealPipeline.map(company => `
        <div class="pipeline-item" onclick="loadCompanyFromPipeline('${company.symbol}')">
            <div>
                <div style="font-weight: 600; color: #ffffff; font-size: 1.1rem;">${company.name}</div>
                <div style="font-size: 0.9rem; opacity: 0.7; margin-top: 4px;">Analyzed: ${company.date}</div>
            </div>
            <div style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">${company.dealScore}/100</div>
        </div>
    `).join('');

    content.innerHTML = html;
}

function loadIndustryComparison() {
    const content = document.getElementById('industry-content');
    
    if (dealPipeline.length < 2) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>Need multiple companies for comparison</h3>
                <p>Analyze companies in the same industry to see comparative insights</p>
            </div>
        `;
        return;
    }

    const industries = {};
    dealPipeline.forEach(company => {
        const industry = company.industry || 'Technology';
        if (!industries[industry]) industries[industry] = [];
        industries[industry].push(company);
    });

    const html = Object.keys(industries).map(industry => `
        <div class="analysis-card">
            <div class="analysis-title">${industry} Sector</div>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Companies</div>
                    <div class="metric-value">${industries[industry].length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Score</div>
                    <div class="metric-value">${Math.round(industries[industry].reduce((sum, c) => sum + c.dealScore, 0) / industries[industry].length)}</div>
                </div>
            </div>
        </div>
    `).join('');

    content.innerHTML = `<div class="analysis-grid">${html}</div>`;
}

function addToPipeline(companyData) {
    const pipelineItem = {
        name: companyData.name,
        symbol: companyData.symbol || 'PRIVATE',
        dealScore: calculateDealScore(companyData),
        date: new Date().toLocaleDateString(),
        industry: companyData.industry || 'Technology'
    };

    const existingIndex = dealPipeline.findIndex(c => c.symbol === companyData.symbol);
    if (existingIndex >= 0) {
        dealPipeline[existingIndex] = pipelineItem;
    } else {
        dealPipeline.push(pipelineItem);
    }

    localStorage.setItem('dealPipeline', JSON.stringify(dealPipeline));
    
    if (DEBUG_MODE) {
        console.log('📊 Added to pipeline:', pipelineItem);
    }
}

function calculateDealScore(data) {
    let score = 50; // Base score

    // Financial health (if available)
    if (data.financials) {
        const ebitdaMargin = parseFloat(data.financials.ebitdaMargin);
        if (!isNaN(ebitdaMargin)) {
            if (ebitdaMargin > 20) score += 25;
            else if (ebitdaMargin > 10) score += 15;
            else if (ebitdaMargin > 0) score += 8;
        }

        const peRatio = parseFloat(data.stockInfo?.peRatio);
        if (!isNaN(peRatio)) {
            if (peRatio < 25) score += 10;
            else if (peRatio < 35) score += 5;
        }
    }

    // Stock trend (if available)
    if (data.change && parseFloat(data.change) > 0) {
        score += 10;
    }

    // AI analysis quality bonus
    if (data.overview && data.overview.length > 100) {
        score += 5;
    }

    return Math.min(100, Math.max(0, score));
}

function loadCompanyFromPipeline(symbol) {
    document.getElementById('companySearch').value = symbol;
    switchTab('research');
    searchCompany();
}

// Alpha Vantage API integration
async function fetchFinancialData(symbol) {
    const apiStatus = areAPIKeysConfigured();
    if (!apiStatus.alphaVantage) {
        throw new Error('Alpha Vantage API key not configured');
    }

    // Check cache first
    const cacheKey = `financial_${symbol}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
        if (DEBUG_MODE) console.log('📦 Using cached financial data for', symbol);
        return cached;
    }

    try {
        const [overviewResponse, quoteResponse] = await Promise.all([
            fetch(`${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`),
            fetch(`${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`)
        ]);

        const overview = await overviewResponse.json();
        const quote = await quoteResponse.json();

        if (overview['Error Message'] || overview['Note']) {
            throw new Error('API limit reached or invalid symbol');
        }

        const quoteData = quote['Global Quote'];
        const formatNumber = (num) => {
            if (!num || num === 'None') return 'N/A';
            const value = parseFloat(num);
            if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
            if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
            return value.toLocaleString();
        };

        const financialData = {
            price: parseFloat(quoteData['05. price']).toFixed(2),
            change: parseFloat(quoteData['09. change']).toFixed(2),
            changePercent: parseFloat(quoteData['10. change percent'].replace('%', '')).toFixed(2),
            financials: {
                revenue: formatNumber(overview.RevenueTTM),
                ebitda: formatNumber(overview.EBITDA),
                ebitdaMargin: overview.ProfitMargin ? `${(parseFloat(overview.ProfitMargin) * 100).toFixed(1)}%` : 'N/A',
                grossProfit: formatNumber(overview.GrossProfitTTM),
                grossMargin: overview.GrossProfitTTM && overview.RevenueTTM ? 
                    `${((parseFloat(overview.GrossProfitTTM) / parseFloat(overview.RevenueTTM)) * 100).toFixed(1)}%` : 'N/A'
            },
            stockInfo: {
                high52Week: parseFloat(overview['52WeekHigh']).toFixed(2),
                low52Week: parseFloat(overview['52WeekLow']).toFixed(2),
                avgVolume: formatNumber(overview.SharesOutstanding),
                marketCap: formatNumber(overview.MarketCapitalization),
                peRatio: parseFloat(overview.PERatio).toFixed(1)
            }
        };

        // Cache the data
        setCache(cacheKey, financialData, CACHE_DURATION);
        
        if (DEBUG_MODE) console.log('💰 Fetched financial data for', symbol);
        return financialData;
        
    } catch (error) {
        console.error('💥 Financial data fetch failed:', error);
        throw error;
    }
}

// Main search function
async function searchCompany() {
    const searchTerm = document.getElementById('companySearch').value.trim();
    
    if (!searchTerm && uploadedFiles.length === 0) {
        alert('Please enter a company name or upload documents');
        return;
    }

    if (!searchTerm && uploadedFiles.length > 0) {
        analyzeDocumentOnly();
        return;
    }

    const results = document.getElementById('results');
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');

    results.style.display = 'block';
    loading.style.display = 'block';
    content.innerHTML = '';

    try {
        if (DEBUG_MODE) console.log(`🔍 Searching for: ${searchTerm}`);
        
        // Get AI-powered company information
        const aiSummary = await getCompanyInfoWithAI(searchTerm);
        
        let financialData = null;
        if (aiSummary.symbol && aiSummary.isPublic) {
            try {
                financialData = await fetchFinancialData(aiSummary.symbol);
            } catch (error) {
                console.log('⚠️ Financial data unavailable:', error.message);
            }
        }

        const companyData = {
            name: aiSummary.name,
            symbol: aiSummary.symbol || 'PRIVATE',
            overview: aiSummary.overview,
            history: aiSummary.history,
            products: aiSummary.products,
            industry: aiSummary.industry,
            isPublic: aiSummary.isPublic,
            hasError: !!aiSummary.error,
            errorMessage: aiSummary.error,
            ...financialData
        };

        loading.style.display = 'none';
        await displayCompanyData(companyData);
        addToPipeline(companyData);
        
    } catch (error) {
        console.error('💥 Search failed:', error);
        loading.style.display = 'none';
        displayError(`Search failed: ${error.message}. Check your API keys in config.js`);
    }
}

// Display functions
async function displayCompanyData(data) {
    const content = document.getElementById('content');
    const hasFinancials = data.financials && data.isPublic;
    
    const stockDisplay = hasFinancials ? `
        <div style="margin-top: 10px; font-size: 2rem; font-weight: 600;">
            $${data.price}
            <span style="font-size: 1rem; margin-left: 15px; color: ${data.change > 0 ? '#4ade80' : '#f87171'};">
                ${data.change > 0 ? '📈' : '📉'} ${data.change > 0 ? '+' : ''}${data.change} (${data.changePercent > 0 ? '+' : ''}${data.changePercent}%)
            </span>
        </div>
    ` : `<div style="margin-top: 10px; font-size: 1.5rem; opacity: 0.7;">${data.isPublic ? 'Financial data loading...' : 'Private Company'}</div>`;

    const aiSummarySection = `
        <div style="background: rgba(99, 102, 241, 0.08); border-radius: 16px; padding: 28px; margin: 28px 0; border: 1px solid rgba(99, 102, 241, 0.2);">
            <h3 class="section-title">🤖 AI Company Analysis</h3>
            ${data.hasError ? `
                <div class="warning-card">
                    <p>⚠️ ${data.errorMessage}</p>
                </div>
            ` : ''}
            <div class="analysis-grid">
                <div class="analysis-card">
                    <div class="analysis-title">Business Overview</div>
                    <p style="opacity: 0.9; line-height: 1.6; font-size: 0.9rem;">${data.overview}</p>
                </div>
                <div class="analysis-card">
                    <div class="analysis-title">Company History</div>
                    <p style="opacity: 0.9; line-height: 1.6; font-size: 0.9rem;">${data.history}</p>
                </div>
                <div class="analysis-card" style="grid-column: 1 / -1;">
                    <div class="analysis-title">Products & Services</div>
                    <p style="opacity: 0.9; line-height: 1.6; font-size: 0.9rem;">${data.products}</p>
                </div>
            </div>
            <p style="margin-top: 15px; font-size: 0.8rem; opacity: 0.6; text-align: center;">
                Powered by Google Gemini AI
            </p>
        </div>
    `;

    const financialMetrics = hasFinancials ? `
        <div style="margin-bottom: 32px;">
            <h3 class="section-title">📊 Financial Metrics</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Revenue (TTM)</div>
                    <div class="metric-value">${data.financials.revenue}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">EBITDA</div>
                    <div class="metric-value">${data.financials.ebitda}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">EBITDA Margin</div>
                    <div class="metric-value">${data.financials.ebitdaMargin}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Gross Profit</div>
                    <div class="metric-value">${data.financials.grossProfit}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Gross Margin</div>
                    <div class="metric-value">${data.financials.grossMargin}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">P/E Ratio</div>
                    <div class="metric-value">${data.stockInfo.peRatio}</div>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 32px;">
            <h3 class="section-title">📈 Stock Performance</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">52 Week High</div>
                    <div class="metric-value">$${data.stockInfo.high52Week}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">52 Week Low</div>
                    <div class="metric-value">$${data.stockInfo.low52Week}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Market Cap</div>
                    <div class="metric-value">${data.stockInfo.marketCap}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Volume</div>
                    <div class="metric-value">${data.stockInfo.avgVolume}</div>
                </div>
            </div>
        </div>
    ` : `
        <div class="warning-card">
            <h3>📊 Financial Information</h3>
            <p>${data.isPublic ? 'Financial data unavailable (API key needed or rate limit reached)' : 'Private company - financial metrics not publicly available'}</p>
        </div>
    `;

    // Generate Pre-LOI analysis
    const preLoiAnalysis = await generatePreLoiAnalysis(data);
    
    // Document analysis if files are uploaded
    const documentAnalysisSection = uploadedFiles.length > 0 ? await generateDocumentAnalysis(data) : '';

    content.innerHTML = `
        <div class="company-card">
            <div class="company-header">
                <div>
                    <div class="company-name">${data.name}</div>
                    ${stockDisplay}
                </div>
                <div class="company-ticker">${data.symbol}</div>
            </div>

            ${aiSummarySection}
            ${financialMetrics}
            ${preLoiAnalysis}
            ${documentAnalysisSection}
        </div>
    `;
}

function displayError(message) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="error-card">
            <h3>⚠️ Search Error</h3>
            <p>${message}</p>
            <p style="margin-top: 15px; opacity: 0.8;">
                <strong>Troubleshooting:</strong><br>
                • Make sure your API keys are configured in config.js<br>
                • Try searching for well-known companies like Apple, Microsoft, or Tesla<br>
                • Check the browser console for detailed error messages
            </p>
        </div>
    `;
}

// File upload handling
document.getElementById('fileUpload').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (files.length > MAX_UPLOADED_FILES) {
        alert(`Maximum ${MAX_UPLOADED_FILES} files allowed`);
        return;
    }
    
    uploadedFiles = files;
    updateUploadDisplay();
    
    // Show analyze button if files are uploaded
    const analyzeBtn = document.getElementById('analyzeDocsBtn');
    analyzeBtn.style.display = files.length > 0 ? 'block' : 'none';
    
    if (DEBUG_MODE) {
        console.log('📄 Files uploaded:', files.map(f => f.name));
    }
});

function updateUploadDisplay() {
    const uploadContent = document.querySelector('.upload-content');
    const uploadZone = document.querySelector('.upload-zone');
    
    if (uploadedFiles.length > 0) {
        uploadContent.innerHTML = `
            <div class="upload-icon">✅</div>
            <h3>${uploadedFiles.length} Document${uploadedFiles.length > 1 ? 's' : ''} Ready</h3>
            <p style="opacity: 0.7; margin-top: 10px;">
                ${uploadedFiles.map(f => f.name).join(', ')}
            </p>
        `;
        uploadZone.style.borderColor = 'rgba(34, 197, 94, 0.5)';
        uploadZone.style.background = 'rgba(34, 197, 94, 0.1)';
    }
}

// Cache management
function setCache(key, data, ttl) {
    const item = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl
    };
    localStorage.setItem(key, JSON.stringify(item));
}

function getFromCache(key) {
    try {
        const item = JSON.parse(localStorage.getItem(key));
        if (!item) return null;
        
        if (Date.now() - item.timestamp > item.ttl) {
            localStorage.removeItem(key);
            return null;
        }
        
        return item.data;
    } catch (error) {
        return null;
    }
}

// Enter key search functionality
document.getElementById('companySearch').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchCompany();
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    if (DEBUG_MODE) {
        console.log('🚀 Company Research Platform initialized');
        console.log('📦 Pipeline contains', dealPipeline.length, 'companies');
    }
});
