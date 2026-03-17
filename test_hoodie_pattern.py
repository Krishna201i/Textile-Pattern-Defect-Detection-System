import cv2
import numpy as np

# Create an image akin to the BKLYN hoodie
img = np.zeros((400, 400), dtype=np.uint8)
img.fill(255) # White background

# Draw lots of text "BKLYN" all over to simulate the hoodie pattern
font = cv2.FONT_HERSHEY_SIMPLEX
for y in range(40, 400, 80):
    for x in range(0, 400, 100):
        cv2.putText(img, "BKLYN", (x, y), font, 1.5, (0,), 4, cv2.LINE_AA)
        
cv2.imwrite("hoodie_pattern.jpg", img)

image = cv2.imread("hoodie_pattern.jpg", cv2.IMREAD_GRAYSCALE)
image = cv2.GaussianBlur(image, (3, 3), 0)

laplacian = cv2.Laplacian(image, cv2.CV_64F)
laplacian_var = float(np.var(np.abs(laplacian)))

edges = cv2.Canny(image, 80, 160)
edge_density = float(np.count_nonzero(edges)) / float(edges.size)

print(f"Generated Hoodie Pattern - Laplacian Var: {laplacian_var:.2f}, Edge Density: {edge_density:.4f}")
