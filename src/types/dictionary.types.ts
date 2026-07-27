export interface StandardWordDefinition {
    word: string;
    meaning: string;
    descriptionEN?: string;
    pronunciation?: string;
    partOfSpeech?: string;
    examples: string[];
    audioUrl?: string;
    found: boolean;
    provider: string;
}

export interface IDictionaryProvider{
    name: string;
    lookup(word: string): Promise<StandardWordDefinition|null>;
}