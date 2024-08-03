import os
import io
import torch
import hashlib
import soundfile as sf
import numpy
from transformers import VitsModel, AutoTokenizer, logging
from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import requests

load_dotenv()
logging.set_verbosity_error()

MAIN_PORT = int(os.environ.get("PORT_SERVER", "8000"))
PORT = int(os.environ.get("TTS_SERVER", "8080"))
MODEL_PATH = os.environ.get("VITS_MODEL", "kakao-enterprise/vits-ljs")

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using {device} device.")
print(f"Using {MODEL_PATH} model.")

model = VitsModel.from_pretrained(MODEL_PATH).to(device)
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
sample_rate = model.config.sampling_rate


def generate_audio(text: str) -> numpy.ndarray:
    inputs = tokenizer(text, return_tensors="pt").to(device)
    with torch.no_grad():
        audio = model(**inputs).waveform
    return audio.cpu().numpy().squeeze()


generate_audio("This is a test.")

app = Flask(__name__)


def notify_main_server():
    try:
        requests.post(
            f"http://localhost:{MAIN_PORT}/tts-notice",
            data={"Status": "TTS server online"},
            timeout=1000,
        )
    except Exception as e:
        print(f"Error passing notice: {e}")


notify_main_server()


def get_short_hash(text):
    sha256_hash = hashlib.sha256()
    sha256_hash.update(text.encode("utf-8"))
    hash_hex = sha256_hash.hexdigest()
    return hash_hex[:8]


@app.route("/tts", methods=["POST", "GET"])
def process_tts():
    # if request.method not in ["POST", "GET"]:
    #     return jsonify({"error": "Method not allowed"}), 405

    if request.method == "GET":
        text = request.args.get("text")
    else:
        text = request.data.decode("utf-8")

    if not text:
        return jsonify({"error": "Text is empty"}), 400

    try:
        print(f"\033[96m Received text: {text}\033[00m")

        audio = generate_audio(text)
        audio = (audio * 32767).astype(numpy.int16)
        wav = io.BytesIO()

        sf.write(
            wav,
            numpy.concatenate(
                (audio, numpy.zeros(int(0.5 * sample_rate), dtype=audio.dtype))
            ),
            samplerate=sample_rate,
            format="wav",
        )
        wav.seek(0)
        return send_file(wav, mimetype="audio/wav")
    except Exception as e:
        print(f"\033[95mError processing TTS: {e}\033[00m")
        return jsonify({"error": str(e)}), 500


@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "message": "TTS server is running"}), 200


if __name__ == "__main__":
    app.run(debug=False, port=PORT)
