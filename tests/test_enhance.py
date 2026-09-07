from pathlib import Path

from PIL import Image

from visual_engine.enhance import enhance_image, normalize_enhance_size


def test_enhance_keeps_image_size(tmp_path: Path):
    source = tmp_path / "source.png"
    output = tmp_path / "enhanced.jpg"
    Image.new("RGB", (120, 80), (90, 110, 70)).save(source)
    enhance_image(source, output, "presentation")
    result = Image.open(output)
    assert result.size == (120, 80)


def test_normalize_enhance_size_band():
    assert normalize_enhance_size(320, 180) == (512, 288)
    assert normalize_enhance_size(1600, 900) == (768, 432)
    assert normalize_enhance_size(640, 480) == (640, 480)


def test_enhance_hd_normalizes_to_512_768(tmp_path: Path):
    source = tmp_path / "source.png"
    output = tmp_path / "hd.jpg"
    Image.new("RGB", (320, 180), (80, 100, 70)).save(source)
    enhance_image(source, output, "hd")
    result = Image.open(output)
    long_side = max(result.size)
    assert 512 <= long_side <= 768
    assert abs(result.size[0] / result.size[1] - 320 / 180) < 0.02


def test_enhance_hd_downscales_large(tmp_path: Path):
    source = tmp_path / "source.png"
    output = tmp_path / "hd-large.jpg"
    Image.new("RGB", (1920, 1080), (70, 90, 60)).save(source)
    enhance_image(source, output, "hd")
    result = Image.open(output)
    assert max(result.size) == 768
    assert abs(result.size[0] / result.size[1] - 1920 / 1080) < 0.02
