import sys
sys.path.append("backend")

from model.predict import _compute_cv_defect_probability

# Test on the generated hoodie pattern
prob, details = _compute_cv_defect_probability("hoodie_pattern.jpg")
print(f"Hoodie Pattern - Prob: {prob}, Details: {details}")

# Generate a solid test image
import cv2
import numpy as np
img = np.zeros((400, 400), dtype=np.uint8)
img.fill(200) # Gray
# Add a single small defect
cv2.circle(img, (200, 200), 20, (50,), -1)
cv2.imwrite("defective_solid.jpg", img)

prob, details = _compute_cv_defect_probability("defective_solid.jpg")
print(f"Defective Solid - Prob: {prob}, Details: {details}")

# Generate a clean string image
img.fill(200)
cv2.imwrite("clean_solid.jpg", img)
prob, details = _compute_cv_defect_probability("clean_solid.jpg")
print(f"Clean Solid - Prob: {prob}, Details: {details}")
