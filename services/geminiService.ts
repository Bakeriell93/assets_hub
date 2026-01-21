
import { GoogleGenAI } from "@google/genai";
import { CarModel, Market, Platform } from "../types";

export const geminiService = {
  generateMarketingCopy: async (
    carModel: CarModel,
    market: Market,
    platform: Platform,
    tone: string,
    keyPoints: string
  ): Promise<string> => {
    // Initialize Gemini Client right before making the API call to ensure it uses the correct context.
    // Always use the named parameter `apiKey` and pass `process.env.API_KEY` directly.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
      Act as a world-class automotive marketing copywriter.
      
      Task: Write a creative and engaging ad copy for the following specification:
      - Car Model: ${carModel}
      - Target Market: ${market} (Write in the language appropriate for this country, but if it's multiple (like CH), use English or provide options. Actually, for this demo, provide the copy in English followed by a translation in the local language of the market if applicable).
      - Platform: ${platform} (Optimize the length and style for this platform).
      - Tone: ${tone}
      - Key Selling Points to include: ${keyPoints}

      Output format:
      Return ONLY the ad copy text. Do not include introductory phrases like "Here is the copy".
      If the platform is 'Meta' or 'Video', suggest a visual direction in brackets [] at the start.
    `;

    try {
      // Use ai.models.generateContent to query the model with the prompt.
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      // The response.text is a property that directly returns the string output.
      return response.text || "Failed to generate content.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
};
