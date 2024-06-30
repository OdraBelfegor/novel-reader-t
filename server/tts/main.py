import os
import io
import torch
import numpy as np
import hashlib
from TTS.api import TTS
import soundfile as sf
from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import requests

load_dotenv()

PORT = int(os.environ.get("TTS_SERVER", "5050"))
MAIN_PORT = int(os.environ.get("PORT_SERVER", "5000"))
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/app/results/")

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using {device} device.")
model_name = "tts_models/en/ljspeech/vits"
tts = TTS(model_name).to(device)
sample_rate = int(tts.synthesizer.output_sample_rate)
tts.tts("This is a test.")

app = Flask(__name__)
try:
    requests.post(
        f"http://localhost:{PORT}/tts-notice", data={"Status": "TTS server online"}
    )
except Exception:
    print("Error passing notice")
    pass


def get_short_hash(text):
    sha256_hash = hashlib.sha256()
    sha256_hash.update(text.encode("utf-8"))
    hash_hex = sha256_hash.hexdigest()
    return hash_hex[:8]


@app.route("/tts", methods=["POST", "GET"])
def process_tts():
    if request.method not in ["POST", "GET"]:
        return jsonify({"error": "Method not allowed"}), 405

    if request.method == "GET":
        text = request.args.get("text")
    else:
        text = request.data.decode("utf-8")

    if not text:
        return jsonify({"error": "Text is empty"}), 400

    try:
        audio = tts.tts(text)
        audio = np.array(audio)
        wav = io.BytesIO()
        sf.write(wav, audio, samplerate=sample_rate, format="wav")
        wav.seek(0)
        return send_file(wav, mimetype="audio/wav")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"success": "pong"}), 200


if __name__ == "__main__":
    app.run(debug=False, port=PORT)
