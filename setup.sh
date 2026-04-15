#!/bin/bash

# C++ to Rust Translator - Setup Script

set -e

echo "=== C++ to Rust Translator Setup ==="
echo ""

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "npm is not installed."
    echo ""
    echo "Please install Node.js and npm first:"
    echo ""
    echo "  Option 1 (Ubuntu/Debian):"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
    echo ""
    echo "  Option 2 (using nvm):"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "    nvm install 20"
    echo ""
    echo "  Option 3 (download from nodejs.org):"
    echo "    https://nodejs.org/"
    echo ""
    echo "After installing npm, run this script again."
    exit 1
fi

echo "Found npm version: $(npm --version)"
echo "Found node version: $(node --version)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

# Compile TypeScript
echo ""
echo "Compiling TypeScript..."
npm run compile

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To test the extension:"
echo "  1. Open this folder in VS Code: cd cpp-to-rust-translator && code ."
echo "  2. Press F5 to launch the extension development host"
echo "  3. Open a C++ file in the new window"
echo ""
echo "To install for regular use:"
echo "  npx vsce package"
echo "  code --install-extension cpp-to-rust-translator-0.1.0.vsix"
