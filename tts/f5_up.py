import argparse
import logging
import tempfile
from flask import Flask, request, send_file
import threading
import io
import queue

from f5_tts.api import F5TTS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Queue to manage available TTS instances
tts_queue = queue.Queue(maxsize=2)
processing_locks = [threading.Lock() for _ in range(2)]

app = Flask(__name__)


def initialize_tts_instances(model, ckpt_file, vocab_file, ref_audio, ref_text):
    # Create two TTS instances
    for i in range(2):
        f5tts = F5TTS(model=model, ckpt_file=ckpt_file, vocab_file=vocab_file)
        f5tts.ref_file = ref_audio
        f5tts.ref_text = ref_text
        tts_queue.put((f5tts, processing_locks[i]))


def process_tts_request(text, f5tts, lock):
    with lock:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_file:
            # Generate speech
            wav, sr, _ = f5tts.infer(
                ref_file=f5tts.ref_file,
                ref_text=f5tts.ref_text,
                gen_text=text,
                file_wave=temp_file.name,
            )

            # Read the generated WAV file
            with open(temp_file.name, "rb") as f:
                return f.read()


@app.route("/tts", methods=["POST"])
def text_to_speech():
    if not request.data:
        return {"error": "Empty request body"}, 400

    try:
        # Get text directly from request body
        text = request.data.decode("utf-8")

        # Get an available TTS instance
        try:
            f5tts, lock = tts_queue.get(
                timeout=30
            )  # Wait up to 30 seconds for an available instance
        except queue.Empty:
            return {"error": "Server is busy, please try again later"}, 503

        try:
            # Process request with the instance's lock
            wav_data = process_tts_request(text, f5tts, lock)

            # Create a BytesIO object to send the file
            wav_io = io.BytesIO(wav_data)
            wav_io.seek(0)

            return send_file(
                wav_io,
                mimetype="audio/wav",
                as_attachment=True,
                download_name="speech.wav",
            )
        finally:
            # Always return the instance to the queue
            tts_queue.put((f5tts, lock))

    except UnicodeDecodeError:
        return {"error": "Invalid text encoding"}, 400
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {"error": "Internal server error"}, 500


@app.route("/health", methods=["GET"])
def health_check():
    return {"status": "healthy"}


def run_server(host, port, model, ckpt_file, vocab_file, ref_audio, ref_text):
    # Initialize two TTS instances
    initialize_tts_instances(model, ckpt_file, vocab_file, ref_audio, ref_text)

    logger.info(f"Server started on {host}:{port}")
    app.run(host=host, port=port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--model", default="F5TTS_v1_Base")
    parser.add_argument("--ckpt_file", default="")
    parser.add_argument("--vocab_file", default="")
    parser.add_argument(
        "--ref_audio", default="/mnt/e/CoquiTTS/models/wav_voices/Magik.wav"
    )
    parser.add_argument(
        "--ref_text",
        default="I bring the demons, you bring the souls, right? Sounds like a party. I try to embrace what I've experienced. My strife has given me strength.",
    )

    args = parser.parse_args()
    run_server(
        args.host,
        args.port,
        args.model,
        args.ckpt_file,
        args.vocab_file,
        args.ref_audio,
        args.ref_text,
    )

# Initialize the server
# server = TTSServer(
#     ref_audio="/mnt/e/CoquiTTS/models/wav_voices/Magik.wav",
#     ref_text="I bring the demons, you bring the souls, right? Sounds like a party. I try to embrace what I've experienced. My strife has given me strength.",
# )
