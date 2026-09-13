require('dotenv').config();
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenAI } = require('@google/genai');

async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Unsupported file type');
}

async function runResumeAnalysis(buffer, mimetype) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from backend/.env');
  }

  const ai = new GoogleGenAI({ apiKey });

  const resumeText = await extractText(buffer, mimetype);
  if (!resumeText || !resumeText.trim()) {
    throw new Error('Could not extract text from document');
  }

  const prompt = `
You are an expert technical recruiter and resume reviewer.
Analyze the following resume and return a strict JSON object (no markdown formatting, no code fences, only valid JSON).

The JSON must follow this exact structure:
{
  "score": 85,
  "feedback": {
    "summary": "Clear summary of the candidate resume.",
    "strengths": ["Strength 1", "Strength 2", "Strength 3"],
    "improvements": ["Area 1", "Area 2", "Area 3"],
    "missingSkills": ["Skill 1", "Skill 2"]
  }
}

Resume text:
${resumeText}
`;

  // Try candidate models in order if one experiences high demand (503)
  const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-3.6-flash'];
  let response = null;
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      if (response && response.text) break;
    } catch (err) {
      console.warn(`Model ${modelName} unavailable (${err.message}). Trying fallback...`);
      lastError = err;
      // Brief pause before fallback attempt
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (!response || !response.text) {
    throw lastError || new Error('All AI model tiers are temporarily busy.');
  }

  const rawText = response.text.trim();
  const parsed = JSON.parse(rawText);

  return {
    score: parsed.score || 75,
    feedback: parsed.feedback || parsed,
  };
}

module.exports = { runResumeAnalysis };