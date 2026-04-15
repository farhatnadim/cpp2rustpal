# Installation Instructions

## Prerequisites

You need Node.js and npm installed on your system.

### Installing Node.js

**Option 1: Using NodeSource (Recommended for Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Option 2: Using nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**Option 3: Download from nodejs.org**
Download the LTS version from https://nodejs.org/ and install.

**Option 4: Using your package manager**
```bash
# Ubuntu/Debian
sudo apt-get install nodejs npm

# Fedora
sudo dnf install nodejs npm

# macOS (with Homebrew)
brew install node
```

## Installation Steps

### 1. Install Dependencies

```bash
cd /home/nadim/Source/rust_cpp_for_scientists/cpp-to-rust-translator
npm install
```

### 2. Test the Extension (Development Mode)

```bash
# Open in VS Code
code .

# Press F5 to launch extension development host
```

A new VS Code window will open. Open a `.cpp` file in that window, and the extension will automatically:
- Create a `.rs` file next to your C++ file
- Generate comments explaining detected C++ features
- Show syntax hints for Rust equivalents

### 3. Install for Regular Use

```bash
# Package the extension
npx vsce package

# Install the VSIX file
code --install-extension cpp-to-rust-translator-0.1.0.vsix
```

## Quick Start After Installation

1. Open any C++ file (`.cpp`, `.c`, `.hpp`, `.h`, `.cc`, `.cxx`) in VS Code
2. The extension automatically monitors the file
3. A `.rs` file is created in the same directory with translation comments
4. The Rust file opens in a side-by-side editor

## Usage

### Manual Commands

Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run:

- **C++ to Rust: Translate Current File** - Manually trigger translation
- **C++ to Rust: Open Rust Editor** - Open/create the Rust file
- **C++ to Rust: Toggle Auto-Update** - Enable/disable automatic updates

### Configuration

Go to Settings (`Ctrl+,` or `Cmd+,`) and search for "cppToRust":

| Setting | Default | Description |
|---------|---------|-------------|
| `cppToRust.autoUpdate` | `true` | Auto-update Rust file as you type |
| `cppToRust.showSyntaxHints` | `true` | Include syntax hints |
| `cppToRust.showConceptualMapping` | `true` | Include conceptual mapping |
| `cppToRust.sideBySide` | `true` | Open Rust file in side-by-side editor |

Or add to your `.vscode/settings.json`:

```json
{
  "cppToRust.autoUpdate": true,
  "cppToRust.showSyntaxHints": true,
  "cppToRust.showConceptualMapping": true,
  "cppToRust.sideBySide": true
}
```

## Example

Open a C++ file:

```cpp
#include <memory>
#include <vector>

int main() {
    std::unique_ptr<int> ptr = std::make_unique<int>(42);
    std::vector<int> vec = {1, 2, 3};
    auto f = [](int x) { return x * 2; };
    return *ptr + f(21);
}
```

The extension generates a `.rs` file:

```rust
// C++ to Rust Translator
// Generated from C++ code analysis

// C++ Feature Detected: std::unique_ptr<T>
// Rust Equivalent: Box<T>
// Notes: Exclusive ownership of a dynamically allocated object.
//
// How to declare in Rust:
// let ptr = Box::new(value);

// ---

// C++ Feature Detected: std::vector<T>
// Rust Equivalent: Vec<T>
// Notes: Dynamic array with contiguous memory.
//
// How to declare in Rust:
// let vec = vec![1, 2, 3];

// ---

// C++ Feature Detected: Lambda expressions
// Rust Equivalent: Closures (Fn, FnMut, FnOnce)
//
// How to declare in Rust:
// let f = |x: i32| x * 2;

// ---
```

## Troubleshooting

### Extension doesn't activate

1. Make sure the file has a C++ language ID
2. Check the Output panel (View → Output) and select "C++ to Rust Translator"
3. Try the "Translate Current File" command manually

### Rust file not created

1. Check file permissions in the directory
2. Make sure the file path doesn't contain special characters
3. Try creating the `.rs` file manually

### TypeScript errors

```bash
# Clean and rebuild
rm -rf out node_modules
npm install
npm run compile
```

## Uninstall

```bash
# Remove extension
code --uninstall-extension rust-cpp-translator.cpp-to-rust-translator
```
