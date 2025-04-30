type TextToSpeechConfig = {
  retries?: number;
  retryDelay?: number;
}

export default class TextToSpeechUse {
  private url: string;
  retries: number;
  retryDelay: number;
  // Work on abort
  constructor(urlTTS: string, config?: TextToSpeechConfig) {
    this.url = urlTTS;
    this.retries = config?.retries || 5;
    this.retryDelay = config?.retryDelay || 800;
  }

  async getAudio(text: string) {
    let attempt = 0;
    while (attempt < this.retries) {
      try {
        const res = await fetch(`${this.url}/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: text,
        });
        if (!res.ok) throw new Error(`HTTP Error -${res.status}-: ${res.statusText}`);
        return await res.arrayBuffer();
      } catch (error) {
        if (error instanceof Error && ["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED"].includes(error.name.toUpperCase())) throw new Error('TTS service not available');
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
      attempt++;
    }

    throw new Error('Failed after multiple attempts');
  }
}
