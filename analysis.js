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
        
        // Return fallback data with error info
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
    
    // Determine risk levels based on available data
    const getRiskLevel = (category) => {
        switch (category) {
            case 'cashflow':
                if (!data.financials) return { level: 'medium', reason: 'Financial data not available for analysis' };
                const margin = parseFloat(data.financials.ebitdaMargin);
                if (margin > 15) return { level: 'low', reason: `Strong EBITDA margin of ${data.financials.ebitdaMargin}` };
                if (margin > 5) return { level: 'medium', reason: `Moderate EBITDA margin of ${data.financials.ebitdaMargin}` };
                return { level: 'high', reason: `Low EBITDA margin of ${data.financials.ebitdaMargin}` };
                
            case 'customer':
                // For demo - would need actual customer concentration data
                return { level: 'medium', reason: 'Customer concentration analysis requires detailed revenue breakdown data' };
                
            case 'revenue':
                if (data.isPublic && data.financials) {
                    return { level: 'low', reason: 'Public companies typically have established revenue models' };
                }
                return { level: 'medium', reason: 'Revenue model assessment requires additional data' };
                
            case 'consumability':
                // Industry-based assessment
                const industry = data.industry?.toLowerCase() || '';
                if (industry.includes('software') || industry.includes('saas')) {
                    return { level: 'low', reason: 'Software/SaaS models typically have high repeat usage' };
                }
                return { level: 'medium', reason: 'Consumability varies by industry and business model' };
                
            case 'seasonality':
                if (industry?.includes('retail') || industry?.includes('consumer')) {
                    return { level: 'medium', reason: 'Consumer-facing businesses often have seasonal patterns' };
                }
                return { level: 'low', reason: 'Limited seasonal exposure based on industry' };
                
            case 'recession':
                if (industry?.includes('technology') || industry?.includes('software')) {
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
        <div style="background: rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 28px; margin: 28px 0; border: 1px solid rgba(255, 255, 255
