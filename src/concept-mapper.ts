/**
 * Concept Mapper - Maps C++ features to Rust equivalents
 * Includes both conceptual explanations and syntax hints
 */

export interface ConceptMapping {
  cppFeature: string;
  rustEquivalent: string;
  notes: string;
  syntaxHints: string[];
  patterns: RegExp[];
}

export interface DetectedFeature {
  line: number;
  feature: string;
  mapping: ConceptMapping;
}

export const CONCEPT_MAPPINGS: Record<string, ConceptMapping> = {
  // Smart Pointers
  unique_ptr: {
    cppFeature: 'std::unique_ptr<T>',
    rustEquivalent: 'Box<T>',
    notes: 'Exclusive ownership of a dynamically allocated object. Cannot be copied, only moved. Automatically deletes the object when it goes out of scope.',
    syntaxHints: [
      'std::unique_ptr<T> ptr = std::make_unique<T>(value);',
      '→ let ptr = Box::new(value);',
      '',
      'std::unique_ptr<T> ptr; (empty)',
      '→ let ptr: Option<Box<T>> = None;'
    ],
    patterns: [
      /std::unique_ptr\s*<\s*([^>\s]+)\s*>/,
      /std::make_unique\s*</
    ]
  },
  shared_ptr: {
    cppFeature: 'std::shared_ptr<T>',
    rustEquivalent: 'Rc<T> (single-threaded) or Arc<T> (multi-threaded)',
    notes: 'Shared ownership with reference counting. Multiple pointers can own the same object. Object is destroyed when the last shared_ptr is destroyed.',
    syntaxHints: [
      'std::shared_ptr<T> ptr = std::make_shared<T>(value);',
      '→ let ptr = Rc::new(value); (single-threaded)',
      '→ let ptr = Arc::new(value); (multi-threaded)',
      '',
      'To clone shared ownership:',
      '→ ptr.clone()'
    ],
    patterns: [
      /std::shared_ptr\s*<\s*([^>\s]+)\s*>/,
      /std::make_shared\s*</
    ]
  },
  weak_ptr: {
    cppFeature: 'std::weak_ptr<T>',
    rustEquivalent: 'Rc<Weak<T>> or Arc<Weak<T>>',
    notes: 'Non-owning reference to an object managed by shared_ptr. Prevents reference cycles. Must be locked to access the object.',
    syntaxHints: [
      'std::weak_ptr<T> weak = shared_ptr;',
      '→ let weak: Rc<Weak<T>> = Rc::downgrade(&strong);',
      '',
      'To access:',
      '→ if let Some(obj) = weak.upgrade() { ... }'
    ],
    patterns: [
      /std::weak_ptr\s*<\s*([^>\s]+)\s*>/
    ]
  },
  // Containers
  vector: {
    cppFeature: 'std::vector<T>',
    rustEquivalent: 'Vec<T>',
    notes: 'Dynamic array with contiguous memory. Automatically resizes as elements are added. Similar functionality, but Rust Vec has stricter borrowing rules.',
    syntaxHints: [
      'std::vector<int> vec = {1, 2, 3};',
      '→ let vec = vec![1, 2, 3];',
      '',
      'std::vector<int> vec(n);',
      '→ let mut vec = vec![0; n];',
      '',
      'std::vector<int> vec; (empty)',
      '→ let mut vec = Vec::new();',
      '',
      'Access:',
      '→ vec[i] (panics if out of bounds)',
      '→ vec.get(i) (returns Option<T>)'
    ],
    patterns: [
      /std::vector\s*<\s*([^>\s]+)\s*>/
    ]
  },
  array: {
    cppFeature: 'std::array<T, N>',
    rustEquivalent: '[T; N]',
    notes: 'Fixed-size array with bounds checking and STL-like interface. True stack array with known size at compile-time.',
    syntaxHints: [
      'std::array<int, 3> arr = {1, 2, 3};',
      '→ let arr: [i32; 3] = [1, 2, 3];',
      '',
      'std::array<int, N> arr; (default initialized)',
      '→ let arr: [i32; N] = [0; N];'
    ],
    patterns: [
      /std::array\s*<\s*([^>\s]+)\s*,\s*(\d+)\s*>/
    ]
  },
  map: {
    cppFeature: 'std::map<K, V>',
    rustEquivalent: 'std::collections::HashMap<K, V>',
    notes: 'Ordered key-value pairs. HashMap in Rust is unordered but faster. Use BTreeMap for ordered behavior.',
    syntaxHints: [
      'std::map<int, string> mp;',
      '→ use std::collections::HashMap;',
      '→ let mut mp: HashMap<i32, String> = HashMap::new();',
      '',
      'mp[key] = value; (C++)',
      '→ mp.insert(key, value); (Rust)',
      '',
      'Access:',
      '→ mp.get(&key).copied() (returns Option<V>)'
    ],
    patterns: [
      /std::map\s*<\s*([^>\s]+)\s*,\s*([^>\s]+)\s*>/
    ]
  },
  // Optional/Variant
  optional: {
    cppFeature: 'std::optional<T>',
    rustEquivalent: 'Option<T>',
    notes: 'Container that may or may not contain a value. Explicitly represents the possibility of absence. More integrated with Rust pattern matching.',
    syntaxHints: [
      'std::optional<int> opt = 5;',
      '→ let opt: Option<i32> = Some(5);',
      '',
      'std::optional<int> opt = std::nullopt;',
      '→ let opt: Option<i32> = None;',
      '',
      'Access:',
      '→ if (opt) { ... } (C++)',
      '→ if let Some(v) = opt { ... } (Rust)',
      '→ opt.unwrap() or opt.expect("msg")',
      '→ opt.map(|v| v * 2)',
      '→ opt.and_then(|v| ...)'
    ],
    patterns: [
      /std::optional\s*<\s*([^>\s]+)\s*>/,
      /std::nullopt/
    ]
  },
  variant: {
    cppFeature: 'std::variant<T1, T2, ...>',
    rustEquivalent: 'enum (sum type)',
    notes: 'Type-safe union that can hold one of several specified types. Rust enums are more powerful - they can carry data. Use pattern matching to access values.',
    syntaxHints: [
      'std::variant<int, string> var = 5;',
      '→ enum Variant { Int(i32), String(String) }',
      '→ let var = Variant::Int(5);',
      '',
      'std::variant<int, string> var = "hello";',
      '→ let var = Variant::String("hello".to_string());',
      '',
      'Access:',
      '→ std::visit(...) (C++)',
      '→ match var { Variant::Int(v) => ..., Variant::String(s) => ... } (Rust)'
    ],
    patterns: [
      /std::variant\s*<\s*([^>\s]+)\s*(,\s*[^>]+)*\s*>/
    ]
  },
  any: {
    cppFeature: 'std::any::any',
    rustEquivalent: 'Box<dyn Any>',
    notes: 'Type-erased value storage. More type-safe in Rust with downcasting.',
    syntaxHints: [
      'std::any::any(value);',
      '→ use std::any::Any;',
      '→ let any: Box<dyn Any> = Box::new(value);',
      '',
      'Access:',
      '→ any_cast<T>(any) (C++)',
      '→ any.downcast_ref::<T>() (Rust)'
    ],
    patterns: [
      /std::any::any/
    ]
  },
  // Strings
  string: {
    cppFeature: 'std::string',
    rustEquivalent: 'String (owned) or &str (borrowed)',
    notes: 'Rust has two string types: String (owned, mutable) and &str (borrowed slice, immutable). &str is often preferred for function parameters.',
    syntaxHints: [
      'std::string s = "hello";',
      '→ let s = "hello"; (&str)',
      '→ let s: String = "hello".to_string();',
      '→ let s: String = String::from("hello");',
      '',
      'std::string s = "hello";',
      '→ let s: &str = "hello";',
      '',
      'std::string_view sv = s;',
      '→ let sv: &str = &s;',
      '',
      'String operations:',
      "→ s.push('c'); (Rust)",
      '→ s.push_str("world");',
      '→ format!("{} {}", a, b); (like C++ stringstream)'
    ],
    patterns: [
      /std::string\s+\w+/
    ]
  },
  string_view: {
    cppFeature: 'std::string_view',
    rustEquivalent: '&str',
    notes: 'Non-owning reference to a string. Lightweight, does not own data. Rust &str is more type-safe - always valid UTF-8.',
    syntaxHints: [
      'std::string_view sv = str;',
      '→ let sv: &str = &str;',
      '',
      'Function parameter:',
      '→ void f(std::string_view sv) (C++)',
      '→ fn f(sv: &str) (Rust)'
    ],
    patterns: [
      /std::string_view\s+\w+/
    ]
  },
  // Templates
  template_class: {
    cppFeature: 'template<typename T> class/struct',
    rustEquivalent: 'struct/enum with generics',
    notes: 'Compile-time polymorphism. Rust generics are monomorphized at compile-time. More restrictive - require trait bounds.',
    syntaxHints: [
      'template<typename T> class Container { ... };',
      '→ struct Container<T> { ... }',
      '',
      'template<typename T> T max(T a, T b) { ... };',
      '→ fn max<T: Ord>(a: T, b: T) -> T { ... }',
      '',
      'Container<int> c;',
      '→ let c: Container<i32> = Container { ... };'
    ],
    patterns: [
      /template\s*<\s*typename\s+(\w+)\s*>/,
      /template\s*<\s*class\s+(\w+)\s*>/
    ]
  },
  template_function: {
    cppFeature: 'template<typename T> function',
    rustEquivalent: 'generic function with trait bounds',
    notes: 'Generic functions require trait bounds to constrain type parameters.',
    syntaxHints: [
      'template<typename T> void process(T value) { ... };',
      '→ fn process<T>(value: T) { ... }',
      '',
      'template<typename T> T add(T a, T b) { ... };',
      '→ fn add<T: Add<Output=T>>(a: T, b: T) -> T { ... }',
      '',
      'Common trait bounds:',
      '→ T: Clone + Copy',
      '→ T: Debug + Display',
      '→ T: Ord + PartialOrd'
    ],
    patterns: [
      /template\s*<\s*typename\s+(\w+)\s*>\s*(?:\w+\s+)?(\w+)\s*\(/
    ]
  },
  // Lambdas
  lambda: {
    cppFeature: 'Lambda expressions',
    rustEquivalent: 'Closures (Fn, FnMut, FnOnce)',
    notes: 'Anonymous callable objects with capture. Rust closures have three traits based on capture: Fn, FnMut, FnOnce. Type inference determines which.',
    syntaxHints: [
      'auto f = [](int x) { return x * 2; };',
      '→ let f = |x: i32| x * 2;',
      '',
      'auto f = [capture](int x) { return x + capture; };',
      '→ let f = |x| x + capture;',
      '→ let f = move |x: i32| x + capture;',
      '',
      'std::function<int(int)> f = [](int x) { ... };',
      '→ let f: Box<dyn Fn(i32) -> i32> = Box::new(|x| ...);',
      '',
      'Capture modes:',
      '→ [] (no capture)',
      '→ [capture] (copy capture)',
      '→ [capture] (move capture)',
      '→ [capture1, &capture2, move capture3]'
    ],
    patterns: [
      /\[\s*([^]]*)\]\s*\([^)]*\)\s*(const\s*)?\{[^}]*\}/
    ]
  },
  // Move semantics
  move_semantics: {
    cppFeature: 'std::move() / T&&',
    rustEquivalent: 'Implicit move semantics',
    notes: 'Rust moves by default for non-Copy types. No explicit std::move() needed. To copy, explicitly implement Clone and call .clone().',
    syntaxHints: [
      'std::unique_ptr<T> p1 = std::make_unique<T>(5);',
      'std::unique_ptr<T> p2 = std::move(p1);',
      '→ let p1 = Box::new(5);',
      '→ let p2 = p1; (move by default)',
      '→ // p1 is no longer valid',
      '',
      'std::string s1 = "hello";',
      'std::string s2 = std::move(s1);',
      '→ let s1 = String::from("hello");',
      '→ let s2 = s1; (move by default)',
      '',
      'To explicitly copy:',
      '→ let s2 = s1.clone();'
    ],
    patterns: [
      /std::move\s*\(/,
      /(\w+)\s*&&\s*\w+/
    ]
  },
  // RAII
  raii_destructor: {
    cppFeature: 'RAII (destructors ~ClassName())',
    rustEquivalent: 'Drop trait / automatic drop',
    notes: 'Resource lifetime tied to object lifetime. Rust ownership is enforced at compile-time. Rust automatically calls drop() when values go out of scope.',
    syntaxHints: [
      'class Resource { ~Resource() { cleanup(); } };',
      '→ struct Resource { ... }',
      '→ impl Drop for Resource {',
      '→   fn drop(&mut self) { cleanup(); }',
      '→ }',
      '',
      'std::unique_ptr<T> p = std::make_unique<T>();',
      '→ let p = Box::new(T); (auto-drop)',
      '',
      'std::lock_guard<std::mutex> lock(m);',
      '→ let guard = mutex.lock(); (auto-unlock)'
    ],
    patterns: [
      /~\w+\s*\(/
    ]
  },
  // Virtual functions
  virtual_function: {
    cppFeature: 'virtual functions',
    rustEquivalent: 'Traits with dynamic dispatch',
    notes: 'Runtime polymorphism. Use trait objects (&dyn Trait or Box<dyn Trait>). Methods need fn() syntax and &self parameter.',
    syntaxHints: [
      'class Base { virtual void foo() = 0; };',
      '→ trait Base { fn foo(&self); }',
      '',
      'class Derived : Base { void foo() override { ... } };',
      '→ struct Derived; impl Base for Derived { fn foo(&self) { ... } }',
      '',
      'Base* ptr = new Derived();',
      '→ let ptr: Box<dyn Base> = Box::new(Derived);',
      '→ let ptr: &dyn Base = &Derived;',
      '',
      'ptr->foo();',
      '→ ptr.foo();'
    ],
    patterns: [
      /virtual\s+\w+\s*\([^)]*\)\s*(const\s*)?(override|final)?/
    ]
  },
  // Concurrency
  thread: {
    cppFeature: 'std::thread',
    rustEquivalent: 'std::thread::spawn()',
    notes: 'Creates a new thread of execution. Rust lifetime checking ensures borrowed data is not accessed after thread completes.',
    syntaxHints: [
      'std::thread t([]{ ... });',
      '→ use std::thread;',
      '→ let handle = thread::spawn(|| { ... });',
      '',
      't.join();',
      '→ handle.join().unwrap();',
      '',
      'Pass data to thread:',
      '→ thread::spawn(move || { ... data ... });',
      '→ let handle = thread::spawn(move || { ... });'
    ],
    patterns: [
      /std::thread\s+\w+\s*\(/
    ]
  },
  mutex: {
    cppFeature: 'std::mutex',
    rustEquivalent: 'std::sync::Mutex<T>',
    notes: 'Mutual exclusion primitive. Rust Mutex provides direct access to contained value via guard pattern. Guard automatically unlocks on drop.',
    syntaxHints: [
      'std::mutex m;',
      '→ use std::sync::Mutex;',
      '→ let m = Mutex::new(data);',
      '',
      '{',
      '→ std::lock_guard<std::mutex> lock(m);',
      '→ lock->use();',
      '→ }',
      '→ {',
      '→ let mut guard = m.lock().unwrap();',
      '→ guard.use();',
      '→ } (auto-unlock)',
      '',
      'std::shared_mutex (C++17)',
      '→ std::sync::RwLock<T>'
    ],
    patterns: [
      /std::mutex\s+\w+/,
      /std::lock_guard\s*<\s*std::mutex\s*>/,
      /std::shared_mutex\s+\w+/
    ]
  },
  atomic: {
    cppFeature: 'std::atomic<T>',
    rustEquivalent: 'std::sync::atomic::* types',
    notes: 'Lock-free thread-safe operations. Similar API: AtomicBool, AtomicUsize, etc. Ordering constraints (Relaxed, Acquire, Release, AcqRel, SeqCst).',
    syntaxHints: [
      'std::atomic<int> counter(0);',
      '→ use std::sync::atomic::{AtomicI32, Ordering};',
      '→ let counter = AtomicI32::new(0);',
      '',
      'counter++;',
      '→ counter.fetch_add(1, Ordering::SeqCst);',
      '→ counter.store(5, Ordering::SeqCst);',
      '→ counter.load(Ordering::SeqCst);',
      '',
      'Available types:',
      '→ AtomicBool, AtomicI8, AtomicI16, AtomicI32, AtomicI64, AtomicIsize',
      '→ AtomicU8, AtomicU16, AtomicU32, AtomicU64, AtomicUsize'
    ],
    patterns: [
      /std::atomic\s*<\s*(\w+)\s*>\s*\w+/
    ]
  },
  // Filesystem
  filesystem: {
    cppFeature: 'std::filesystem',
    rustEquivalent: 'std::fs and std::path',
    notes: 'Cross-platform file system operations. Rust file operations return Result types that must be handled.',
    syntaxHints: [
      'std::filesystem::path p = "path/to/file";',
      '→ use std::path::Path;',
      '→ let p = Path::new("path/to/file");',
      '',
      'std::filesystem::exists(p);',
      '→ p.exists()',
      '',
      'std::filesystem::read_to_string(p);',
      '→ std::fs::read_to_string(p)?;',
      '',
      'std::filesystem::write(p, content);',
      '→ std::fs::write(p, content)?;'
    ],
    patterns: [
      /std::filesystem::/,
      /#include\s*<filesystem>/
    ]
  },
  // Structured bindings
  structured_bindings: {
    cppFeature: 'Structured bindings (auto [a, b] = ...)',
    rustEquivalent: 'Tuple destructuring',
    notes: 'Decompose tuples/structs into individual variables.',
    syntaxHints: [
      'auto [a, b, c] = get_tuple();',
      '→ let (a, b, c) = get_tuple();',
      '',
      'const auto [x, y] = point;',
      '→ let (x, y) = point;',
      '',
      'Destruct struct:',
      '→ let Struct { a, b } = value;',
      '',
      'Partial destructuring:',
      '→ let (a, ..) = tuple;',
      '→ let [first, rest @ ..] = array;'
    ],
    patterns: [
      /auto\s*\[\s*([^]]+)\s*\]/
    ]
  },
  // Concepts (C++20)
  concepts: {
    cppFeature: 'Concepts (C++20)',
    rustEquivalent: 'Trait bounds',
    notes: 'Constraints on template parameters. Rust traits predate C++ concepts and are more integrated with the language.',
    syntaxHints: [
      'template<typename T> requires Addable<T> void f(T);',
      '→ fn f<T: Addable>(t: T) { ... }',
      '',
      'Concept Addable = requires(T a, T b) { a + b; };',
      '→ trait Addable { fn add(self, other: Self) -> Self; }',
      '',
      'Common constraints:',
      '→ T: Clone + Debug + Display',
      '→ T: Send + Sync',
      '→ T: IntoIterator<Item = i32>'
    ],
    patterns: [
      /concept\s+\w+/
    ]
  }
};

/**
 * Detect C++ features in source code
 */
export function detectFeatures(content: string): DetectedFeature[] {
  const detected: DetectedFeature[] = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const [key, mapping] of Object.entries(CONCEPT_MAPPINGS)) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(line)) {
          detected.push({
            line: lineNum + 1,
            feature: key,
            mapping
          });
          break;
        }
      }
    }
  }

  return detected;
}

/**
 * Generate Rust file content from detected features
 */
export function generateRustContent(
  detectedFeatures: DetectedFeature[],
  includeSyntaxHints: boolean = true,
  includeConceptualMapping: boolean = true
): string {
  const lines: string[] = [];
  const seenFeatures = new Set<string>();

  // Sort by line number
  detectedFeatures.sort((a, b) => a.line - b.line);

  for (const { line, feature, mapping } of detectedFeatures) {
    if (seenFeatures.has(feature)) {
      continue;
    }
    seenFeatures.add(feature);

    // Conceptual mapping
    if (includeConceptualMapping) {
      lines.push(`// C++ Feature Detected: ${mapping.cppFeature}`);
      lines.push(`// Rust Equivalent: ${mapping.rustEquivalent}`);
      lines.push(`// Notes: ${mapping.notes}`);
    }

    // Syntax hints
    if (includeSyntaxHints && mapping.syntaxHints.length > 0) {
      lines.push('');
      lines.push('// How to declare in Rust:');
      for (const hint of mapping.syntaxHints) {
        lines.push(`// ${hint}`);
      }
    }

    lines.push('');
    lines.push('// ---');
    lines.push('');
  }

  if (lines.length === 0) {
    return `// C++ to Rust Translator
// No C++ features detected.
//
// As you write C++ code, this file will automatically update
// with Rust equivalents and syntax hints.
`;
  }

  return `// C++ to Rust Translator
// Generated from C++ code analysis
//
// This file shows Rust equivalents and syntax hints
// for the C++ features detected in your code.
//
${lines.join('\n')}
`;
}
