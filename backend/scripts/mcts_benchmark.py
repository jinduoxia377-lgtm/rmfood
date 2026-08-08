#!/usr/bin/env python3
"""MCTS性能基准测试脚本"""
import time
import logging
from pathlib import Path
import sys

sys.path.insert(0, str(Path(r"D:\RMFOOD配方平台ackend")))

from app.services.ai_models.mcts_solver import MCTSOptimizer

def run_baseline():
    print("=" * 60)
    print("Running baseline MCTS (single-threaded)...")
    print("=" * 60)
    
    optimizer = MCTSOptimizer(
        target_effects=["补气", "养血"],
        n_simulations=500,
        max_depth=8,
    )
    
    start_time = time.time()
    results = optimizer.search()
    end_time = time.time()
    
    elapsed = end_time - start_time
    print(f"Baseline completed in {elapsed:.2f} seconds")
    print(f"Results found: {len(results)} candidates")
    print(f"Average time per simulation: {elapsed/optimizer.n_simulations*1000:.2f} ms")
    return elapsed, results

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_baseline()
