import numpy as np
import scipy.sparse as sparse
import implicit

# Create 2x4 matrix
mat = sparse.csr_matrix([[1, 2, 0, 0], [0, 0, 3, 4]])

model = implicit.als.AlternatingLeastSquares(factors=2, regularization=0.1, iterations=5, calculate_training_loss=True)
model.fit(mat.T)

recommended_indices, scores = model.recommend(0, mat[0], N=15, filter_already_liked_items=False)
print("Indices:", recommended_indices)
print("Scores:", scores)
