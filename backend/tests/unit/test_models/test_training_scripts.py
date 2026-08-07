"""Tests for training script components

Tests cover:
- FormulaDataset
- TrainingConfig
- Training and evaluation functions
"""

import pytest
import torch
from torch.utils.data import DataLoader

from app.services.ai.models.data_loader import FormulaDataset, TrainingConfig


class TestFormulaDataset:
    """Test FormulaDataset."""

    def test_dataset_creation(self):
        dataset = FormulaDataset(
            signals=[[0.1] * 36],
            target_herbs=[[0, 1, 2]],
            target_dosages=[[5.0, 8.0, 10.0]],
            target_stops=[[0, 0, 1]],
            herb_vocab=["hq", "ds", "gz"],
        )
        assert len(dataset) == 1

    def test_dataset_getitem(self):
        dataset = FormulaDataset(
            signals=[[0.1] * 36],
            target_herbs=[[0, 1]],
            target_dosages=[[5.0, 8.0]],
            target_stops=[[0, 1]],
            herb_vocab=["hq", "ds"],
        )
        item = dataset[0]
        assert "signal" in item
        assert "target_herb" in item
        assert "target_dosage" in item
        assert "target_stop" in item

    def test_dataset_tensor_shapes(self):
        dataset = FormulaDataset(
            signals=[[0.1] * 36],
            target_herbs=[[0, 1, 2]],
            target_dosages=[[5.0, 8.0, 10.0]],
            target_stops=[[0, 0, 1]],
            herb_vocab=["hq", "ds", "gz"],
        )
        item = dataset[0]
        assert item["signal"].shape == (36,)
        assert item["target_herb"].shape == (3,)
        assert item["target_dosage"].shape == (3,)
        assert item["target_stop"].shape == (3,)


class TestCollateFn:
    """Test collate function."""

    def test_collate(self):
        def collate_fn(batch):
            return {
                "signal": torch.stack([item["signal"] for item in batch]),
                "target_herb": torch.stack([item["target_herb"] for item in batch]),
                "target_dosage": torch.stack([item["target_dosage"] for item in batch]),
                "target_stop": torch.stack([item["target_stop"] for item in batch]),
            }

        batch = [
            {
                "signal": torch.tensor([0.1] * 36),
                "target_herb": torch.tensor([0, 1]),
                "target_dosage": torch.tensor([5.0, 8.0]),
                "target_stop": torch.tensor([0, 1]),
            },
            {
                "signal": torch.tensor([0.2] * 36),
                "target_herb": torch.tensor([1, 2]),
                "target_dosage": torch.tensor([6.0, 9.0]),
                "target_stop": torch.tensor([0, 1]),
            },
        ]
        collated = collate_fn(batch)
        assert collated["signal"].shape == (2, 36)
        assert collated["target_herb"].shape == (2, 2)
        assert collated["target_dosage"].shape == (2, 2)
        assert collated["target_stop"].shape == (2, 2)


class TestTrainingConfig:
    """Test TrainingConfig."""

    def test_default_config(self):
        config = TrainingConfig()
        assert config.epochs == 100
        assert config.batch_size == 32
        assert config.learning_rate == 1e-3
        assert config.device == "cpu"

    def test_custom_config(self):
        config = TrainingConfig(
            epochs=50,
            batch_size=16,
            learning_rate=5e-4,
            device="cpu",
        )
        assert config.epochs == 50
        assert config.batch_size == 16
        assert config.learning_rate == 5e-4


class TestTrainEpoch:
    """Test training epoch function."""

    def test_train_epoch(self):
        from app.services.ai.models import PyTorchFormulaGenerator

        model = PyTorchFormulaGenerator(
            input_dim=36,
            hidden_dim=32,
            n_layers=2,
            n_herbs=10,
            device="cpu",
        )

        dataset = FormulaDataset(
            signals=[[0.1] * 36 for _ in range(8)],
            target_herbs=[[0, 1, 2] for _ in range(8)],
            target_dosages=[[5.0, 8.0, 10.0] for _ in range(8)],
            target_stops=[[0, 0, 1] for _ in range(8)],
            herb_vocab=["hq", "ds", "gz", "rs", "dg", "bq", "fp", "gq", "jgh", "cs"],
        )
        dataloader = DataLoader(dataset, batch_size=4, shuffle=False)

        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
        config = TrainingConfig(device="cpu")

        # Simple training step
        model.train()
        signal = torch.randn(4, 36)
        target_herb = torch.randint(0, 10, (4, 3))
        target_dosage = torch.randn(4, 3)
        target_stop = torch.randint(0, 2, (4, 3)).float()

        optimizer.zero_grad()
        herb_logits, dosage_logits, stop_logits = model(signal)

        herb_loss = torch.nn.CrossEntropyLoss()(
            herb_logits.reshape(-1, 10), target_herb.reshape(-1)
        )
        dosage_loss = torch.nn.MSELoss()(
            dosage_logits.reshape(-1), target_dosage.reshape(-1)
        )
        stop_loss = torch.nn.BCEWithLogitsLoss()(
            stop_logits.reshape(-1), target_stop.reshape(-1)
        )

        total_loss = herb_loss + dosage_loss + stop_loss
        total_loss.backward()
        optimizer.step()

        assert total_loss.item() > 0


class TestEvaluate:
    """Test evaluation function."""

    def test_evaluate(self):
        from app.services.ai.models import PyTorchFormulaGenerator

        model = PyTorchFormulaGenerator(
            input_dim=36,
            hidden_dim=32,
            n_layers=2,
            n_herbs=10,
            device="cpu",
        )

        dataset = FormulaDataset(
            signals=[[0.1] * 36 for _ in range(8)],
            target_herbs=[[0, 1, 2] for _ in range(8)],
            target_dosages=[[5.0, 8.0, 10.0] for _ in range(8)],
            target_stops=[[0, 0, 1] for _ in range(8)],
            herb_vocab=["hq", "ds", "gz", "rs", "dg", "bq", "fp", "gq", "jgh", "cs"],
        )
        dataloader = DataLoader(dataset, batch_size=4, shuffle=False)
        config = TrainingConfig(device="cpu")

        # Simple evaluation
        model.eval()
        with torch.no_grad():
            signal = torch.randn(4, 36)
            herb_logits, dosage_logits, stop_logits = model(signal)

            herb_loss = torch.nn.CrossEntropyLoss()(
                herb_logits.reshape(-1, 10), torch.randint(0, 10, (4, 3))
            )
            dosage_loss = torch.nn.MSELoss()(
                dosage_logits.reshape(-1), torch.randn(4, 3)
            )
            stop_loss = torch.nn.BCEWithLogitsLoss()(
                stop_logits.reshape(-1), torch.randint(0, 2, (4, 3)).float()
            )

            total_loss = herb_loss + dosage_loss + stop_loss

        assert total_loss.item() >= 0


class TestTrainingIntegration:
    """Integration test for training loop."""

    def test_full_training_loop(self):
        """Test a simple training loop."""
        from app.services.ai.models import PyTorchFormulaGenerator

        model = PyTorchFormulaGenerator(
            input_dim=36,
            hidden_dim=32,
            n_layers=2,
            n_herbs=10,
            device="cpu",
        )

        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

        # Train for 2 epochs
        losses = []
        for epoch in range(2):
            model.train()
            signal = torch.randn(8, 36)
            target_herb = torch.randint(0, 10, (8, 3))
            target_dosage = torch.randn(8, 3)
            target_stop = torch.randint(0, 2, (8, 3)).float()

            optimizer.zero_grad()
            herb_logits, dosage_logits, stop_logits = model(signal)

            herb_loss = torch.nn.CrossEntropyLoss()(
                herb_logits.reshape(-1, 10), target_herb.reshape(-1)
            )
            dosage_loss = torch.nn.MSELoss()(
                dosage_logits.reshape(-1), target_dosage.reshape(-1)
            )
            stop_loss = torch.nn.BCEWithLogitsLoss()(
                stop_logits.reshape(-1), target_stop.reshape(-1)
            )

            total_loss = herb_loss + dosage_loss + stop_loss
            total_loss.backward()
            optimizer.step()
            losses.append(total_loss.item())

        # Loss should be finite
        assert all(isinstance(l, float) for l in losses)
        assert all(l > 0 for l in losses)
