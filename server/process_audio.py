import sys
import os
import json
import wave
import numpy as np
from pydub import AudioSegment

def convert_mp3_to_wav(mp3_path, wav_path):
    audio = AudioSegment.from_mp3(mp3_path)
    audio = audio.set_channels(1)  # Convertir a mono si es estéreo
    audio.export(wav_path, format="wav")

def process_wav(file_path):
    with wave.open(file_path, 'r') as wav_file:
        n_channels = wav_file.getnchannels()
        frames = wav_file.readframes(wav_file.getnframes())
        samples = np.frombuffer(frames, dtype=np.int16)

    
        if n_channels > 1:
            samples = samples.reshape(-1, n_channels).mean(axis=1)  # Convertir a mono

        samples = samples / np.iinfo(np.int16).max  # Normalizar entre -1 y 1
        frame_rate = wav_file.getframerate()
        
        return {
            'samples': samples.tolist(),
            'frame_rate': frame_rate
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_audio.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1]

    if ext == '.mp3':
        wav_path = os.path.splitext(file_path)[0] + '.wav'
        convert_mp3_to_wav(file_path, wav_path)
        data = process_wav(wav_path)
        print(json.dumps({'wav_path': wav_path, 'data': data}))
    elif ext == '.wav':
        data = process_wav(file_path)
        print(json.dumps({'data': data}))
    else:
        print("Unsupported file type")
        sys.exit(1)  


 


""" import sys
import os
import json
import wave
import numpy as np
from pydub import AudioSegment
import matplotlib.pyplot as plt

def convert_mp3_to_wav(mp3_path, wav_path):
    audio = AudioSegment.from_mp3(mp3_path)
    audio = audio.set_channels(1)  # Convertir a mono si es estéreo
    audio.export(wav_path, format="wav")

def process_wav(file_path):
    with wave.open(file_path, 'r') as wav_file:
        n_channels = wav_file.getnchannels()
        frames = wav_file.readframes(wav_file.getnframes())
        samples = np.frombuffer(frames, dtype=np.int16)

        if n_channels > 1:
            samples = samples.reshape(-1, n_channels).mean(axis=1)  # Convertir a mono

        samples = samples / np.iinfo(np.int16).max  # Normalizar entre -1 y 1
        frame_rate = wav_file.getframerate()
        
        return {
            'samples': samples.tolist(),
            'frame_rate': frame_rate
        }

def plot_waveform(samples, frame_rate):
    # Generar tiempo en segundos para el eje x
    time = np.linspace(0., len(samples) / frame_rate, num=len(samples))

    plt.figure(figsize=(10, 6))
    plt.plot(time, samples, label='Señal de audio')
    plt.title('Fonocardiograma / Forma de onda')
    plt.xlabel('Tiempo [s]')
    plt.ylabel('Amplitud')
    plt.grid(True)
    plt.show()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_audio.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1]

    if ext == '.mp3':
        wav_path = os.path.splitext(file_path)[0] + '.wav'
        convert_mp3_to_wav(file_path, wav_path)
        data = process_wav(wav_path)
        print(json.dumps({'wav_path': wav_path, 'data': data}))
        plot_waveform(np.array(data['samples']), data['frame_rate'])
    elif ext == '.wav':
        data = process_wav(file_path)
        print(json.dumps({'data': data}))
        plot_waveform(np.array(data['samples']), data['frame_rate'])
    else:
        print("Unsupported file type")
        sys.exit(1) """
""" import sys
import os
import json
import wave
import numpy as np
from pydub import AudioSegment
import librosa
import librosa.display
import matplotlib.pyplot as plt

def convert_mp3_to_wav(mp3_path, wav_path):
    audio = AudioSegment.from_mp3(mp3_path)
    audio = audio.set_channels(1)  # Convertir a mono si es estéreo
    audio.export(wav_path, format="wav")

def process_wav(file_path):
    with wave.open(file_path, 'r') as wav_file:
        n_channels = wav_file.getnchannels()
        frames = wav_file.readframes(wav_file.getnframes())
        samples = np.frombuffer(frames, dtype=np.int16)
    
        if n_channels > 1:
            samples = samples.reshape(-1, n_channels).mean(axis=1)  # Convertir a mono

        samples = samples / np.iinfo(np.int16).max  # Normalizar entre -1 y 1
        frame_rate = wav_file.getframerate()
        
        return {
            'samples': samples.tolist(),
            'frame_rate': frame_rate
        }

def plot_fonocardiograma(audio_path):
    # Cargar el archivo de audio usando librosa
    y, sr = librosa.load(audio_path, sr=None)
    
    # Calcular la STFT (transformada de Fourier) para generar el espectrograma
    D = librosa.amplitude_to_db(np.abs(librosa.stft(y)), ref=np.max)
    
    # Graficar el fonocardiograma
    plt.figure(figsize=(10, 6))
    librosa.display.specshow(D, x_axis='time', y_axis='log', sr=sr)
    plt.colorbar(format='%+2.0f dB')
    plt.title('Fonocardiograma')
    plt.xlabel('Tiempo (s)')
    plt.ylabel('Frecuencia (Hz)')
    plt.show()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_audio.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1]

    if ext == '.mp3':
        wav_path = os.path.splitext(file_path)[0] + '.wav'
        convert_mp3_to_wav(file_path, wav_path)
        data = process_wav(wav_path)
        print(json.dumps({'wav_path': wav_path, 'data': data}))
        plot_fonocardiograma(wav_path)  # Graficar el fonocardiograma
    elif ext == '.wav':
        data = process_wav(file_path)
        print(json.dumps({'data': data}))
        plot_fonocardiograma(file_path)  # Graficar el fonocardiograma
    else:
        print("Unsupported file type")
        sys.exit(1) """



