import {StandardWordDefinition} from "../../types/dictionary.types";
import {VocabularyComProvider} from "./providers/vocabularyCom.provider";
import {FreeDictionaryProvider} from "./providers/freeDictionary.provider";

const vocabComProvider = new VocabularyComProvider();
const freeDictProvider = new FreeDictionaryProvider();

function chunkArray<T> (array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i<array.length; i += size){
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export async function lookupWord (word: string): Promise<StandardWordDefinition> {
    const cleanWord = word.trim().toLowerCase();
    const [vocabComResult, freeDictResult] = await Promise.allSettled([
        vocabComProvider.lookup(cleanWord),
        freeDictProvider.lookup(cleanWord),
    ]);
    const vocabData = vocabComResult.status === "fulfilled" ? vocabComResult.value : null;
    const freeData = freeDictResult.status === "fulfilled" ? freeDictResult.value : null;
    const meaning = vocabData?.meaning || freeData?.meaning || "No definition found";
    const found = !!(vocabData?.found || freeData?.found);
    return {
        word: cleanWord,
        meaning,
        pronunciation: freeData?.pronunciation || "",
        partOfSpeech: freeData?.partOfSpeech || "",
        examples: freeData?.examples || [],
        audioUrl: freeData?.audioUrl || "",
        found,
        provider: vocabData?.found ? "vocabulary_com" : (freeData?.found ? "free_dictionary" : "none"),
    }
}

export async function batchLookupWords (words: string[]): Promise<StandardWordDefinition[]> {
    const safeWords = Array.from(new Set(words.map((w) => w.trim().toLowerCase()))).slice(0,20);
    const chunks = chunkArray(safeWords, 5);
    const results: StandardWordDefinition[] = [];
    for (const chunk of chunks){
        const chunkResults = await Promise.all(chunk.map((w) => lookupWord(w)));
        results.push(...chunkResults);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return results;
}