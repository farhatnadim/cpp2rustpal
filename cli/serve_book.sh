#!/bin/bash
TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"
BOOK_DIR="$TOOLS_DIR/rust-book"

if [ ! -d "$BOOK_DIR" ]; then
    echo "Error: Rust Book not found. Run tools/setup_book.sh first."
    exit 1
fi

echo "Serving Rust Book at http://localhost:3000 ..."
cd "$BOOK_DIR" && mdbook serve --open
