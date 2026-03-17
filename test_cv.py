import cv2
import numpy as np
import urllib.request

# Download a patterned image
url = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=800"
urllib.request.urlretrieve(url, "pattern.jpg")

image = cv2.imread("pattern.jpg", cv2.IMREAD_GRAYSCALE)
image = cv2.GaussianBlur(image, (3, 3), 0)

laplacian = cv2.Laplacian(image, cv2.CV_64F)
laplacian_var = float(np.var(np.abs(laplacian)))

edges = cv2.Canny(image, 80, 160)
edge_density = float(np.count_nonzero(edges)) / float(edges.size)

print(f"Patterned Texture - Laplacian Var: {laplacian_var:.2f}, Edge Density: {edge_density:.4f}")

# Download a solid image
url2 = "https://images.unsplash.com/photo-1596726264560-5a3d4f1345eb?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=800"
urllib.request.urlretrieve(url2, "solid.jpg")
image2 = cv2.imread("solid.jpg", cv2.IMREAD_GRAYSCALE)
image2 = cv2.GaussianBlur(image2, (3, 3), 0)

laplacian2 = cv2.Laplacian(image2, cv2.CV_64F)
laplacian_var2 = float(np.var(np.abs(laplacian2)))
edges2 = cv2.Canny(image2, 80, 160)
edge_density2 = float(np.count_nonzero(edges2)) / float(edges2.size)
print(f"Solid Texture - Laplacian Var: {laplacian_var2:.2f}, Edge Density: {edge_density2:.4f}")
