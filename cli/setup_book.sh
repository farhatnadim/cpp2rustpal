#!/bin/bash
set -e
TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"
BOOK_DIR="$TOOLS_DIR/rust-book"

echo "==> Setting up the Rust Book locally"

# 1. Clone if not already present
if [ -d "$BOOK_DIR" ]; then
    echo "  rust-book already cloned, pulling latest..."
    git -C "$BOOK_DIR" pull --ff-only
else
    echo "  Cloning rust-lang/book..."
    git clone --depth=1 https://github.com/rust-lang/book "$BOOK_DIR"
fi

# 2. Install mdbook if not available
if ! command -v mdbook &>/dev/null; then
    echo "  Installing mdbook via cargo..."
    cargo install mdbook
else
    echo "  mdbook $(mdbook --version) already installed"
fi

# 3. Build the book
echo "  Building book..."
cd "$BOOK_DIR"
mdbook build
echo "  Built to $BOOK_DIR/book/"

# 4. Generate chapter index
echo "  Generating chapter index..."
cd "$TOOLS_DIR/.."
python3 cli/generate_book_index.py

echo ""
echo "Done! To serve the book run:"
echo "  bash cli/serve_book.sh"
