# 🛠️ ft_helpers

A collection of interactive playgrounds, visualizers, and debugging tools designed to help students understand, optimize, and test their [42 School](https://42.fr/) projects directly in the browser.

🔗 **Live Platform:** [ft_helpers Home](https://italoalmeida0.github.io/ft_helpers/)

---

## 🚀 Available Tools

### 1. [42 Push Swap Visualizer](https://italoalmeida0.github.io/ft_helpers/push_swap/)
An interactive web-based playground for the 42 `push_swap` project.

**Key Features:**
* **In-Browser Compilation:** Write your C code in the built-in editor and compile it directly in the browser using WebAssembly. No backend required.
* **Real-time Visualization:** Watch your sorting algorithm animate step-by-step between Stack A and Stack B.
* **Manual Controls:** Execute operations (`sa`, `pb`, `ra`, `rrr`, etc.) manually to debug edge cases, complete with a history log, Undo, and Redo capabilities.
* **Validation & Benchmarking:** Automatically checks if Stack A is correctly sorted and grades your algorithm's performance based on the official 42 evaluation criteria (for 100 and 500 random numbers).

### 2. [C Playground](https://italoalmeida0.github.io/ft_helpers/c-playground/)
A general-purpose online C compiler and runtime environment.

**Key Features:**
* **In-Browser Compilation:** Compile and run standard C code directly in the browser using WebAssembly. No backend or installation required.
* **Command-Line Arguments (argv):** Pass custom arguments to your program's `main(int argc, char **argv)` via an easy-to-use input field.
* **Standard Input (stdin):** Provide input data for `scanf()`, `getchar()`, `fgets()`, and other stdin-reading functions.
* **Mobile Friendly:** Fully responsive layout with a mobile-optimized interface, including tab switching between the terminal and input panels.
* **Integrated Terminal:** Real-time program output with an xterm.js terminal emulator.

### 3. [42 Norminette Online](https://italoalmeida0.github.io/ft_helpers/norminette-online/)
An online C style checker and formatter based on the 42 School norminette rules.

**Key Features:**
* **In-Browser Linting:** Check your C code against the official 42 norminette rules directly in the browser using Pyodide. No backend required.
* **Real-time Diagnostics:** See errors and notices with line numbers in an integrated lint panel, with clickable navigation to the exact line in the editor.
* **Automatic Formatting:** Format your code with a built-in C formatter to quickly fix indentation and style issues.
* **42 Header Generator:** Quickly generate standard 42-style file headers with your username and email.
* **Code Persistence:** Your code, filename, and user info are automatically saved to local storage.

---

## 🙏 Special Acknowledgments

Special thanks to the [wasm-clang](https://github.com/binji/wasm-clang) project by binji. It was an essential resource for learning how to compile and run C code directly in the browser.

---

## 📄 License

This project is licensed under the MIT License - Copyright (c) 2026 Italo Almeida.
