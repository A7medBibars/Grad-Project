# ========================
# Local PC API Code
# ========================
from flask import Flask, request, jsonify 
from flask_cors import CORS  # Only needed for cross-origin requests
import tensorflow as tf 
import cv2
import numpy as np
import os
from datetime import datetime
from keras.models import load_model
# from tensorflow.keras.models import load_model

app = Flask(__name__)
CORS(app)  # Enable if your mobile app uses different origin

# Load model and setup
EMOTIONS = ['angry', 'happy', 'neutral', 'sad', 'surprise']
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Custom objects
custom_objects = {
    'LeakyReLU': tf.keras.layers.LeakyReLU,
    'BatchNormalization': tf.keras.layers.BatchNormalization,
    'Functional': tf.keras.Model
}

model = load_model('E:/Graduation_Project/Final.h5', custom_objects=custom_objects)

def process_image(img):
    """Identical processing function"""
    faces = face_cascade.detectMultiScale(img, 1.1, 5, minSize=(100,100))
    if len(faces) == 0:
        return None
    x,y,w,h = faces[0]
    face = img[y:y+h, x:x+w]
    processed = cv2.resize(face, (224,224))
    processed = processed.astype('float32')/255.0
    return np.expand_dims(processed, axis=0)

@app.route('/predict/image', methods=['POST'])
def image_predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)
    
    processed = process_image(img)
    if processed is None:
        return jsonify({'error': 'No face detected'}), 400
    
    pred = model.predict(processed)
    emotion = EMOTIONS[np.argmax(pred)]
    
    return jsonify({'emotion': emotion})

@app.route('/predict/video', methods=['POST'])
def video_predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No video uploaded'}), 400
    
    file = request.files['file']
    temp_path = f"/tmp/{file.filename}"
    file.save(temp_path)
    
    cap = cv2.VideoCapture(temp_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = int(fps * 0.5)  # 0.5 FPS
    results = []
    last_emotion = None
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        pos = cap.get(cv2.CAP_PROP_POS_FRAMES)
        if pos % frame_interval != 0:
            continue
            
        processed = process_image(frame)
        if processed is None:
            continue
            
        pred = model.predict(processed)
        current_emotion = EMOTIONS[np.argmax(pred)]
        
        if current_emotion != last_emotion:
            timestamp = cap.get(cv2.CAP_PROP_POS_MSEC)/1000
            results.append({
                'timestamp': round(timestamp, 1),
                'emotion': current_emotion
            })
            last_emotion = current_emotion
    
    cap.release()
    os.remove(temp_path)
    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=False)