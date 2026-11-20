"""
Convert Mesolitica's Malaysian Whisper model to CTranslate2 (int8) for faster-whisper.

Usage (from backend/ folder with venv active):
    python convert_malaysian_whisper.py

Output directory:
    backend/models/malaysian-whisper-small-v3-ct2
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

MODEL_ID = "mesolitica/malaysian-whisper-small-v3"
OUTPUT_DIR = Path(__file__).resolve().parent / "models" / "malaysian-whisper-small-v3-ct2"
OPTIONAL_FILES = [
    "tokenizer.json",
    "preprocessor_config.json",
    "tokenizer_config.json",
    "vocab.json",
    "merges.txt",
    "special_tokens_map.json",
    "normalizer.json",
    "added_tokens.json",
]


def main() -> None:
    if (OUTPUT_DIR / "model.bin").exists():
        print(f"Model already converted at: {OUTPUT_DIR}")
        return

    try:
        from huggingface_hub import HfApi
        import transformers  # noqa: F401
    except ImportError as exc:
        raise SystemExit(
            "Missing conversion dependencies. Run:\n"
            "  pip install --index-url https://download.pytorch.org/whl/cpu torch\n"
            "  pip install transformers"
        ) from exc

    repo_files = set(HfApi().list_repo_files(MODEL_ID))
    copy_files = [name for name in OPTIONAL_FILES if name in repo_files]

    converter = shutil.which(
        "ct2-transformers-converter",
        path=str(Path(sys.executable).parent),
    ) or shutil.which("ct2-transformers-converter")

    cmd = (
        [converter]
        if converter
        else [sys.executable, "-m", "ctranslate2.converters.transformers"]
    )
    cmd.extend([
        "--model", MODEL_ID,
        "--output_dir", str(OUTPUT_DIR),
        "--quantization", "int8",
        "--force",
    ])
    if copy_files:
        cmd.append("--copy_files")
        cmd.extend(copy_files)

    print(f"Converting {MODEL_ID} -> {OUTPUT_DIR} (quantization=int8)...")
    print("Files to copy:", ", ".join(copy_files) or "none")
    subprocess.run(cmd, check=True)

    if not (OUTPUT_DIR / "model.bin").exists():
        raise SystemExit(f"Conversion finished but model.bin missing in {OUTPUT_DIR}")

    print(f"Successfully converted Malaysian Whisper to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
