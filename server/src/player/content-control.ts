import textProcessor from "../text-processor";
import { TextProcessorResult } from "@common/types";

export class ContentControl {
    private raw: string[]
    private content: TextProcessorResult
    private index: number
    ended: boolean
    constructor(content: string[], index: number = 0) {
        this.raw = content;
        this.content = textProcessor(content);
        this.index = index;
    }

    /**
     * Go to the next readable sentence.
     * If there is no next readable sentence, returns true.
     */
    next(): boolean {
        if (this.index + 1 >= this.content.server.length) return true;
        do {
            this.index++;
            if (this.index >= this.content.server.length) return true;
        } while (!this.content.server[this.index].isReadable)
        return false;
    }

    /**
     * Go to the previous readable sentence.
     * If there is no next readable sentence, returns true.
     */
    previous(): boolean {
        if (this.index - 1 < 0) return true;
        do {
            this.index--;
            if (this.index < 0) return true;
        } while (!this.content.server[this.index]?.isReadable)
        return false;
    }

    seek(index: number): boolean {
        this.index = index;
        if (this.index < 0 || this.index >= this.content.server.length) return true;
        while (!this.content.server[this.index].isReadable) {
            this.index++;
            if (this.index >= this.content.server.length) return true;
        }
        return false;
    }

    setToLastSentence() {
        this.index = this.content.server.length - 1;
        while (!this.content.server[this.index].isReadable) {
            this.index--;
            if (this.index < 0) return;
        }
    }

    get currentSentence() {
        return this.content.server[this.index];
    }

    get currentIndex() {
        return this.index;
    }

    get serverContent() {
        return this.content.server;
    }

    get clientContent() {
        return this.content.client;
    }

    get rawContent() {
        return this.raw;
    }
}