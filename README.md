# C++ to Rust Translator

A VS Code extension that provides real-time conceptual guidance when writing C++ code. As you type C++, the extension generates a `.rs` file with comments explaining which C++ concepts are being used and how they translate to Rust.

## Features

- **Real-time monitoring**: Automatically detects C++ features as you type
- **Conceptual mapping**: Shows which C++ features are detected and their Rust equivalents
- **Syntax hints**: Provides declaration patterns without writing full code
- **Side-by-side editing**: Opens Rust file in adjacent editor pane
- **Toggleable**: Enable/disable auto-update and customize output

## Output Format

The generated `.rs` file contains two types of comments:

### 1. Conceptual Mapping

```rust
// C++ Feature Detected: std::unique_ptr<T>
// Rust Equivalent: Box<T>
// Notes: Rust doesn't need a special smart pointer for exclusive ownership
// because all values are moved by default unless cloned.
```

### 2. Syntax Hints

```rust
// How to declare in Rust:
// let ptr = Box::new(value);
// let mut vec = Vec::new();
//
// Declaration pattern:
// let variable: Type = Type::constructor();
```

## Supported C++ Features

### Smart Pointers
- `std::unique_ptr<T>` → `Box<T>`
- `std::shared_ptr<T>` → `Rc<T>` / `Arc<T>`
- `std::weak_ptr<T>` → `Rc<Weak<T>>` / `Arc<Weak<T>>`

### Containers
- `std::vector<T>` → `Vec<T>`
- `std::array<T, N>` → `[T; N]`
- `std::map<K, V>` → `HashMap<K, V>`

### Optional/Variant
- `std::optional<T>` → `Option<T>`
- `std::variant<T1, T2, ...>` → `enum`
- `std::any` → `Box<dyn Any>`

### Strings
- `std::string` → `String` / `&str`
- `std::string_view` → `&str`

### Type System
- Templates → Generics with trait bounds
- `auto` → Type inference with `let`
- `constexpr` → `const fn`

### C++17/20 Features
- `std::optional`, `std::variant`, `std::string_view`
- Structured bindings
- Concepts (C++20)

### Lambdas & Closures
- Lambda expressions → Closures (`Fn`, `FnMut`, `FnOnce`)

### Move Semantics
- `std::move()` → Implicit move in Rust

### RAII
- Destructors → `Drop` trait

### Concurrency
- `std::thread` → `std::thread::spawn()`
- `std::mutex` → `std::sync::Mutex<T>`
- `std::atomic<T>` → `std::sync::atomic::*`

### Virtual Functions
- `virtual` functions → Traits with dynamic dispatch

## Installation

1. Clone this repository
2. Open the `cpp-to-rust-translator` folder in VS Code
3. Run `npm install`
4. Press `F5` to launch extension development host
5. Install the extension from the Extension view

Or build and install directly:

```bash
npm install
npm run compile
code --install-extension ./cpp-to-rust-translator.vsix
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `cppToRust.autoUpdate` | `true` | Automatically update Rust file as you type |
| `cppToRust.showSyntaxHints` | `true` | Include syntax hints in output |
| `cppToRust.showConceptualMapping` | `true` | Include conceptual mapping comments |
| `cppToRust.sideBySide` | `true` | Open Rust file in side-by-side editor |

## Commands

| Command | Description |
|---------|-------------|
| `C++ to Rust: Translate Current File` | Manually trigger translation of current file |
| `C++ to Rust: Open Rust Editor` | Open/create the Rust file in side-by-side editor |
| `C++ to Rust: Toggle Auto-Update` | Enable/disable automatic updates |

## Usage

1. Open a C++ file (`.cpp`, `.c`, `.hpp`, `.h`, etc.)
2. The extension automatically monitors the file for C++ features
3. A `.rs` file is created in the same directory
4. The Rust file shows detected features with explanations
5. Edit the Rust file to write your own Rust code based on the hints

## Example

**C++ Code:**
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

**Generated Rust Comments:**
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

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Lint
npm run lint

# Build VSIX
npx vsce package
```

## License

MIT
# cpp2rustpal
