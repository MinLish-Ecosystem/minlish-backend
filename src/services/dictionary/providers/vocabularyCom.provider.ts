import { IDictionaryProvider, StandardWordDefinition } from "../../../types/dictionary.types";

export class VocabularyComProvider implements IDictionaryProvider {
    name = "vocabulary_com";
    private baseUrl = "https://vocabulary.vercel.app/word";
    async lookup(word: string): Promise<StandardWordDefinition | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        try{
            const cleanWord = word.trim().toLowerCase();
            const response = await fetch(
                `${this.baseUrl}/${encodeURIComponent(cleanWord)}`,
                {signal: controller.signal}
            );
            clearTimeout(timeoutId);
            if (!response.ok) return null;
            const resData = await response.json();
            if (!resData?.success || !resData?.data) return null;
            const definitionText = String(resData.data).trim();
            if (!definitionText) return null;
            return {
                word: cleanWord,
                meaning: definitionText,
                examples: [],
                found: true,
                provider: this.name,
            };
        } catch{
            clearTimeout(timeoutId);
            return null;
        }
    }
}