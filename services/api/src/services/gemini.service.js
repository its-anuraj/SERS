/**
 * Gemini LLM Triage Service
 * Integrates Google Gemini 1.5 Flash API for natural language incident triage,
 * emergency audio transcript analysis, and first-aid responder guidance.
 */

const logger = require('../config/logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Analyze emergency incident text & generate structured AI triage report
 */
const analyzeIncidentTriage = async (description, emergencyType = 'accident') => {
    if (!GEMINI_API_KEY) {
        logger.warn('GEMINI_API_KEY not configured — returning simulated LLM triage');
        return {
            triageLevel: emergencyType === 'cardiac' ? 'CRITICAL_TRAUMA' : 'HIGH_PRIORITY',
            recommendedSpecialist: emergencyType === 'cardiac' ? 'Cardiologist' : 'Trauma Surgeon',
            firstAidInstructions: [
                'Keep victim immobile and check breathing.',
                'Apply direct pressure to bleeding wounds using clean cloth.',
                'Do not give liquid/food to unconscious patient.'
            ],
            aiSummary: `AI Triage: High probability ${emergencyType} emergency based on reporter intake.`,
            confidence: 0.92,
            source: 'gemini_fallback'
        };
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const promptText = `
You are an expert emergency medical dispatch AI for Indian Smart Emergency Response System (SERS).
Analyze this emergency report and return JSON only:
Description: "${description}"
Emergency Type: "${emergencyType}"

Return strictly valid JSON in this format:
{
  "triageLevel": "CRITICAL_TRAUMA" | "HIGH_PRIORITY" | "STANDARD",
  "recommendedSpecialist": "string",
  "firstAidInstructions": ["instruction 1", "instruction 2"],
  "aiSummary": "1-sentence summary",
  "confidence": 0.0-1.0
}
`;

        const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Parse JSON output from Gemini response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return { ...parsed, source: 'gemini_1.5_flash' };
        }

        return {
            triageLevel: 'HIGH_PRIORITY',
            recommendedSpecialist: 'Emergency Physician',
            firstAidInstructions: ['Ensure scene safety.', 'Keep patient warm and still.'],
            aiSummary: responseText.slice(0, 150),
            confidence: 0.85,
            source: 'gemini_text_raw'
        };

    } catch (error) {
        logger.error('Gemini LLM triage failed', { error: error.message });
        return {
            triageLevel: 'HIGH_PRIORITY',
            recommendedSpecialist: 'Trauma Specialist',
            firstAidInstructions: ['Keep patient safe until ambulance arrives.'],
            aiSummary: 'Fallback AI Triage active.',
            confidence: 0.80,
            source: 'error_fallback'
        };
    }
};

module.exports = { analyzeIncidentTriage };
