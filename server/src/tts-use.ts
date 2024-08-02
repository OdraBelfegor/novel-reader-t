export default class TextToSpeechUse {
  private url: string;
  // Work on abort
  constructor(urlTTS: string) {
    this.url = urlTTS;
  }

  async checkService() {
    try {
      await fetch(`${this.url}/ping`, { cache: 'no-cache' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async synthesize(text: string, retries: number = 5, delay: number = 800): Promise<ArrayBuffer> {
    try {
      const res = await fetch(`${this.url}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: text,
      });
      if (!res.ok) throw Error(res.statusText);
      return await res.arrayBuffer();
    } catch (error) {
      if (retries == 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.synthesize(text, retries - 1, delay);
    }
  }

  async getAudio(text: string) {
    if (!(await this.checkService())) throw new Error('TTS service not available');
    return this.synthesize(text);
  }
}
