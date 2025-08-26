// AI Analysis functionality using Gemini API

// Get company information using AI
async function getCompanyInfoWithAI(query) {
    const apiStatus = areAPIKeysConfigured();
    if (!apiStatus.gemini) {
        throw new Error('Please add your Gemini API key to config.js to enable AI analysis');
    }

    const prompt = `Find detailed information about the company "${query}". Provide a JSON response with:
    {
        "name": "Full company name",
        "symbol": "Stock symbol if public, otherwise null",
        "overview": "2-3 sentence business description",
        "history": "2-3 sentence founding and key milestones",
        "products": "Key products and services description",
        "isPublic": true/false,
        "industry": "Primary industry"
    }`;

    try {
        const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.8,
                    maxOutputTokens: 1000,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`Gemini API Error: ${data.error.message}`);
        }
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            if (DEBUG_MODE) console.log('🤖 AI company info retrieved:', result.name);
            return result;
        } else {
            throw new Error('Could not parse AI response as JSON');
        }
    } catch (error) {
        console.error('🤖 AI company search failed:', error);
        
        return {
            name: query,
            symbol: null,
            overview: `Information for "${query}" could not be retrieved via AI. ${error.message}`,
            history: "Historical information not available due to API error.",
            products: "Product information not available due to API error.",
            isPublic: false,
            industry: "Unknown",
            error: error.message
        };
    }
}

// Generate Pre-LOI investment analysis
async function generatePreLoiAnalysis(data) {
    const dealScore = calculateDealScore(data);
    
    const getRiskLevel = (category) => {
        switch (category) {
            case 'cashflow':
                if (!data.financials) return { level: 'medium', reason: 'Financial data not available for analysis' };
                const margin = parseFloat(data.financials.ebitdaMargin);
                if (margin > 15) return { level: 'low', reason: `Strong EBITDA margin of ${data.financials.ebitdaMargin}` };
                if (margin > 5) return { level: 'medium', reason: `Moderate EBITDA margin of ${data.financials.ebitdaMargin}` };
                return { level: 'high', reason: `Low EBITDA margin of ${data.financials.ebitdaMargin}` };
                
            case 'customer':
                return { level: 'medium', reason: 'Customer concentration analysis requires detailed revenue breakdown data' };
                
            case 'revenue':
                if (data.isPublic && data.financials) {
                    return { level: 'low', reason: 'Public companies typically have established revenue models' };
                }
                return { level: 'medium', reason: 'Revenue model assessment requires additional data' };
                
            case 'consumability':
                const industry = data.industry?.toLowerCase() || '';
                if (industry.includes('software') || industry.includes('saas')) {
                    return { level: 'low', reason: 'Software/SaaS models typically have high repeat usage' };
                }
                return { level: 'medium', reason: 'Consumability varies by industry and business model' };
                
            case 'seasonality':
                if (industry.includes('retail') || industry.includes('consumer')) {
                    return { level: 'medium', reason: 'Consumer-facing businesses often have seasonal patterns' };
                }
                return { level: 'low', reason: 'Limited seasonal exposure based on industry' };
                
            case 'recession':
                if (industry.includes('technology') || industry.includes('software')) {
                    return { level: 'medium', reason: 'Technology companies can be growth-sensitive but often resilient' };
                }
                return { level: 'medium', reason: 'Recession resistance depends on specific business model' };
                
            default:
                return { level: 'medium', reason: 'Assessment requires additional analysis' };
        }
    };

    const getRiskClass = (level) => {
        switch (level) {
            case 'low': return 'risk-low';
            case 'medium': return 'risk-medium';
            case 'high': return 'risk-high';
            default: return 'risk-medium';
        }
    };

    const getRiskIcon = (level) => {
        switch (level) {
            case 'low': return '✅';
            case 'medium': return '⚠️';
            case 'high': return '❌';
            default: return '⚠️';
        }
    };

    const analyses = {
        cashflow: getRiskLevel('cashflow'),
        customer: getRiskLevel('customer'),
        revenue: getRiskLevel('revenue'),
        consumability: getRiskLevel('consumability'),
        seasonality: getRiskLevel('seasonality'),
        recession: getRiskLevel('recession')
    };

    return `
        <div style="background: rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 28px; margin: 28px 0; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 class="section-title">🎯 Pre-LOI Investment Analysis</h3>
            
            <div class="deal-score">
                <div style="opacity: 0.8; margin-bottom: 8px; font-size: 0.95rem;">Investment Score</div>
                <div class="deal-score-number">${dealScore}</div>
                <div style="opacity: 0.7; font-size: 0.85rem;">out of 100</div>
            </div>

            <div class="analysis-grid">
                <div class="analysis-card">
                    <div class="analysis-title">💰 Cash Flow Analysis</div>
                    <div style="margin: 12px 0;">
                        <span class="risk-indicator ${getRiskClass(analyses.cashflow.level)}">
                            ${getRiskIcon(analyses.cashflow.level)} ${analyses.cashflow.level.toUpperCase()} RISK
                        </span>
                    </div>
                    <p style="opacity: 0.8; font-size: 0.9rem; line-height: 1.5;">
                        ${analyses.cashflow.reason}
                    </p>
                </div>

                <div class="analysis-card">
                    <div class="analysis-title">👥 Customer Concentration</div>
                    <div style="margin: 12px 0;">
                        <span class="risk-indicator ${getRiskClass(analyses.customer.level)}">
                            ${getRiskIcon(analyses.customer.level)} ${analyses.customer.level.toUpperCase()} RISK
                        </span>
                    </div>
                    <p style="opacity: 0.8; font-size: 0.9rem; line-height: 1.5;">
                        ${analyses.customer.reason}
                    </p>
                </div>

                <div class="analysis-card">
                    <div class="analysis-title">🔄 Revenue Model</div>
                    <div style="margin: 12px 0;">
                        <span class="risk-indicator ${getRiskClass(analyses.revenue.level)}">
                            ${getRiskIcon(analyses.revenue.level)} ${analyses.revenue.level.toUpperCase()} RISK
                        </span>
                    </div>
                    <p style="opacity: 0.8; font-size: 0.9rem; line-height: 1.5;">
                        ${analyses.revenue.reason}
                    </p>
                </div>

                <div class="analysis-card">
                    <div class="analysis-title">🛒 Consumability</div>
                    <div style="margin: 12px 0;">
                        <span class="risk-indicator ${getRiskClass(analyses.consumability.level)}">
                            ${getRiskIcon(analyses.consumability.level)} ${analyses.consumability.level.toUpperCase()} RISK
                        </span>
                    </div>
                    <p style="opacity: 0.8; font-size: 0.9rem; line-height: 1.5;">
                        ${analyses.consumability.reason}
                    </p>
                </div>

                <div class="analysis-card">
                    <div class="analysis-title">📊 Seasonality</div>
                    <div style="margin: 12px 0;">
                        <span class="risk-indicator ${getRiskClass(analyses.seasonality.level)}">
                            ${getRiskIcon(analyses.seasonality.level)} ${analyses.seasonality.level.toUpperCase()} RISK
                        </span>
                    </div>
                    <p style="opacity: 0.8; font-size: 0.9rem; line-height: 1.5;">
                        ${analyses.seasonality.reason}
                    </p>
                </div>

                <div class="analysis-card">
                    <div class="analysis-title">🛡️ Recession Resistance</div>
                    <div style="margin: 12px 0;">
                        <span class="risk-indicator ${getRiskClass(analyses.recession.level)}">
                            ${getRiskIcon(analyses.recession.level)} ${analyses.recession.level.toUpperCase()} RISK
                        </span>
                    </div>
                    <p style="opacity: 0.8; font-size: 0.9rem; line-height: 1.5;">
                        ${analyses.recession.reason}
                    </p>
                </div>
            </div>
        </div>
    `;
}

// AI document analysis
async function analyzeDocumentWithAI(documentText, companyData = null) {
    const apiStatus = areAPIKeysConfigured();
    if (!apiStatus.gemini) {
        throw new Error('Gemini API key not configured for document analysis');
    }

    const basePrompt = `You are a financial analyst. Analyze the following document and provide insights focusing on:

1. Cash Flow Analysis - Profitability indicators and financial health
2. Customer Concentration - Key customer dependencies and risks
3. Revenue Model - Recurring vs one-time revenue patterns
4. Consumability - Purchase frequency and customer behavior
5. Seasonality - Quarterly variations and timing
6. Recession Resistance - Economic sensitivity

Document Content:
${documentText.substring(0, MAX_DOCUMENT_LENGTH)}

Provide specific, actionable insights in a structured format.`;

    const companyPrompt = companyData ? 
        `Company: ${companyData.name} (${companyData.symbol || 'Private'})
        Context: ${companyData.overview}
        
        ${basePrompt}` : basePrompt;

    try {
        const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: companyPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.8,
                    maxOutputTokens: 1500,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`Gemini API Error: ${data.error.message}`);
        }

        const analysis = data.candidates[0].content.parts[0].text;
        if (DEBUG_MODE) console.log('📄 Document analysis completed');
        return analysis;
        
    } catch (error) {
        console.error('📄 Document analysis failed:', error);
        throw error;
    }
}

// Process uploaded files for analysis
async function processUploadedFiles() {
    if (uploadedFiles.length === 0) return null;

    let combinedText = '';
    
    for (const file of uploadedFiles) {
        try {
            const text = await extractTextFromFile(file);
            combinedText += `\n\n--- ${file.name} ---\n${text}`;
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            combinedText += `\n\n--- ${file.name} ---\nError: Could not extract text from this file.`;
        }
    }

    if (DEBUG_MODE) console.log('📄 Processed', uploadedFiles.length, 'files');
    return combinedText;
}

// Extract text from files
async function extractTextFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            resolve(event.target.result);
        };
        
        reader.onerror = function(error) {
            reject(error);
        };

        if (file.type === 'application/pdf') {
            // For PDFs, we'd need a PDF parsing library like PDF.js
            // For now, we'll indicate it's a PDF that needs processing
            resolve(`[PDF FILE: ${file.name}]\n\nNote: PDF text extraction requires additional setup. In production, this would extract the full PDF content using PDF.js library.\n\nTo enable PDF parsing:\n1. Include PDF.js library\n2. Parse PDF content\n3. Extract text for AI analysis`);
        } else if (file.type.includes('text') || file.name.endsWith('.txt')) {
            // Handle text files
            reader.readAsText(file);
        } else {
            // For other file types, provide guidance
            resolve(`[${file.type.toUpperCase()} FILE: ${file.name}]\n\nNote: This file type requires specific parsing. In production, this would be processed according to its format.`);
        }
    });
}

// Document-only analysis function
async function analyzeDocumentOnly() {
    if (uploadedFiles.length === 0) {
        alert('Please upload documents first');
        return;
    }

    const results = document.getElementById('results');
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');

    results.style.display = 'block';
    loading.style.display = 'block';
    content.innerHTML = '';

    try {
        const documentText = await processUploadedFiles();
        const analysis = await analyzeDocumentWithAI(documentText);
        
        loading.style.display = 'none';
        displayDocumentAnalysis(analysis);
        
    } catch (error) {
        loading.style.display = 'none';
        displayError(`Document analysis failed: ${error.message}`);
    }
}

// Display document analysis results
function displayDocumentAnalysis(analysis) {
    const content = document.getElementById('content');
    
    content.innerHTML = `
        <div class="company-card">
            <div class="company-header">
                <div>
                    <div class="company-name">Document Analysis</div>
                    <div style="margin-top: 10px; font-size: 1.5rem; opacity: 0.7;">AI-Powered Investment Analysis</div>
                </div>
                <div class="company-ticker">DOCS</div>
            </div>

            <div style="background: rgba(34, 197, 94, 0.1); border-radius: 16px; padding: 30px; margin: 30px 0; border: 1px solid rgba(34, 197, 94, 0.3);">
                <h3 style="color: #4ade80; margin-bottom: 20px;">🤖 AI Document Analysis Results</h3>
                <div style="color: #bbf7d0;">
                    <p style="margin-bottom: 20px;"><strong>Documents Analyzed:</strong> ${uploadedFiles.map(f => f.name).join(', ')}</p>
                    <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 24px; margin-top: 20px;">
                        <h4 style="margin-bottom: 15px; color: #4ade80;">Analysis Results:</h4>
                        <div style="white-space: pre-wrap; line-height: 1.7; font-size: 0.95rem; color: #d1fae5;">
                            ${analysis}
                        </div>
                    </div>
                    <p style="margin-top: 20px; font-size: 0.8rem; opacity: 0.7; text-align: center;">
                        Powered by Google Gemini 2.5 Flash
                    </p>
                </div>
            </div>

            <div style="background: rgba(99, 102, 241, 0.1); border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid rgba(99, 102, 241, 0.3);">
                <h3 style="color: #a5b4fc; margin-bottom: 15px;">💡 Next Steps</h3>
                <p style="color: #c7d2fe; opacity: 0.9; line-height: 1.6;">
                    For more comprehensive analysis, try searching for the company name to combine this document analysis 
                    with real-time financial data and market information.
                </p>
            </div>
        </div>
    `;
}

// Generate document analysis section for company analysis
async function generateDocumentAnalysis(companyData) {
    if (uploadedFiles.length === 0) return '';

    try {
        const documentText = await processUploadedFiles();
        const analysis = await analyzeDocumentWithAI(documentText, companyData);
        
        return `
            <div style="background: rgba(34, 197, 94, 0.1); border-radius: 16px; padding: 30px; margin-top: 30px; border: 1px solid rgba(34, 197, 94, 0.3);">
                <h3 style="color: #4ade80; margin-bottom: 20px;">🤖 AI Document Analysis</h3>
                <div style="color: #bbf7d0;">
                    <p style="margin-bottom: 15px;"><strong>Documents Analyzed:</strong> ${uploadedFiles.map(f => f.name).join(', ')}</p>
                    <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px; margin-top: 20px;">
                        <h4 style="margin-bottom: 15px; color: #4ade80;">Key Insights:</h4>
                        <div style="white-space: pre-wrap; line-height: 1.6; font-size: 0.9rem; color: #d1fae5;">
                            ${analysis}
                        </div>
                    </div>
                    <p style="margin-top: 15px; font-size: 0.8rem; opacity: 0.7; text-align: center;">
                        Powered by Google Gemini 2.5 Flash
                    </p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Document analysis failed:', error);
        return `
            <div style="background: rgba(251, 191, 36, 0.1); border-radius: 16px; padding: 20px; margin-top: 20px; border: 1px solid rgba(251, 191, 36, 0.3);">
                <h3 style="color: #fbbf24; margin-bottom: 10px;">📄 Document Analysis</h3>
                <p style="color: #fcd34d;">Document analysis failed: ${error.message}</p>
            </div>
        `;
    }
}
