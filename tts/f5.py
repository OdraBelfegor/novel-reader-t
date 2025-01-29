import os
import re
import shutil
import time

import numpy as np
import soundfile as sf
from omegaconf import OmegaConf
from huggingface_hub import hf_hub_download

from f5_tts.infer.utils_infer import (
    target_rms,
    cross_fade_duration,
    nfe_step,
    cfg_strength,
    sway_sampling_coef,
    speed,
    fix_duration,
    infer_process,
    load_model,
    load_vocoder,
    preprocess_ref_audio_text,
)
from f5_tts.model import DiT

model_name = "F5-TTS"
model_cfg = f"{os.path.dirname(__file__)}/dependencies/F5TTS_Base_train.yaml"
if not os.path.exists(model_cfg):
    temp_model_cfg = hf_hub_download(repo_id="mrfakename/E2-F5-TTS", filename="F5TTS_Base_train.yaml", subfolder="src/f5_tts/configs", local_dir=f"{os.path.dirname(__file__)}/dependencies", repo_type="space")
    os.rename(temp_model_cfg, model_cfg)
    shutil.rmtree(f"{os.path.dirname(__file__)}/dependencies/src")
ckpt_file = "/mnt/e/CoquiTTS/F5TTS_Base/model_1200000.safetensors"
vocab_file = "/mnt/e/CoquiTTS/F5TTS_Base/vocab.txt"

ref_audio = "/mnt/e/CoquiTTS/models/wav_voices/orphea.wav"
ref_text = ""

text_to_generate = "Hello, my name is Odra. I am a mechatronics engineer and I am a student of the University of Mexico."


vocoder_local_path = f"{os.path.dirname(__file__)}/dependencies/vocos-mel-24khz"

if not os.path.exists(vocoder_local_path + "/config.yaml"):
    hf_hub_download(repo_id="charactr/vocos-mel-24khz", filename="config.yaml", local_dir=vocoder_local_path)

if not os.path.exists(vocoder_local_path + "/pytorch_model.bin"):
    hf_hub_download(repo_id="charactr/vocos-mel-24khz", filename="pytorch_model.bin", local_dir=vocoder_local_path)


vocoder = load_vocoder(vocoder_name="vocos", is_local=True, local_path=vocoder_local_path)

model_cls = DiT
model_cfg = OmegaConf.load(model_cfg).model.arch

ema_model = load_model(model_cls, model_cfg, ckpt_file, mel_spec_type="vocos", vocab_file=vocab_file, device="cuda")

voices = {"main": {"ref_audio": ref_audio, "ref_text": ref_text}}

print("transcripting ref_audio")

voices["main"]["ref_audio"], voices["main"]["ref_text"] = preprocess_ref_audio_text(
    voices["main"]["ref_audio"], voices["main"]["ref_text"]
)

print("ref_audio_", voices["main"]["ref_audio"], "\n\n")

def infer_text(text_to_generate):
    
    generated_audio_segments = []
    reg1 = r"(?=\[\w+\])"
    chunks = re.split(reg1, text_to_generate)
    for text in chunks:
        if not text.strip():
            continue
        gen_text_ = text.strip()
        audio_segment, final_sample_rate, spectragram = infer_process(
            voices["main"]["ref_audio"],
            voices["main"]["ref_text"],
            gen_text_,
            ema_model,
            vocoder,
            mel_spec_type="vocos",
            target_rms=target_rms,
            cross_fade_duration=cross_fade_duration,
            nfe_step=nfe_step,
            cfg_strength=cfg_strength,
            sway_sampling_coef=sway_sampling_coef,
            speed=speed,
            fix_duration=fix_duration,
            device="cuda"
        )
        generated_audio_segments.append(audio_segment)

    # To test
    if generated_audio_segments:
        final_wave = np.concatenate(generated_audio_segments)
        return final_wave, final_sample_rate
    

start_time = time.time()
wave, sample_rate = infer_text(text_to_generate)
end_time = time.time()
print(f"Time taken: {end_time - start_time} seconds")

sf.write("output.wav", wave, sample_rate)
start_time = time.time()
wave, sample_rate = infer_text("Ororo had finally created her character in Shady Sands along with Jean and Logan. They had opted to play together and fully see what this game had to offer. Currently the three of them were slowly navigating the start, talking to the people.")
end_time = time.time()
print(f"Time taken: {end_time - start_time} seconds")

sf.write("output1.wav", wave, sample_rate)
start_time = time.time()
wave, sample_rate = infer_text("\"Storm, I am not able to read any of your minds here... And my powers are completely cut off, it is as if I don't have them.\"")
end_time = time.time()
print(f"Time taken: {end_time - start_time} seconds")

sf.write("output2.wav", wave, sample_rate)
