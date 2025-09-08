// The directive tells the Next.js runtime that it should be run on the server.
'use server';

/**
 * @fileOverview Voice expense recording AI agent.
 *
 * - recordExpense - A function that handles the voice expense recording process.
 * - RecordExpenseInput - The input type for the recordExpense function.
 * - RecordExpenseOutput - The return type for the recordExpense function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecordExpenseInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio recording of the expense, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type RecordExpenseInput = z.infer<typeof RecordExpenseInputSchema>;

const RecordExpenseOutputSchema = z.object({
  amount: z.number().optional().describe('The amount of the expense.'),
  currency: z.string().optional().describe('The currency of the expense.'),
  method: z.string().optional().describe('The method of payment (e.g., credit card, cash).'),
  source: z.string().optional().describe('The source of the expense (e.g., restaurant name, store name).'),
  date: z.string().optional().describe('The date of the expense (ISO format).'),
  rawText: z.string().describe('The raw text transcribed from the audio.'),
});
export type RecordExpenseOutput = z.infer<typeof RecordExpenseOutputSchema>;

export async function recordExpense(input: RecordExpenseInput): Promise<RecordExpenseOutput> {
  return recordExpenseFlow(input);
}

const transcribePrompt = ai.definePrompt({
  name: 'transcribeExpensePrompt',
  input: {schema: z.object({
    audio: z.string().describe('The audio data URI.')
  })},
  output: {schema: z.string()},
  prompt: `Transcribe this audio recording of an expense.
  
  Audio: {{media url=audio}}`,
  model: 'googleai/gemini-2.5-flash',
  config: {
    responseModalities: ['TEXT'],
  },
});


const extractionPrompt = ai.definePrompt({
  name: 'extractExpensePrompt',
  input: {schema: z.object({rawText: z.string()})},
  output: {schema: RecordExpenseOutputSchema},
  prompt: `You are an AI assistant specialized in extracting expense details from a transcribed text.

  Analyze the transcribed text to identify the amount, currency, payment method, source, and date of the expense. 
  - If the currency is not specified, assume it's USD.
  - If the date is not specified, assume it is today's date.
  - If any other information cannot be determined, leave the corresponding output field empty.
  - Set the rawText field to the original transcribed text.

  Today's Date: ${new Date().toDateString()}

  Transcribed Text: {{{rawText}}}
  `,
});

const recordExpenseFlow = ai.defineFlow(
  {
    name: 'recordExpenseFlow',
    inputSchema: RecordExpenseInputSchema,
    outputSchema: RecordExpenseOutputSchema,
  },
  async input => {
    // Convert audio to text using a TTS model.
    const transcribedText = await transcribePrompt({audio: input.audioDataUri});

    const {output} = await extractionPrompt({
      rawText: transcribedText,
    });
    
    // Ensure rawText is passed through.
    if(output) {
        output.rawText = transcribedText;
    }
    
    return output!;
  }
);
