import sys
sys.path.append("backend")

import os
from model.predict import predict_image
from pprint import pprint

def test_images():
    base_dir = r"C:\Users\ks759\.gemini\antigravity\brain\b170b6b8-4ed1-4daa-a4f1-1676d9761b86"
    test_files = [f for f in os.listdir(base_dir) if f.startswith("media__") and (f.endswith(".jpg") or f.endswith(".png"))]
    
    for filename in test_files:
        path = os.path.join(base_dir, filename)
        print(f"\n--- Testing {filename} ---")
        try:
            result = predict_image(path)
            pprint(result)
        except Exception as e:
            print(f"Error predicting {filename}: {e}")

if __name__ == "__main__":
    test_images()
