import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/api/chat', async (req, res) => {
  try {
    const modelToUse = req.body.model || 'deepseek';
    const userMessage = req.body.message;
    console.log(`Using ${modelToUse} model for chat request`);

    // Detect if message is in Norwegian (simple check for Norwegian characters)
    const isNorwegian = /[æøåÆØÅ]/.test(userMessage) || 
                        userMessage.toLowerCase().includes('jeg') ||
                        userMessage.toLowerCase().includes('ikke');

    const languageInstruction = isNorwegian ? 
      'Svar alltid på norsk. ' : 
      '';

    if (modelToUse.startsWith('gemini')) {
      const systemPrefix = `${languageInstruction}You are a helpful assistant who is really nerdy. Always include a super nerdy reference in your responses and start with a greeting to EUCperson.\n\n`;
      const userPrompt = `${userMessage}`;
      const response = await callGeminiAPI(systemPrefix + userPrompt, modelToUse);
      res.json({ response });
      return;
    }

    // Original DeepSeek logic
    const messages = [
      {
        role: 'system',
        content: `${languageInstruction}You are a helpful assistant who is really nerdy. Always include a super nerdy reference in your responses and start with a greeting to EUCperson.`
      },
      {
        role: 'user',
        content: `${userMessage}`
      }
    ];

    // Log the payload before sending the request
    console.log('Payload messages:', messages);

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: messages,
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Log full response details for debugging
    console.log('Full API response status:', response.status);
    console.log('Full API response headers:', response.headers);
    console.log('Full API response data:', JSON.stringify(response.data, null, 2));
    console.log('Full API response data:', JSON.stringify(response.data.choices[0].message.content, null, 2));

    if (response.data && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
      res.json({ response: response.data.choices[0].message.content });
    } else {
      console.error('Unexpected API response format:', JSON.stringify(response.data, null, 2));
      res.status(500).json({ error: 'Unexpected API response format from DeepSeek' });
    }
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    if (error.response && error.response.data) {
      console.error('DeepSeek API error response:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json({ error: 'Failed to get response from DeepSeek' });
  }
});

async function callGeminiAPI(prompt, modelVersion) {
  console.log(`Using ${modelVersion} for chat request`);
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelVersion });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini response:', text);
    
    return text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});