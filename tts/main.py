import os
import io
import torch
import numpy
import hashlib
import soundfile as sf
from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import requests

# from TTS.api import TTS
from kokoro_ import synthetize

load_dotenv()

MAIN_PORT = int(os.environ.get("PORT_SERVER", "8000"))
PORT = int(os.environ.get("TTS_SERVER", "8080"))
MAIN_HOSTNAME = os.environ.get("MAIN_HOSTNAME") or "127.0.0.1"

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using {device} device.")

model_name = "tts_models/en/ljspeech/vits"

# tts = TTS(model_name).to(device)
# sample_rate = int(tts.synthesizer.output_sample_rate)
sample_rate = 24000

# tts.tts("This is a test.")
synthetize("This is a test.")
print("Test audio generated.")

app = Flask(__name__)


def notify_main_server():
    try:
        requests.post(
            f"http://{MAIN_HOSTNAME}:{MAIN_PORT}/tts-notice",
            data={"Status": "TTS server online"},
            timeout=1000,
        )
    except Exception as e:
        print(f"Error passing notice: {e}")


notify_main_server()


@app.route("/", methods=["POST", "GET"])
def process_tts():
    if request.method == "GET":
        text = request.args.get("text")
    else:
        text = request.data.decode("utf-8")

    if not text:
        return jsonify({"error": "Text is empty"}), 400

    try:
        print(f"\033[96m Received text: {text}\033[00m")

        # audio = numpy.array(tts.tts(text))
        audio = synthetize(text)
        wav = io.BytesIO()
        sf.write(
            wav,
            audio,
            samplerate=sample_rate,
            format="wav",
        )
        wav.seek(0)
        return send_file(wav, mimetype="audio/wav"), 200
    except Exception as e:
        print(f"\033[95mError processing TTS: {e}\033[00m")
        return jsonify({"error": str(e)}), 500


@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "message": "TTS server is running"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=False, port=PORT)
