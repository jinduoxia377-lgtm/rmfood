#!/usr/bin/env python3
"""MCTS Performance Benchmark - Sequential vs Parallel"""

import time
import logging
import os
import sys

# Add backend to path
sys.path.insert(0, "D:\RMFOOD配方平台ackend")

from app.services.ai_models.mcts_solver import MCTSOptimizer as SequentialOptimizer
from app.services.ai_models.parallel_mcts_solver import ParallelMCTSOptimizer

def benchmark_sequential(name, optimizer_class, **kwargs):
    """Run sequential optimization and measure time."""
    print(f"
{name}")
    print("-" * 50)
    
    optimizer = optimizer_class(**kwargs)
    
    start = time.time()
    results = optimizer.search()
    elapsed = time.time() - start
    
    print(f"Time: {elapsed:.2f} seconds")
    print(f"Results: {len(results)} candidates")
    if results:
        print(f"Best reward: {results[0]['reward']:.4f}")
    
    return elapsed, results

def main():
    logging.basicConfig(level=logging.INFO)
    print("MCTS Performance Benchmark")
    print("=" * 60)
    
    # Configuration for benchmark
    n_sims = 200  # Use fewer simulations for quick test
    target_effects = ["补气", "养血"]
    
    # Benchmark sequential (baseline)
    seq_time, seq_results = benchmark_sequential(
        "Sequential MCTS (Baseline)",
        SequentialOptimizer,
        target_effects=target_effects,
        n_simulations=n_sims,
        max_depth=8,
    )
    
    # Benchmark parallel (with different worker counts)
    parallel_times = {}
    for workers in [1, 2, 4, 8]:
        try:
            p_time, _ = benchmark_sequential(
                f"Parallel MCTS (workers={workers})",
                ParallelMCTSOptimizer,
                target_effects=target_effects,
                n_simulations=n_sims,
                num_workers=workers,
            )
            parallel_times[workers] = p_time
        except Exception as e:
            print(f"Parallel with workers={workers} failed: {e}")
    
    # Calculate speedup
    if seq_time > 0 and parallel_times.get(4, 0) > 0:
        speedup_4x = seq_time / parallel_times[4]
        print(f"
Speedup (4 workers vs sequential): {speedup_4x:.2f}x")
    
    print("
Benchmark complete!")

if __name__ == "__main__":
    main()
