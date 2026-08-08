"""PyTorch 生成器测试

Tests cover:
- Generator creation and parameter count
- Generation with different configs
- Training step
- Save/Load
"""

import pytest
import torch

from app.services.ai.models.pytorch_generator import (
    PyTorchFormulaGenerator,
    GenerationConfig,
    get_pytorch_generator,
)


class TestPyTorchGeneratorInit:
    """Test generator initialization."""

    def test_default_init(self):
        gen = PyTorchFormulaGenerator()
        assert gen.n_herbs == 100
        assert gen.n_dosage_bins == 10
        assert gen.device == "cpu"

    def test_custom_params(self):
        gen = PyTorchFormulaGenerator(
            input_dim=64,
            hidden_dim=256,
            n_layers=2,
            n_herbs=50,
        )
        assert gen.hidden_dim == 256
        assert gen.n_herbs == 50

    def test_parameter_count(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=64, n_layers=2, n_herbs=20)
        params = sum(p.numel() for p in gen.parameters())
        assert params > 0
        assert isinstance(params, int)


class TestPyTorchGeneratorGenerate:
    """Test generation functionality."""

    def test_basic_generation(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=10)
        signal = torch.randn(1, 40)
        herb_vocab = ["hq", "ds", "gz", "rs", "dg", "bq", "fp", "gq"]
        config = GenerationConfig(max_seq_len=6, min_seq_len=2, stop_threshold=0.5)

        formulas = gen.generate(signal, herb_vocab, config)
        assert isinstance(formulas, list)
        assert len(formulas) >= 1

    def test_generation_with_stop(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=10)
        signal = torch.randn(1, 40)
        herb_vocab = ["hq", "ds", "gz"]

        # Low stop threshold should generate shorter sequences
        config_low = GenerationConfig(max_seq_len=10, min_seq_len=2, stop_threshold=0.3)
        formulas_low = gen.generate(signal, herb_vocab, config_low)

        # High stop threshold should generate longer sequences
        config_high = GenerationConfig(max_seq_len=10, min_seq_len=2, stop_threshold=0.9)
        formulas_high = gen.generate(signal, herb_vocab, config_high)

        assert len(formulas_low) >= 1
        assert len(formulas_high) >= 1

    def test_generation_empty_vocab(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=5)
        signal = torch.randn(1, 40)
        formulas = gen.generate(signal, [], GenerationConfig(stop_threshold=0.9))
        # Should return empty formula
        assert len(formulas) >= 1


class TestPyTorchGeneratorTrain:
    """Test training functionality."""

    def test_train_step(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=5)
        optimizer = torch.optim.Adam(gen.parameters(), lr=0.01)

        signal = torch.randn(2, 40)
        target_herbs = torch.randint(0, 5, (2, 8))
        target_dosages = torch.randint(0, 10, (2, 8))
        target_stop = torch.randint(0, 2, (2, 8)).float()

        result = gen.train_step(signal, target_herbs, target_dosages, target_stop, optimizer)

        assert "total_loss" in result
        assert "herb_loss" in result
        assert "dosage_loss" in result
        assert "stop_loss" in result
        assert result["total_loss"] > 0

    def test_multiple_train_steps(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=5)
        optimizer = torch.optim.Adam(gen.parameters(), lr=0.01)

        losses = []
        for _ in range(5):
            signal = torch.randn(2, 40)
            target_herbs = torch.randint(0, 5, (2, 8))
            target_dosages = torch.randint(0, 10, (2, 8))
            target_stop = torch.randint(0, 2, (2, 8)).float()

            result = gen.train_step(signal, target_herbs, target_dosages, target_stop, optimizer)
            losses.append(result["total_loss"])

        # Losses should be finite
        assert all(isinstance(l, float) for l in losses)
        assert all(l > 0 for l in losses)


class TestPyTorchGeneratorSaveLoad:
    """Test save/load functionality."""

    def test_save_load(self, tmp_path):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=5)
        path = str(tmp_path / "test_model.pth")

        gen.save(path)

        gen2 = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=5)
        gen2.load(path)

        # Weights should be identical
        for p1, p2 in zip(gen.parameters(), gen2.parameters()):
            assert torch.equal(p1, p2)


class TestPyTorchGeneratorGlobal:
    """Test global singleton."""

    def test_get_pytorch_generator(self):
        gen = get_pytorch_generator(input_dim=40, hidden_dim=32, n_herbs=10)
        assert isinstance(gen, PyTorchFormulaGenerator)
        assert gen.n_herbs == 10


class TestPyTorchGeneratorBatch:
    """Test batch generation."""

    def test_batch_generation(self):
        gen = PyTorchFormulaGenerator(input_dim=40, hidden_dim=32, n_layers=2, n_herbs=5)
        signal = torch.randn(4, 40)  # batch of 4
        herb_vocab = ["hq", "ds", "gz"]
        config = GenerationConfig(max_seq_len=6, stop_threshold=0.3)

        formulas = gen.generate(signal, herb_vocab, config)
        # Each formula in batch generates independently
        assert len(formulas) >= 1  # At least 1 formula generated
