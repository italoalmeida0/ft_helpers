// Import WASI implementation
importScripts('wasi_defs.js', 'debug.js', 'fd.js', 'wasi.js');

const ESUCCESS = 0;

const _textDecoder = new TextDecoder();
const _textEncoder = new TextEncoder();

function readStr(u8, o, len = -1) {
  let end = u8.length;
  if (len != -1) end = o + len;
  // Find null terminator within the range
  let actualEnd = o;
  for (let i = o; i < end; ++i) {
    if (u8[i] === 0) break;
    actualEnd = i + 1;
  }
  return _textDecoder.decode(u8.subarray(o, actualEnd));
}

function assert(cond) {
  if (!cond) throw new Error('assertion failed');
}

function getImportObject(obj, names) {
  const result = {};
  for (let name of names) {
    result[name] = obj[name].bind(obj);
  }
  return result;
}

function msToSec(start, end) {
  return ((end - start) / 1000).toFixed(2);
}

class ProcExit extends Error {
  constructor(code) {
    super(`process exited with code ${code}`);
    this.code = code;
  }
}

class NotImplemented extends Error {
  constructor(modname, fieldname) {
    super(`${modname}.${fieldname} not implemented`);
  }
}

class Memory {
  constructor(memory) {
    this.memory = memory;
    this.buffer = this.memory.buffer;
    this.u8 = new Uint8Array(this.buffer);
    this.u32 = new Uint32Array(this.buffer);
  }

  check() {
    if (this.buffer.byteLength === 0) {
      this.buffer = this.memory.buffer;
      this.u8 = new Uint8Array(this.buffer);
      this.u32 = new Uint32Array(this.buffer);
    }
  }

  read8(o) { return this.u8[o]; }
  read32(o) { return this.u32[o >> 2]; }
  write8(o, v) { this.u8[o] = v; }
  write32(o, v) { this.u32[o >> 2] = v; }
  write64(o, vlo, vhi = 0) { this.write32(o, vlo); this.write32(o + 4, vhi); }

  readStr(o, len) { return readStr(this.u8, o, len); }

  writeStr(o, str) {
    const bytes = _textEncoder.encode(str);
    const len = this.write(o, bytes);
    this.write8(o + len, 0);
    return len + 1;
  }

  write(o, buf) {
    if (buf instanceof ArrayBuffer) {
      return this.write(o, new Uint8Array(buf));
    } else if (typeof buf === 'string') {
      const bytes = _textEncoder.encode(buf);
      const dst = new Uint8Array(this.buffer, o, bytes.length);
      dst.set(bytes);
      return bytes.length;
    } else {
      const dst = new Uint8Array(this.buffer, o, buf.length);
      dst.set(buf);
      return buf.length;
    }
  }
}

// ==========================================
// STDIN PIPE - SharedArrayBuffer-based
// interactive stdin for WASI programs
// ==========================================
//
// SAB layout (1024 bytes total):
//   [0..3]   (4 bytes)  - STATE: 0=IDLE, 1=DATA_READY, 2=ACK, 3=EOF, 4=CANCEL
//   [4..7]   (4 bytes)  - LEN: number of data bytes
//   [8..1023] (1016 bytes) - DATA buffer
//
// Protocol (worker reads stdin):
//   1. Worker spins on STATE until != IDLE
//   2. If STATE == DATA_READY: read LEN bytes from DATA, set STATE = ACK
//   3. If STATE == EOF: return 0 bytes read (EOF)
//   4. If STATE == CANCEL: throw error (program terminated)
//
// Protocol (main thread writes stdin):
//   1. Wait until STATE == IDLE or STATE == ACK
//   2. Write data to DATA, set LEN, set STATE = DATA_READY
//   3. Wait for STATE == ACK (worker consumed data)
//   4. Set STATE = IDLE
//   5. Repeat or set STATE = EOF when done
//

const STDIN_SAB_SIZE = 1024;
const STDIN_STATE_OFFSET = 0;
const STDIN_LEN_OFFSET = 4;
const STDIN_DATA_OFFSET = 8;
const STDIN_DATA_CAPACITY = STDIN_SAB_SIZE - STDIN_DATA_OFFSET;

const STDIN_STATE_IDLE = 0;
const STDIN_STATE_DATA_READY = 1;
const STDIN_STATE_ACK = 2;
const STDIN_STATE_EOF = 3;
const STDIN_STATE_CANCEL = 4;

class StdinPipe {
  constructor(sab) {
    this.sab = sab;
    this.int32 = new Int32Array(sab);
    this.u8 = new Uint8Array(sab);
  }

  // Called from worker thread: read bytes into a string
  // Returns empty string on EOF, throws on cancel
  readSync() {
    // Spin until data is available
    while (true) {
      const state = Atomics.load(this.int32, STDIN_STATE_OFFSET / 4);
      if (state === STDIN_STATE_DATA_READY) break;
      if (state === STDIN_STATE_EOF) return '';
      if (state === STDIN_STATE_CANCEL) throw new Error('Program terminated by user');
      // IDLE or ACK - wait briefly then retry
      Atomics.wait(this.int32, STDIN_STATE_OFFSET / 4, state, 50);
    }

    const len = Atomics.load(this.int32, STDIN_LEN_OFFSET / 4);
    // Must copy into a non-shared Uint8Array because TextDecoder.decode()
    // rejects views backed by SharedArrayBuffer
    const copy = new Uint8Array(this.u8.subarray(STDIN_DATA_OFFSET, STDIN_DATA_OFFSET + len));
    const str = _textDecoder.decode(copy);

    // Acknowledge
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_ACK);
    Atomics.notify(this.int32, STDIN_STATE_OFFSET / 4);

    return str;
  }

  // Check if EOF has been signaled
  isEOF() {
    return Atomics.load(this.int32, STDIN_STATE_OFFSET / 4) === STDIN_STATE_EOF;
  }

  // Cancel any pending read (called from main thread)
  cancel() {
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_CANCEL);
    Atomics.notify(this.int32, STDIN_STATE_OFFSET / 4);
  }

  // Signal EOF (called from main thread)
  signalEOF() {
    // Wait until worker is idle
    while (true) {
      const state = Atomics.load(this.int32, STDIN_STATE_OFFSET / 4);
      if (state === STDIN_STATE_IDLE || state === STDIN_STATE_ACK) break;
      if (state === STDIN_STATE_EOF || state === STDIN_STATE_CANCEL) return;
      Atomics.wait(this.int32, STDIN_STATE_OFFSET / 4, state, 10);
    }
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_EOF);
    Atomics.notify(this.int32, STDIN_STATE_OFFSET / 4);
  }

  // Reset pipe to idle state
  reset() {
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_IDLE);
    Atomics.store(this.int32, STDIN_LEN_OFFSET / 4, 0);
  }
}

class StdinPipeWriter {
  constructor(sab) {
    this.sab = sab;
    this.int32 = new Int32Array(sab);
    this.u8 = new Uint8Array(sab);
  }

  // Write a string to the pipe (called from main thread)
  write(str) {
    if (!str || str.length === 0) return;

    // Encode the entire string to UTF-8 bytes first
    const bytes = _textEncoder.encode(str);
    let offset = 0;

    while (offset < bytes.length) {
      // Wait until worker is ready for data
      while (true) {
        const state = Atomics.load(this.int32, STDIN_STATE_OFFSET / 4);
        if (state === STDIN_STATE_IDLE || state === STDIN_STATE_ACK) break;
        if (state === STDIN_STATE_EOF || state === STDIN_STATE_CANCEL) return;
        // DATA_READY - worker hasn't consumed yet, wait
        Atomics.wait(this.int32, STDIN_STATE_OFFSET / 4, state, 10);
      }

      // Write chunk
      const remaining = bytes.length - offset;
      const chunkLen = Math.min(remaining, STDIN_DATA_CAPACITY);

      for (let i = 0; i < chunkLen; i++) {
        this.u8[STDIN_DATA_OFFSET + i] = bytes[offset + i];
      }
      offset += chunkLen;

      Atomics.store(this.int32, STDIN_LEN_OFFSET / 4, chunkLen);
      Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_DATA_READY);
      Atomics.notify(this.int32, STDIN_STATE_OFFSET / 4);

      // Wait for ACK
      while (true) {
        const state = Atomics.load(this.int32, STDIN_STATE_OFFSET / 4);
        if (state === STDIN_STATE_ACK) break;
        if (state === STDIN_STATE_EOF || state === STDIN_STATE_CANCEL) return;
        Atomics.wait(this.int32, STDIN_STATE_OFFSET / 4, state, 10);
      }

      // Reset to IDLE
      Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_IDLE);
    }
  }

  // Signal EOF to the worker
  writeEOF() {
    // Wait until worker is idle
    while (true) {
      const state = Atomics.load(this.int32, STDIN_STATE_OFFSET / 4);
      if (state === STDIN_STATE_IDLE || state === STDIN_STATE_ACK) break;
      if (state === STDIN_STATE_EOF || state === STDIN_STATE_CANCEL) return;
      Atomics.wait(this.int32, STDIN_STATE_OFFSET / 4, state, 10);
    }
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_EOF);
    Atomics.notify(this.int32, STDIN_STATE_OFFSET / 4);
  }

  // Cancel any pending read
  cancel() {
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_CANCEL);
    Atomics.notify(this.int32, STDIN_STATE_OFFSET / 4);
  }

  // Reset pipe to idle state
  reset() {
    Atomics.store(this.int32, STDIN_STATE_OFFSET / 4, STDIN_STATE_IDLE);
    Atomics.store(this.int32, STDIN_LEN_OFFSET / 4, 0);
  }
}

class MemFS {
  constructor(options) {
    const compileStreaming = options.compileStreaming;
    this.hostWrite = options.hostWrite;
    this.stdinStr = options.stdinStr || '';
    this.stdinStrPos = 0;
    this.memfsFilename = options.memfsFilename;
    this.stdinPipe = null; // Will be set for interactive mode

    this.hostMem_ = null;

    const env = getImportObject(
      this, ['abort', 'host_write', 'host_read', 'memfs_log', 'copy_in', 'copy_out']
    );

    this.ready = compileStreaming(this.memfsFilename)
      .then(module => WebAssembly.instantiate(module, { env }))
      .then(instance => {
        this.instance = instance;
        this.exports = instance.exports;
        this.mem = new Memory(this.exports.memory);
        this.exports.init();
      });
  }

  set hostMem(mem) { this.hostMem_ = mem; }
  setStdinStr(str) { this.stdinStr = str; this.stdinStrPos = 0; }
  setStdinPipe(pipe) { this.stdinPipe = pipe; }

  addDirectory(path) {
    this.mem.check();
    this.mem.write(this.exports.GetPathBuf(), path);
    this.exports.AddDirectoryNode(_textEncoder.encode(path).length);
  }

  addFile(path, contents) {
    // Convert string contents to UTF-8 bytes to get accurate byte length
    const bytes = (contents instanceof ArrayBuffer) ? new Uint8Array(contents) :
                  (typeof contents === 'string') ? _textEncoder.encode(contents) : contents;
    const length = bytes.length;
    this.mem.check();
    this.mem.write(this.exports.GetPathBuf(), path);
    const inode = this.exports.AddFileNode(_textEncoder.encode(path).length, length);
    const addr = this.exports.GetFileNodeAddress(inode);
    this.mem.check();
    this.mem.write(addr, bytes);
  }

  getFileContents(path) {
    this.mem.check();
    this.mem.write(this.exports.GetPathBuf(), path);
    const inode = this.exports.FindNode(_textEncoder.encode(path).length);
    const addr = this.exports.GetFileNodeAddress(inode);
    const size = this.exports.GetFileNodeSize(inode);
    return new Uint8Array(this.mem.buffer, addr, size);
  }

  abort() { throw new Error('abort'); }

  host_write(fd, iovs, iovs_len, nwritten_out) {
    this.hostMem_.check();
    assert(fd <= 2);
    let size = 0;
    let str = '';
    for (let i = 0; i < iovs_len; ++i) {
      const buf = this.hostMem_.read32(iovs);
      iovs += 4;
      const len = this.hostMem_.read32(iovs);
      iovs += 4;
      str += this.hostMem_.readStr(buf, len);
      size += len;
    }
    this.hostMem_.write32(nwritten_out, size);
    this.hostWrite(str);
    return ESUCCESS;
  }

  host_read(fd, iovs, iovs_len, nread) {
    this.hostMem_.check();
    assert(fd === 0);

    // Hybrid stdin approach:
    // 1. First consume any pre-supplied stdin string (from textarea)
    // 2. Once exhausted, use StdinPipe for interactive input (blocks until data available)
    // This ensures pre-supplied input is available immediately for scanf,
    // and interactive terminal input works after the pre-supplied data is consumed.

    // Phase 1: Read from pre-supplied stdin string first
    // Use UTF-8 byte encoding for stdin data to match WASI expectations
    if (this.stdinStr && this.stdinStrPos < this.stdinStr.length) {
      // Encode the remaining stdin string to UTF-8 bytes
      const remaining = this.stdinStr.substring(this.stdinStrPos);
      const stdinBytes = _textEncoder.encode(remaining);
      let byteOffset = 0;
      let size = 0;
      for (let i = 0; i < iovs_len; ++i) {
        const buf = this.hostMem_.read32(iovs);
        iovs += 4;
        const len = this.hostMem_.read32(iovs);
        iovs += 4;
        const lenToWrite = Math.min(len, stdinBytes.length - byteOffset);
        if (lenToWrite === 0) break;
        const chunk = stdinBytes.subarray(byteOffset, byteOffset + lenToWrite);
        this.hostMem_.write(buf, chunk);
        size += lenToWrite;
        byteOffset += lenToWrite;
        if (lenToWrite !== len) break;
      }
      // Advance stdinStrPos by the number of characters that were fully consumed
      // We need to figure out how many characters the consumed bytes represent
      const consumedBytes = byteOffset;
      const consumedStr = _textDecoder.decode(stdinBytes.subarray(0, consumedBytes));
      this.stdinStrPos += consumedStr.length;
      this.hostMem_.write32(nread, size);
      return ESUCCESS;
    }

    // Phase 2: Pre-supplied stdin exhausted — use interactive StdinPipe
    if (this.stdinPipe) {
      let totalSize = 0;
      for (let i = 0; i < iovs_len; ++i) {
        const buf = this.hostMem_.read32(iovs);
        iovs += 4;
        const len = this.hostMem_.read32(iovs);
        iovs += 4;

        if (totalSize > 0) break; // Only read into first buffer for simplicity

        // Read from pipe (blocks until data available)
        const data = this.stdinPipe.readSync();
        if (data.length === 0) break; // EOF

        // Encode the string data to UTF-8 bytes and write to WASM memory
        const dataBytes = _textEncoder.encode(data);
        const lenToWrite = Math.min(len, dataBytes.length);
        this.hostMem_.write(buf, dataBytes.subarray(0, lenToWrite));
        totalSize += lenToWrite;
      }
      this.hostMem_.write32(nread, totalSize);
      return ESUCCESS;
    }

    // Phase 3: No pipe, no more string data — return 0 (EOF)
    this.hostMem_.write32(nread, 0);
    return ESUCCESS;
  }

  memfs_log(buf, len) {
    this.mem.check();
    console.log(this.mem.readStr(buf, len));
  }

  copy_out(clang_dst, memfs_src, size) {
    this.hostMem_.check();
    const dst = new Uint8Array(this.hostMem_.buffer, clang_dst, size);
    this.mem.check();
    const src = new Uint8Array(this.mem.buffer, memfs_src, size);
    dst.set(src);
  }

  copy_in(memfs_dst, clang_src, size) {
    this.mem.check();
    const dst = new Uint8Array(this.mem.buffer, memfs_dst, size);
    this.hostMem_.check();
    const src = new Uint8Array(this.hostMem_.buffer, clang_src, size);
    dst.set(src);
  }
}

class App {
  constructor(module, memfs, name, ...args) {
    this.argv = [name, ...args];
    this.environ = { USER: 'alice' };
    this.memfs = memfs;

    const wasi_unstable = getImportObject(this, [
      'proc_exit', 'environ_sizes_get', 'environ_get', 'args_sizes_get',
      'args_get', 'random_get', 'clock_time_get', 'poll_oneoff'
    ]);

    Object.assign(wasi_unstable, this.memfs.exports);

    this.ready = WebAssembly.instantiate(module, { wasi_unstable }).then(instance => {
      this.instance = instance;
      this.exports = instance.exports;
      this.mem = new Memory(this.exports.memory);
      this.memfs.hostMem = this.mem;
    });
  }

  async run() {
    await this.ready;
    try {
      this.exports._start();
    } catch (exn) {
      if (exn instanceof ProcExit) {
        if (exn.code === 0) return false;
        throw exn;
      }
      let msg = `\x1b[91mError: ${exn.message}\n${exn.stack}\x1b[0m\n`;
      this.memfs.hostWrite(msg);
      throw exn;
    }
    return false;
  }

  proc_exit(code) { throw new ProcExit(code); }

  environ_sizes_get(environ_count_out, environ_buf_size_out) {
    this.mem.check();
    let size = 0;
    const names = Object.getOwnPropertyNames(this.environ);
    for (const name of names) {
      const value = this.environ[name];
      size += _textEncoder.encode(name).length + _textEncoder.encode(value).length + 2;
    }
    this.mem.write64(environ_count_out, names.length);
    this.mem.write64(environ_buf_size_out, size);
    return ESUCCESS;
  }

  environ_get(environ_ptrs, environ_buf) {
    this.mem.check();
    const names = Object.getOwnPropertyNames(this.environ);
    for (const name of names) {
      this.mem.write32(environ_ptrs, environ_buf);
      environ_ptrs += 4;
      environ_buf += this.mem.writeStr(environ_buf, `${name}=${this.environ[name]}`);
    }
    this.mem.write32(environ_ptrs, 0);
    return ESUCCESS;
  }

  args_sizes_get(argc_out, argv_buf_size_out) {
    this.mem.check();
    let size = 0;
    for (let arg of this.argv) {
      size += _textEncoder.encode(arg).length + 1;
    }
    this.mem.write64(argc_out, this.argv.length);
    this.mem.write64(argv_buf_size_out, size);
    return ESUCCESS;
  }

  args_get(argv_ptrs, argv_buf) {
    this.mem.check();
    for (let arg of this.argv) {
      this.mem.write32(argv_ptrs, argv_buf);
      argv_ptrs += 4;
      argv_buf += this.mem.writeStr(argv_buf, arg);
    }
    this.mem.write32(argv_ptrs, 0);
    return ESUCCESS;
  }

  random_get(buf, buf_len) {
    const data = new Uint8Array(this.mem.buffer, buf, buf_len);
    for (let i = 0; i < buf_len; ++i) {
      data[i] = (Math.random() * 256) | 0;
    }
  }

  clock_time_get(clock_id, precision, time_out) {
    this.mem.check();
    const buffer = new DataView(this.mem.buffer);
    if (clock_id === 0) { // CLOCKID_REALTIME
      buffer.setBigUint64(time_out, BigInt(new Date().getTime()) * 1_000_000n, true);
    } else if (clock_id === 1) { // CLOCKID_MONOTONIC
      let monotonic_time;
      try {
        monotonic_time = BigInt(Math.round(performance.now() * 1000000));
      } catch {
        monotonic_time = 0n;
      }
      buffer.setBigUint64(time_out, monotonic_time, true);
    } else {
      buffer.setBigUint64(time_out, 0n, true);
    }
    return ESUCCESS;
  }

  poll_oneoff(in_ptr, out_ptr, nsubscriptions, nevents_out) {
    // Minimal implementation: support single clock subscription for wasi-libc clock_nanosleep
    if (nsubscriptions === 0) return ESUCCESS;

    this.mem.check();
    const buffer = new DataView(this.mem.buffer);

    // Read subscription
    const userdata = buffer.getBigUint64(in_ptr, true);
    const eventtype = buffer.getUint8(in_ptr + 8);

    if (eventtype === 0) { // EVENTTYPE_CLOCK
      const clockid = buffer.getUint32(in_ptr + 16, true);
      const timeout = buffer.getBigUint64(in_ptr + 24, true);
      const flags = buffer.getUint16(in_ptr + 32, true);

      let getNow;
      if (clockid === 1) { // CLOCKID_MONOTONIC
        getNow = () => BigInt(Math.round(performance.now() * 1_000_000));
      } else if (clockid === 0) { // CLOCKID_REALTIME
        getNow = () => BigInt(new Date().getTime()) * 1_000_000n;
      } else {
        return 28; // ERRNO_INVAL
      }

      const endTime = (flags & 1) ? timeout : getNow() + timeout; // SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME
      while (endTime > getNow()) {
        // block until the timeout is reached
      }

      // Write event
      buffer.setBigUint64(out_ptr, userdata, true);
      buffer.setUint16(out_ptr + 8, 0, true); // ERRNO_SUCCESS
      buffer.setUint8(out_ptr + 10, eventtype);
    }

    if (nevents_out) {
      this.mem.write32(nevents_out, 1);
    }
    return ESUCCESS;
  }
}

// ==========================================
// WASIApp - Full WASI implementation for user programs
// Uses the WASI class with proper Fd-based file descriptors
// ==========================================
class WASIApp {
  constructor(module, memfs, name, ...args) {
    this.argv = [name, ...args];
    this.environ = ['USER=alice'];
    this.memfs = memfs;

    // Build the file descriptor table
    // fd 0 = stdin, fd 1 = stdout, fd 2 = stderr, fd 3 = preopened root directory
    const rootInode = new Inode('/', FILETYPE_DIRECTORY, null);
    const rootDir = new DirectoryFd('/', rootInode);
    const fds = [
      new StdinFd(memfs.stdinPipe, memfs.stdinStr),
      new OutputFd((str) => memfs.hostWrite(str)),
      new OutputFd((str) => memfs.hostWrite(str)),
      rootDir,
    ];

    // Create the WASI instance
    this.wasi = new WASI(this.argv, this.environ, fds);

    // Provide both wasi_snapshot_preview1 and wasi_unstable namespaces
    const importObject = {
      wasi_snapshot_preview1: this.wasi.wasiImport,
      wasi_unstable: this.wasi.wasiImport,
    };

    this.ready = WebAssembly.instantiate(module, importObject).then(instance => {
      this.instance = instance;
      this.exports = instance.exports;
    });
  }

  async run() {
    await this.ready;
    const code = this.wasi.start(this.instance);
    if (code !== 0) {
      throw new ProcExit(code);
    }
    return code;
  }
}

class Tar {
  constructor(buffer) {
    this.u8 = new Uint8Array(buffer);
    this.offset = 0;
  }

  readStr(len) {
    const result = readStr(this.u8, this.offset, len);
    this.offset += len;
    return result;
  }

  readOctal(len) {
    return parseInt(this.readStr(len), 8);
  }

  alignUp() {
    this.offset = (this.offset + 511) & ~511;
  }

  readEntry() {
    if (this.offset + 512 > this.u8.length) {
      return null;
    }

    const entry = {
      filename: this.readStr(100),
      mode: this.readOctal(8),
      owner: this.readOctal(8),
      group: this.readOctal(8),
      size: this.readOctal(12),
      mtim: this.readOctal(12),
      checksum: this.readOctal(8),
      type: this.readStr(1),
      linkname: this.readStr(100),
    };

    if (this.readStr(8) !== 'ustar  ') {
      return null;
    }

    this.readStr(32); // ownerName
    this.readStr(32); // groupName
    this.readStr(8);  // devMajor
    this.readStr(8);  // devMinor
    this.readStr(155); // filenamePrefix
    this.alignUp();

    if (entry.type === '0') {
      entry.contents = this.u8.subarray(this.offset, this.offset + entry.size);
      this.offset += entry.size;
      this.alignUp();
    } else if (entry.type !== '5') {
      assert(false);
    }
    return entry;
  }

  untar(memfs) {
    let entry;
    while ((entry = this.readEntry())) {
      switch (entry.type) {
        case '0':
          memfs.addFile(entry.filename, entry.contents);
          break;
        case '5':
          memfs.addDirectory(entry.filename);
          break;
      }
    }
  }
}

class API {
  constructor(options) {
    this.moduleCache = {};
    this.readBuffer = options.readBuffer;
    this.compileStreaming = options.compileStreaming;
    this.hostWrite = options.hostWrite;
    this.clangFilename = options.clang || 'clang';
    this.lldFilename = options.lld || 'lld';
    this.sysrootFilename = options.sysroot || 'sysroot.tar';
    this.showTiming = options.showTiming || false;

    this.clangCommonArgs = [
      '-disable-free',
      '-isysroot', '/',
      '-internal-isystem', '/include/c++/v1',
      '-internal-isystem', '/include',
      '-internal-isystem', '/lib/clang/8.0.1/include',
      '-ferror-limit', '19',
      '-fmessage-length', '80',
      '-fcolor-diagnostics',
    ];

    this.memfs = new MemFS({
      compileStreaming: this.compileStreaming,
      hostWrite: this.hostWrite,
      memfsFilename: options.memfs || 'memfs',
    });

    this.ready = this.memfs.ready.then(() => this.untar(this.memfs, this.sysrootFilename));
  }

  hostLog(message) {
    const yellowArrow = '\x1b[1;93m>\x1b[0m ';
    this.hostWrite(`${yellowArrow}${message}`);
  }

  async getModule(name) {
    if (this.moduleCache[name]) return this.moduleCache[name];
    const module = await this.compileStreaming(name);
    this.moduleCache[name] = module;
    return module;
  }

  async untar(memfs, filename) {
    await this.memfs.ready;
    await (async () => {
      const tar = new Tar(await this.readBuffer(filename));
      tar.untar(this.memfs);
    })();
  }

  async link(obj, wasm) {
    const stackSize = 1024 * 1024;
    const libdir = 'lib/wasm32-wasi';
    const crt1 = `${libdir}/crt1.o`;
    const compilerRtLib = 'lib/clang/8.0.1/lib/wasi/libclang_rt.builtins-wasm32.a';
    await this.ready;
    const lld = await this.getModule(this.lldFilename);
    return await this.run(
      lld, 'wasm-ld', '--no-threads',
      '--export-dynamic',
      '-z', `stack-size=${stackSize}`, `-L${libdir}`, crt1, obj, '-lc',
      '-lc++', '-lc++abi', compilerRtLib, '-o', wasm
    );
  }

  async run(module, ...args) {
    //this.hostLog(`${args.join(' ')}\n`);
    const start = +new Date();
    const app = new App(module, this.memfs, ...args);
    const instantiate = +new Date();
    await app.run();
    const end = +new Date();
    //this.hostWrite('\n');
    if (this.showTiming) {
      const green = '\x1b[92m';
      const normal = '\x1b[0m';
      let msg = `${green}(${msToSec(start, instantiate)}s`;
      msg += `/${msToSec(instantiate, end)}s)${normal}\n`;
      this.hostWrite(msg);
    }
  }

  // Run a user-compiled WASM program with full WASI support
  async runWASI(module, ...args) {
    const start = +new Date();
    const app = new WASIApp(module, this.memfs, ...args);
    const instantiate = +new Date();
    await app.run();
    const end = +new Date();
    if (this.showTiming) {
      const green = '\x1b[92m';
      const normal = '\x1b[0m';
      let msg = `${green}(${msToSec(start, instantiate)}s`;
      msg += `/${msToSec(instantiate, end)}s)${normal}\n`;
      this.hostWrite(msg);
    }
  }
}

let api = null;
let port = null;
let binaryCache = null;
let stdinPipe = null; // StdinPipe instance for interactive mode

const makeApiOptions = () => ({
  readBuffer(filename) {
    const key = filename;
    if (binaryCache && binaryCache[key]) {
      return Promise.resolve(binaryCache[key]);
    }
    return fetch(filename, { cache: 'no-store' }).then(r => r.arrayBuffer());
  },

  compileStreaming(filename) {
    const key = filename;
    if (binaryCache && binaryCache[key]) {
      return WebAssembly.compile(binaryCache[key]);
    }
    return fetch(filename, { cache: 'no-store' })
      .then(r => r.arrayBuffer())
      .then(buf => WebAssembly.compile(buf));
  },

  hostWrite(s) {
    if (port) port.postMessage({ id: 'write', data: s });
  }
});

const onAnyMessage = async event => {
  try {
    switch (event.data.id) {
      case 'constructor': {
        port = event.data.data.port;
        binaryCache = event.data.data.binaries;
        port.onmessage = onAnyMessage;

        api = new API({
          ...makeApiOptions(),
          clang: '../clang',
          lld: '../lld',
          sysroot: '../sysroot.tar',
          memfs: '../memfs',
        });
        break;
      }

      case 'compileAndRun': {
        const responseId = event.data.responseId;
        let output = '';
        let error = null;
        let originalMemfsWrite = null;
        let runtimeOutput = [];

        try {
          const { code, args, stdin, stdinSAB } = event.data.data || {};

          await api.ready;
          api.memfs.addFile('main.c', code);

          const clang = await api.getModule(api.clangFilename);
          await api.run(clang, 'clang', '-cc1', '-emit-obj',
                        ...api.clangCommonArgs, '-O2', '-o', 'main.o', '-x', 'c', 'main.c');

          await api.link('main.o', 'a.out');

          const buffer = api.memfs.getFileContents('a.out');
          const wasmMod = await WebAssembly.compile(buffer);

          // Set up stdin: hybrid mode — pre-supplied string + interactive pipe
          // IMPORTANT: Set this up BEFORE wrapping hostWrite, so that
          // the stdin pipe is ready when the program starts reading.
          //
          // Hybrid approach: Keep the stdin string as pre-supplied input that
          // is consumed first (immediately available for scanf), then switch
          // to the interactive StdinPipe for terminal input. This prevents
          // the race condition where scanf gets EOF before the user can type.
          if (stdinSAB) {
            stdinPipe = new StdinPipe(stdinSAB);
            api.memfs.setStdinPipe(stdinPipe);
            api.memfs.setStdinStr(stdin || ''); // Pre-supplied stdin consumed first
          } else {
            stdinPipe = null;
            api.memfs.setStdinPipe(null);
            api.memfs.setStdinStr(stdin || '');
          }

          // Now wrap hostWrite for output capture
          originalMemfsWrite = api.memfs.hostWrite;
          api.memfs.hostWrite = (s) => {
            runtimeOutput.push(s);
            originalMemfsWrite(s);
          };

          await api.runWASI(wasmMod, 'a.out', ...args);

          api.memfs.hostWrite = originalMemfsWrite;
          output = runtimeOutput.join('');
        } catch (err) {
          // If the error is from user cancellation, don't treat as error
          if (err.message === 'Program terminated by user') {
            // Normal termination, not an error
          } else {
            error = err.message || String(err);
          }
          if (originalMemfsWrite) {
            api.memfs.hostWrite = originalMemfsWrite;
          }
          output = runtimeOutput ? runtimeOutput.join('') : '';
        } finally {
          stdinPipe = null;
          api.memfs.setStdinPipe(null);
        }

        port.postMessage({ id: 'runAsync', responseId, data: { output, error } });
        break;
      }

      case 'cancelRun': {
        // Cancel any pending stdin read
        if (stdinPipe) {
          stdinPipe.cancel();
        }
        break;
      }

      case 'stdinEOF': {
        // Signal EOF to the stdin pipe
        if (stdinPipe) {
          stdinPipe.signalEOF();
        }
        break;
      }
    }
  } catch (outerErr) {
    if (port) port.postMessage({ id: 'write', data: 'Error: ' + (outerErr.message || String(outerErr)) + '\n' });
  }
};

self.onmessage = onAnyMessage;
