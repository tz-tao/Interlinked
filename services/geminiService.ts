import { GoogleGenAI, Type } from "@google/genai";
import { Contact, Suggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to sanitize payload
const getSlimContacts = (contacts: Contact[]) => contacts.map(c => {
    // Extract phone from notes if possible for better inference
    const phoneMatch = c.notes.match(/(?:Phone|Mobile|Cell):\s*([+\d\s-]+)/i);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';

    return {
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        role: c.role,
        industry: c.industry,
        phone: phone, // Critical for country code inference
        currentTags: c.tags
    };
});

// Chunk array into smaller batches
const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

// Sleep helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper for API calls
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = 3,
    baseDelay = 2000
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (error?.status === 429 || error?.code === 429 || error?.message?.includes('429'))) {
            console.warn(`Rate limit hit. Retrying in ${baseDelay}ms... (${retries} attempts left)`);
            await delay(baseDelay);
            return retryWithBackoff(fn, retries - 1, baseDelay * 2);
        }
        throw error;
    }
}

export const analyzeContactsForSuggestions = async (contacts: Contact[]): Promise<Suggestion[]> => {
    if (!process.env.API_KEY) {
        console.warn("No API Key provided for Gemini.");
        return [];
    }

    const model = "gemini-2.5-flash";
    const contactChunks = chunkArray(contacts, 5); // Process 5 contacts at a time to avoid token limits
    let allSuggestions: Suggestion[] = [];

    const prompt = `
    Analyze the following list of contacts. 
    Identify missing information that can be logically inferred from other contacts or the data itself.
    
    Specifically, try to INFER the 'industry' field if it is missing, based on the company name and role. 
    (e.g., 'Software Engineer' at 'Google' -> Industry: 'Technology').
    (e.g., 'Partner' at 'Sequoia' -> Industry: 'Venture Capital').
    
    Examples of other inferences:
    - If Person A works at "TechCorp" and Person B has email "@techcorp.com" but missing company, suggest "TechCorp".
    - If location is missing but area code in phone (if present) or company HQ is known, suggest location.
    
    Return a list of suggestions. strictly follow the JSON schema.
  `;

    try {
        // Process chunks sequentially to manage rate limits (could be parallelized with concurrency limit)
        for (const chunk of contactChunks) {
            const slimContacts = getSlimContacts(chunk);

            try {
                await retryWithBackoff(async () => {
                    const response = await ai.models.generateContent({
                        model,
                        contents: [
                            { text: prompt },
                            { text: JSON.stringify(slimContacts) }
                        ],
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        contactId: { type: Type.STRING },
                                        field: { type: Type.STRING, description: "The field key to update (e.g., company, role, location, industry)" },
                                        currentValue: { type: Type.STRING, description: "Current value (or empty string)" },
                                        suggestedValue: { type: Type.STRING, description: "The inferred value" },
                                        reason: { type: Type.STRING, description: "Why this suggestion is made" }
                                    },
                                    required: ["contactId", "field", "suggestedValue", "reason"]
                                }
                            }
                        }
                    });

                    if (response.text) {
                        const chunkSuggestions = JSON.parse(response.text) as Suggestion[];
                        allSuggestions = [...allSuggestions, ...chunkSuggestions];
                    }
                });

                // Add a small delay between successful chunks to be polite to the rate limiter
                await delay(1000);

            } catch (chunkError) {
                console.error("Error processing chunk:", chunkError);
                // Continue to next chunk even if one fails
            }
        }

        return allSuggestions;

    } catch (error) {
        console.error("Gemini analysis failed:", error);
        return [];
    }
};

export const generateAutoTags = async (contacts: Contact[]): Promise<Suggestion[]> => {
    if (!process.env.API_KEY) return [];

    const model = "gemini-2.5-flash";
    const contactChunks = chunkArray(contacts, 8); // Slightly larger chunks for tagging
    let allSuggestions: Suggestion[] = [];

    const prompt = `
        Analyze these contacts and suggest TAGS based on the following dimensions:
        1. Seniority Level (e.g. "Executive", "Founder", "VP", "Director", "Manager", "Entry")
        2. Department/Function (e.g. "Engineering", "Sales", "Marketing", "Product", "Design", "Legal", "Finance", "Investor")
        3. Industry Sector (e.g. "SaaS", "Fintech", "Healthcare", "E-commerce", "Deep Tech")
        
        Rules:
        - Only suggest tags if you are confident based on the Title, Company, or Notes.
        - Do not duplicate tags that already exist in 'currentTags'.
        - Return 'field' as 'tags'.
        - 'suggestedValue' must be an ARRAY of strings.
    `;

    try {
        for (const chunk of contactChunks) {
            const slimContacts = getSlimContacts(chunk);
            try {
                await retryWithBackoff(async () => {
                    const response = await ai.models.generateContent({
                        model,
                        contents: [
                            { text: prompt },
                            { text: JSON.stringify(slimContacts) }
                        ],
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        contactId: { type: Type.STRING },
                                        field: { type: Type.STRING, enum: ['tags'] },
                                        currentValue: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        suggestedValue: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        reason: { type: Type.STRING }
                                    },
                                    required: ["contactId", "field", "suggestedValue", "reason"]
                                }
                            }
                        }
                    });

                    if (response.text) {
                        const chunkSuggestions = JSON.parse(response.text) as Suggestion[];
                        allSuggestions = [...allSuggestions, ...chunkSuggestions];
                    }
                });

                // Add delay between chunks
                await delay(1000);

            } catch (chunkError) {
                console.error("Error processing tag chunk:", chunkError);
            }
        }
        return allSuggestions;
    } catch (e) {
        console.error("Auto-tagging failed", e);
        return [];
    }
};

export const queryContactsNaturalLanguage = async (query: string, contacts: Contact[]): Promise<string[]> => {
    if (!process.env.API_KEY) return [];

    const model = "gemini-2.5-flash";
    const slimContacts = getSlimContacts(contacts);

    const prompt = `
        You are a search engine for a CRM.
        User Query: "${query}"
        
        Return a JSON array of Contact IDs that match the query intent.
        Be smart about semantic matching (e.g. "investors" matches "Partner at VC", "Tag: Investor", or Industry: "Venture Capital").
     `;

    try {
        return await retryWithBackoff(async () => {
            const response = await ai.models.generateContent({
                model,
                contents: [
                    { text: prompt },
                    { text: JSON.stringify(slimContacts) }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            });

            if (response.text) {
                return JSON.parse(response.text) as string[];
            }
            return [];
        });
    } catch (e) {
        console.error(e);
        return [];
    }
}

export const categorizeContactsByDimension = async (contacts: Contact[], dimension: string): Promise<Record<string, string>> => {
    if (!process.env.API_KEY) return {};

    const model = "gemini-2.5-flash";
    const contactChunks = chunkArray(contacts, 10);
    const mapping: Record<string, string> = {};

    const prompt = `
        I want to group these contacts by a specific dimension/attribute: "${dimension}".
        
        For each contact, infer if they belong to this group or what their specific value is.
        Use Name (gender inference), Phone Country Code (location inference), Email Domain, Job Title, and Tags.

        LOGIC:
        1. If the dimension looks like a specific attribute (e.g. "Female", "Founder", "Investor"), perform a BINARY grouping.
           - If yes: Value = "${dimension}" (Title Case)
           - If no: Value = "Other"
        2. If the dimension is a category (e.g. "Industry", "Seniority"), return the specific value.

        Return a JSON object where keys are Contact IDs and values are the Category String.
        Use "Unknown" if absolutely unsure.
    `;

    try {
        for (const chunk of contactChunks) {
            const slimContacts = getSlimContacts(chunk);
            try {
                await retryWithBackoff(async () => {
                    console.log('Sending request to Gemini for dimension:', dimension);
                    const response = await ai.models.generateContent({
                        model,
                        contents: [
                            { text: prompt },
                            { text: JSON.stringify(slimContacts) }
                        ],
                        config: {
                            responseMimeType: "application/json"
                            // Note: Not using responseSchema here because we need a dynamic object
                            // with contact IDs as keys, which can't be predefined
                        }
                    });

                    console.log('Gemini response text:', response.text);
                    if (response.text) {
                        const chunkResult = JSON.parse(response.text);
                        console.log('Parsed chunk result:', chunkResult);
                        Object.assign(mapping, chunkResult);
                    }
                });

                await delay(1000);

            } catch (chunkError) {
                console.error("Error processing categorization chunk:", chunkError);
            }
        }
        console.log('Final mapping:', mapping);
        return mapping;
    } catch (e) {
        console.error("AI Categorization failed", e);
        return {};
    }
}