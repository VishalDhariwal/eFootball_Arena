import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export type PlayerStatSnapshot = {
  goals: number;
  possession: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  passes_completed: number;
  tackles: number;
  fouls: number;
  interceptions: number;
  saves: number;
  corners: number;
  offsides: number;
  free_kicks: number;
  crosses: number;
};

export type ExtractedMatchStats = {
  player1Stats: PlayerStatSnapshot;
  player2Stats: PlayerStatSnapshot;
};

export const defaultPlayerStats = (): PlayerStatSnapshot => ({
  goals: 0,
  possession: 0,
  shots: 0,
  shots_on_target: 0,
  passes: 0,
  passes_completed: 0,
  tackles: 0,
  fouls: 0,
  interceptions: 0,
  saves: 0,
  corners: 0,
  offsides: 0,
  free_kicks: 0,
  crosses: 0,
});

export const extractStatsFromImage = async (file: File): Promise<ExtractedMatchStats> => {
  if (!ai) {
    throw new Error("VITE_GEMINI_API_KEY is not set in your .env file!");
  }

  // Convert File to Base64
  const base64Image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const prompt = `
  You are an expert sports data analyst. Analyze this eFootball/FIFA match stats screenshot.
  Extract the stats for the LEFT team (player1) and the RIGHT team (player2).
  Return ONLY a valid JSON object matching this exact schema (use 0 for any field not visible):
  {
    "player1Stats": {
      "goals": number,
      "possession": number (percentage without the % sign),
      "shots": number,
      "shots_on_target": number,
      "passes": number,
      "passes_completed": number (labeled "Successful Passes"),
      "tackles": number,
      "fouls": number,
      "interceptions": number,
      "saves": number,
      "corners": number (labeled "Corner Kicks"),
      "offsides": number (labeled "Offsides"),
      "free_kicks": number (labeled "Free Kicks"),
      "crosses": number (labeled "Crosses")
    },
    "player2Stats": {
      "goals": number,
      "possession": number,
      "shots": number,
      "shots_on_target": number,
      "passes": number,
      "passes_completed": number,
      "tackles": number,
      "fouls": number,
      "interceptions": number,
      "saves": number,
      "corners": number,
      "offsides": number,
      "free_kicks": number,
      "crosses": number
    }
  }
  Do not include markdown blocks or any other text. Just the raw JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Image
          }
        }
      ]
    });

    let text = response.text || "";
    // Clean up potential markdown formatting
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text) as ExtractedMatchStats;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(`Failed to extract stats: ${error.message || "Unknown error"}. Please check your API key and console logs.`);
  }
};