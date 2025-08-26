// API Configuration
// Replace these with your actual API keys

const ALPHA_VANTAGE_API_KEY = 'YOUR_ALPHA_VANTAGE_KEY_HERE';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

// API Endpoints
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Cache settings
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// App settings
const MAX_UPLOADED_FILES = 2;
const MAX_DOCUMENT_LENGTH = 10000; // Characters to send to AI

// Debug mode - set to false in production
const DEBUG_MODE = true;

// Helper function to check if API keys are configured
function areAPIKeysConfigured() {
    const alphaVantageConfigured = ALPHA_VANTAGE_API_KEY !== 'YXCFY2BGHI1QUIOS';
    const geminiConfigured = GEMINI_API_KEY !== 'AIzaSyBgSU2MlIkqyNmimexiPc2faQNhRGwWnYE';
    
    return {
        alphaVantage: alphaVantageConfigured,
        gemini: geminiConfigured,
        both: alphaVantageConfigured && geminiConfigured
    };
}

// Log configuration status
if (DEBUG_MODE) {
    const apiStatus = areAPIKeysConfigured();
    console.log('🔑 API Configuration Status:');
    console.log('Alpha Vantage:', apiStatus.alphaVantage ? '✅ Configured' : '❌ Not configured');
    console.log('Gemini:', apiStatus.gemini ? '✅ Configured' : '❌ Not configured');
    
    if (!apiStatus.both) {
        console.warn('⚠️ Some API keys are not configured. Add your keys to config.js for full functionality.');
    }
}
