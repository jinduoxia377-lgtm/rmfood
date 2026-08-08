#!/usr/bin/env python3
"""MCTS Performance Benchmark"""
import time
import sys
sys.path.insert(0, "D:/RMFOOD配方平台/backend")
from app.services.ai_models.parallel_mcts_solver import ParallelMCTSOptimizer

print("MCTS Performance Benchmark")
print("=" * 50)

target_effects = ["补气", "养血"]
n_sims = 200

# Test parallel with different worker counts
for workers in [1, 2, 4, 8]:
    print(f"
Parallel MCTS (workers={workers})")
    optimizer = ParallelMCTSOptimizer(target_effects, n_simulations=n_sims, num_workers=workers)
    start = time.time()
    results = optimizer.search()
    elapsed = time.time() - start
    print(f"Time: {elapsed:.2f} seconds")
    print(f"Results: {len(results)}")
    if results:
        print(f"Best reward: {results[0]["reward"]:.4f}")

print("
Benchmark complete")
