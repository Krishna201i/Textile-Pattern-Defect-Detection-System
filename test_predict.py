import requests
import json

# To test, we just need to see if the server returns a much lower probability now for our dummy patterned image.
# Wait, I don't have the user's specific image, but I can download a highly patterned image to test the endpoint.

import urllib.request
import os

url = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=800"
urllib.request.urlretrieve(url, "pattern_test.jpg")

with open("pattern_test.jpg", "rb") as f:
    files = {"image": f}
    response = requests.post("http://localhost:5000/api/predict", files=files)
    
print(json.dumps(response.json(), indent=2))
