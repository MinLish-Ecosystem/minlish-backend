import {Request, Response} from "express";
import {sendSuccess} from "../utils/response.util";
import {catchAsync} from "../utils/catchAsync";
import * as dictionaryService from "../services/dictionary/dictionary.service";

export const lookupWordController = catchAsync(async (req: Request, res: Response) =>{
    const word = (req.query.word as string)?.trim();
    if (!word) {
        return res.status(400).json({success: false, message: "Query param 'word' is required"});
    }
    const result = await dictionaryService.lookupWord(word);
    return sendSuccess(res, "Word lookup completed", result);
});

export const batchLookupController = catchAsync(async (req: Request, res: Response) => {
    const {words} = req.body;
    if (!Array.isArray(words) || words.length === 0){
        return res.status(400).json({success: false, message: "Body must contain a non-empty 'words' array"});
    }
    const results = await dictionaryService.batchLookupWords(words);
    return sendSuccess(res, "Batch lookup completed", results);
})