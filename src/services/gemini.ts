import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Question {
  question: string;
  options: string[];
  answerIndex: number;
}

export async function generateQuizQuestions(topic: string): Promise<Question[]> {
  const model = ai.models.generateContent({
    model: "gemini-1.5-flash", // Using a stable model for generation
    contents: `Create a quiz with 10 multiple-choice questions about: ${topic}. 
    Return the result as a JSON array of objects. 
    Each object must have:
    - "question": string
    - "options": string array (exactly 4 options)
    - "answerIndex": number (0-3, index of the correct option)
    
    Ensure the questions are suitable for students.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { 
              type: Type.ARRAY,
              items: { type: Type.STRING },
              minItems: 4,
              maxItems: 4
            },
            answerIndex: { type: Type.INTEGER }
          },
          required: ["question", "options", "answerIndex"]
        }
      }
    }
  });

  const response = await model;
  try {
    const questions = JSON.parse(response.text || "[]");
    return questions;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
