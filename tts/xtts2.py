import os
import time
import torch
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
import soundfile

config = XttsConfig()
config.load_json(f"{os.path.dirname(__file__)}/dependencies/xtts/config.json")
model = Xtts.init_from_config(config)
# model.load_checkpoint(config, checkpoint_dir="/mnt/e/CoquiTTS/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/", speaker_file_path="/mnt/e/CoquiTTS/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/speakers_xtts.pth", eval=True)
model.load_checkpoint(config, checkpoint_dir="/mnt/e/CoquiTTS/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/")

# model.speaker_manager.speakers = {}
model.cuda()


# outputs = model.synthesize(
#     "It took me quite a long time to develop a voice and now that I have it I am not going to be silent.",
#     config,
#     speaker_wav="/mnt/e/CoquiTTS/models/wav_voices/melody1.wav",
#     gpt_cond_len=3,
#     language="en",
# )

gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(
    audio_path=["/mnt/e/CoquiTTS/models/wav_voices/melody1.wav"]
)

# model.speaker_manager.speakers["main"] = {
#     "gpt_cond_latent": gpt_cond_latent,
#     "speaker_embedding": speaker_embedding
# }

# model.speaker_manager.speakers["main"]["gpt_cond_latent"] = gpt_cond_latent
# model.speaker_manager.speakers["main"]["speaker_embedding"] = speaker_embedding
# print(model.speaker_manager.name_to_id)

def synthesize(text):
    start_time = time.time()
    chunks = model.inference_stream(text,"en", gpt_cond_latent, speaker_embedding)
    wav_chuncks = []
    for i, chunk in enumerate(chunks):
        if i == 0:
            print(f"Time to first chunck: {time.time() - start_time}")
        print(f"Received chunk {i} of audio length {chunk.shape[-1]}")
        wav_chuncks.append(chunk)
    wav = torch.cat(wav_chuncks, dim=0) 
    return wav.squeeze().unsqueeze(0).cpu(), 24000

if __name__ == "__main__":
    outputs = model.synthesize(
        "It took me quite a long time to develop a voice and now that I have it I am not going to be silent.",
        speaker_wav=None,
        config=config,
        language="en",
        speaker_id="main",
    )
    soundfile.write("output.wav", outputs["wav"], 24000)
