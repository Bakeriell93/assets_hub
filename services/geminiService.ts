
import { GoogleGenAI } from "@google/genai";
import { Asset, Collection, SystemConfig } from "../types";

interface ContextInfo {
  currentView?: 'repository' | 'analytics' | 'collections';
  selectedMarket?: string;
  selectedModel?: string;
  selectedPlatform?: string;
}

export const geminiService = {
  generateInsights: async (
    assets: Asset[],
    collections: Collection[],
    config: SystemConfig,
    context: ContextInfo
  ): Promise<string> => {
    // TEMP: Hardcode key for testing. Prefer env via Vite define when deploying.
    const apiKey =
      process.env.API_KEY ||
      process.env.GEMINI_API_KEY ||
      "AIzaSyCJ6NU2zP_2UFKFxMKg4Xs79OiLCBfjE6U";
    const ai = new GoogleGenAI({ apiKey });

    // Calculate key metrics
    const totalAssets = assets.length;
    const avgCtr = assets.length > 0 
      ? assets.reduce((sum, a) => sum + (a.ctr || 0), 0) / assets.length 
      : 0;
    const avgCr = assets.length > 0
      ? assets.reduce((sum, a) => sum + (a.cr || 0), 0) / assets.length
      : 0;
    const topPerformer = assets.length > 0 
      ? assets.reduce((best, a) => 
          (a.ctr || 0) > (best.ctr || 0) ? a : best, assets[0]
        )
      : null;

    const marketDistribution = config.markets.map(m => ({
      market: m,
      count: assets.filter(a => a.market === m).length
    }));

    const platformDistribution = config.platforms.map(p => ({
      platform: p,
      count: assets.filter(a => a.platform === p).length
    }));

    const prompt = `You are an AI marketing analyst for BYD Assets Hub. Analyze the following data and provide concise, actionable insights.

Current Context:
- View: ${context.currentView || 'repository'}
- Selected Market: ${context.selectedMarket || 'All'}
- Selected Model: ${context.selectedModel || 'All'}
- Selected Platform: ${context.selectedPlatform || 'All'}

Asset Statistics:
- Total Assets: ${totalAssets}
- Average CTR: ${avgCtr.toFixed(2)}%
- Average CR: ${avgCr.toFixed(2)}%
- Top Performer: ${topPerformer ? `${topPerformer.title} (CTR: ${topPerformer.ctr || 0}%)` : 'None'}

Market Distribution:
${marketDistribution.map(m => `- ${m.market}: ${m.count} assets`).join('\n')}

Platform Distribution:
${platformDistribution.map(p => `- ${p.platform}: ${p.count} assets`).join('\n')}

Collections: ${collections.length} active projects

Provide 3-4 key insights in a clear, professional format. Focus on:
1. Performance highlights
2. Content gaps or opportunities
3. Recommendations for optimization
4. Trends or patterns

Keep it concise (under 200 words) and actionable.`;

    try {
      const response = await ai.models.generateContent({
        // Use a model confirmed to work with @google/genai in this project.
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "Unable to generate insights at this time.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  },

  answerQuestion: async (
    question: string,
    assets: Asset[],
    collections: Collection[],
    config: SystemConfig,
    context: ContextInfo
  ): Promise<string> => {
    // TEMP: Hardcode key for testing. Prefer env via Vite define when deploying.
    const apiKey =
      process.env.API_KEY ||
      process.env.GEMINI_API_KEY ||
      "AIzaSyCJ6NU2zP_2UFKFxMKg4Xs79OiLCBfjE6U";
    const ai = new GoogleGenAI({ apiKey });

    // Build asset summary for context
    const assetSummary = assets.slice(0, 20).map(a => ({
      title: a.title,
      market: a.market,
      platform: a.platform,
      model: a.carModel,
      ctr: a.ctr,
      cr: a.cr,
      objectives: a.objectives,
    }));

    const prompt = `You are an AI assistant for BYD Assets Hub, a marketing asset management system. Answer the user's question based on the following data.

Current Context:
- View: ${context.currentView || 'repository'}
- Selected Market: ${context.selectedMarket || 'All'}
- Selected Model: ${context.selectedModel || 'All'}
- Selected Platform: ${context.selectedPlatform || 'All'}

Asset Database (${assets.length} total assets):
${JSON.stringify(assetSummary, null, 2)}

Collections: ${collections.length} active projects
${collections.map(c => `- ${c.name}: ${c.assetIds.length} assets`).join('\n')}

Available Markets: ${config.markets.join(', ')}
Available Models: ${config.models.join(', ')}
Available Platforms: ${config.platforms.join(', ')}

User Question: ${question}

Provide a helpful, accurate answer based on the data above. If the question requires data that isn't available, say so clearly. Be concise but thorough.`;

    try {
      const response = await ai.models.generateContent({
        // Use a model confirmed to work with @google/genai in this project.
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "I couldn't generate a response. Please try rephrasing your question.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
};
