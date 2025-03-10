import wfdb
import json
import sys
import os

def process_ecg(file_path):
    try:
        # Separamos el nombre base de la extensión (nombre archivo y ".dat"
        base_name, _ = os.path.splitext(file_path)
        
        # wfdb.rdrecord() necesita que le pases el nombre base (sin la extensión .dat)
        record = wfdb.rdrecord(base_name)
        
        # Extraemos la señal, la frecuencia de muestreo y construimos la lista de timestamps
        signals = record.p_signal[:, 0]
        fs = record.fs
        timestamps = [i / fs for i in range(len(signals))]
        
        # Dividimos la señal a la mitad (esto parece ser tu requisito específico)
        half_index = len(signals) // 2
        half_signal = signals[:half_index]
        
        # Retornamos en formato JSON
        return {
            'timestamps': timestamps,
            'signals': half_signal.tolist()
        }
    except Exception as e:
        print(f"Error al leer el registro: {e}")
        return None

if __name__ == '__main__':
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        data = process_ecg(file_path)
        if data:
            print(json.dumps(data))
        else:
            print(json.dumps({'error': 'Error al procesar el archivo .dat'}))
    else:
        print(json.dumps({'error': 'No se proporcionó el nombre del archivo.'}))
