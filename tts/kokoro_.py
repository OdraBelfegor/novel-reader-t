from kokoro import KPipeline
import soundfile
import torch

voice = 'af_bella'

pipeline = KPipeline(lang_code='a')

def synthetize(text):
    generator = pipeline(text, voice)
    buffer = []
    for i, (gs, ps, audio) in enumerate(generator):
        buffer.append(audio)
    return torch.cat(buffer).numpy()


if __name__ == '__main__':   
    text = '''
    Sam and Gail enjoy their dinner, savoring each bite of the tender steak and sip of the fine wine. The rich flavors dance on their tongues, and the atmosphere of the restaurant creates a sense of tranquility and celebration around them.
    '''

    generator = pipeline(
        text, voice, # <= change voice here
        speed=1, split_pattern=r'\n+'
    )

    audio_l = []

    for i, (gs, ps, audio) in enumerate(generator):
        print(i)  # i => index
        print(gs) # gs => graphemes/text
        print(ps) # ps => phonemes
        audio_l.append(audio)

    soundfile.write(f'output/{voice}.wav', torch.cat(audio_l), 24000) # save each audio file