import { IDictionaryProvider, StandardWordDefinition } from "../../../types/dictionary.types";
export class FreeDictionaryProvider implements IDictionaryProvider {
    name = "free_dictionary";
    private baseUrl = "https://api.dictionaryapi.dev/api/v2/entries/en";
    async lookup(word: string): Promise<StandardWordDefinition | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try{
            const cleanWord = word.trim().toLowerCase();
            const response = await fetch(
                `${this.baseUrl}/${encodeURIComponent(cleanWord)}`,
                {signal: controller.signal}
            );
            clearTimeout(timeoutId);
            if (!response.ok) return null;
            const data = await response.json();
            const entry = data?.[0];
            if (!entry) return null;

            const pronunciation = entry.phonetic || entry.phonetics?.find((p:any) => p.text)?.text || "";
            const audioUrl = entry.phonetics?.find((p: any) => p.audio?.length > 0)?.audio || "";
            let meaning = "";
            let partOfSpeech = "noun";
            const examples: string[] = [];
            if (entry.meanings?.[0]){
                partOfSpeech = entry.meanings[0].partOfSpeech || "noun";
                const defObj = entry.meanings[0].definitions?.[0];
                if (defObj){
                    meaning = defObj.definition || "";
                    if (defObj.example) examples.push(defObj.example);
                }
            }
            return {
                word: cleanWord,
                meaning,
                pronunciation,
                partOfSpeech,
                examples,
                audioUrl,
                found: true,
                provider: this.name,
            };
        } catch {
            clearTimeout(timeoutId);
            return null;
        }
    }
}