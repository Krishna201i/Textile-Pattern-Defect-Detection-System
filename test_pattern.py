import cv2
import numpy as np
import os

def check_if_patterned(image_path):
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None: return False
    image = cv2.GaussianBlur(image, (3, 3), 0)
    edges = cv2.Canny(image, 80, 160)
    
    h, w = edges.shape
    q_h, q_w = h // 2, w // 2
    quadrants = [
        edges[0:q_h, 0:q_w], edges[q_h:, 0:q_w],
        edges[0:q_h, q_w:], edges[q_h:, q_w:]
    ]
    densities = [float(np.count_nonzero(q)) / float(q.size) for q in quadrants]
    
    mean_density = float(np.mean(densities))
    var_density = float(np.var(densities))
    
    # A uniformly patterned fabric will have high mean_density but low var_density
    # A solid fabric with a local defect will have low mean_density and potentially high var_density
    print(f"{image_path} -> Mean: {mean_density:.4f}, Var: {var_density:.6f}")
    
    if mean_density > 0.08 and var_density < 0.005:
        return True
    return False

# Create dummy images for testing
# 1. Solid fabric with defect
img_solid = np.zeros((200, 200), dtype=np.uint8)
img_solid[90:110, 90:110] = 255
cv2.imwrite("test_solid.jpg", img_solid)

# 2. Patterned fabric
img_pattern = np.tile(np.array([[0, 255], [255, 0]], dtype=np.uint8), (100, 100))
cv2.imwrite("test_pattern.jpg", img_pattern)

print("Solid:", check_if_patterned("test_solid.jpg"))
print("Patterned:", check_if_patterned("test_pattern.jpg"))
