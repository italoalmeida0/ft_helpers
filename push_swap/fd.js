// WASI File Descriptor implementations
// This file is loaded via importScripts() in a Web Worker context
// Depends on: wasi_defs.js, debug.js (must be loaded first)

// ==========================================
// Base Fd class
// ==========================================
class Fd {
  fd_allocate(offset, len) {
    return ERRNO_NOSYS;
  }

  fd_close() {
    return ERRNO_SUCCESS;
  }

  fd_datasync() {
    return ERRNO_NOSYS;
  }

  fd_fdstat_get() {
    return { ret: ERRNO_NOSYS, fdstat: null };
  }

  fd_fdstat_set_flags(flags) {
    return ERRNO_NOSYS;
  }

  fd_fdstat_set_rights(fs_rights_base, fs_rights_inheriting) {
    return ERRNO_NOSYS;
  }

  fd_filestat_get() {
    return { ret: ERRNO_NOSYS, filestat: null };
  }

  fd_filestat_set_size(size) {
    return ERRNO_NOSYS;
  }

  fd_filestat_set_times(atim, mtim, fst_flags) {
    return ERRNO_NOSYS;
  }

  fd_pread(len, offset) {
    return { ret: ERRNO_NOSYS, data: null };
  }

  fd_pwrite(data, offset) {
    return { ret: ERRNO_NOSYS, nwritten: 0 };
  }

  fd_read(len) {
    return { ret: ERRNO_NOSYS, data: null };
  }

  fd_readdir_single(cookie) {
    return { ret: ERRNO_NOSYS, dirent: null };
  }

  fd_seek(offset, whence) {
    return { ret: ERRNO_NOSYS, offset: 0n };
  }

  fd_sync() {
    return ERRNO_NOSYS;
  }

  fd_tell() {
    return { ret: ERRNO_NOSYS, offset: 0n };
  }

  fd_write(data) {
    return { ret: ERRNO_NOSYS, nwritten: 0 };
  }

  fd_prestat_get() {
    return { ret: ERRNO_BADF, prestat: null };
  }

  path_create_directory(path) {
    return ERRNO_NOSYS;
  }

  path_filestat_get(flags, path) {
    return { ret: ERRNO_NOSYS, filestat: null };
  }

  path_filestat_set_times(flags, path, atim, mtim, fst_flags) {
    return ERRNO_NOSYS;
  }

  path_link(path, inode_obj, replace) {
    return ERRNO_NOSYS;
  }

  path_lookup(path, flags) {
    return { ret: ERRNO_NOSYS, inode_obj: null };
  }

  path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
    return { ret: ERRNO_NOSYS, fd_obj: null };
  }

  path_readlink(path) {
    return { ret: ERRNO_NOSYS, data: null };
  }

  path_remove_directory(path) {
    return ERRNO_NOSYS;
  }

  path_rename(old_path, new_fd, new_path) {
    return ERRNO_NOSYS;
  }

  path_symlink(old_path, new_path) {
    return ERRNO_NOSYS;
  }

  path_unlink_file(path) {
    return ERRNO_NOSYS;
  }

  path_unlink(path) {
    return { ret: ERRNO_NOSYS, inode_obj: null };
  }
}

// ==========================================
// Stdin Fd
// ==========================================
class StdinFd extends Fd {
  #stdinPipe;
  #stdinStr;
  #stdinStrPos;

  constructor(stdinPipe, stdinStr) {
    super();
    this.#stdinPipe = stdinPipe || null;
    this.#stdinStr = stdinStr || '';
    this.#stdinStrPos = 0;
  }

  setStdinPipe(pipe) {
    this.#stdinPipe = pipe;
  }

  setStdinStr(str) {
    this.#stdinStr = str;
    this.#stdinStrPos = 0;
  }

  fd_fdstat_get() {
    return {
      ret: ERRNO_SUCCESS,
      fdstat: new Fdstat(
        FILETYPE_CHARACTER_DEVICE,
        0,
        RIGHTS_FD_READ | RIGHTS_FD_SEEK | RIGHTS_FD_TELL | RIGHTS_POLL_FD_READWRITE,
        0n,
      ),
    };
  }

  fd_filestat_get() {
    return {
      ret: ERRNO_SUCCESS,
      filestat: new Filestat(0n, 0n, FILETYPE_CHARACTER_DEVICE, 1, 0n, 0n, 0n, 0n),
    };
  }

  fd_read(len) {
    // Phase 1: Read from pre-supplied stdin string first
    if (this.#stdinStr && this.#stdinStrPos < this.#stdinStr.length) {
      const remaining = this.#stdinStr.substring(this.#stdinStrPos);
      const stdinBytes = new TextEncoder().encode(remaining);
      const data = stdinBytes.subarray(0, Math.min(len, stdinBytes.length));
      const consumedStr = new TextDecoder().decode(stdinBytes.subarray(0, data.length));
      this.#stdinStrPos += consumedStr.length;
      return { ret: ERRNO_SUCCESS, data: new Uint8Array(data) };
    }

    // Phase 2: Pre-supplied stdin exhausted — use interactive StdinPipe
    if (this.#stdinPipe) {
      const data = this.#stdinPipe.readSync();
      if (data.length === 0) {
        // EOF
        return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
      }
      const dataBytes = new TextEncoder().encode(data);
      const result = dataBytes.subarray(0, Math.min(len, dataBytes.length));
      return { ret: ERRNO_SUCCESS, data: new Uint8Array(result) };
    }

    // Phase 3: No pipe, no more string data — return 0 (EOF)
    return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
  }

  fd_pread(len, offset) {
    return this.fd_read(len);
  }
}

// ==========================================
// Stdout/Stderr Fd
// ==========================================
class OutputFd extends Fd {
  #writeCallback;

  constructor(writeCallback) {
    super();
    this.#writeCallback = writeCallback;
  }

  fd_fdstat_get() {
    return {
      ret: ERRNO_SUCCESS,
      fdstat: new Fdstat(
        FILETYPE_CHARACTER_DEVICE,
        FDFLAGS_APPEND,
        RIGHTS_FD_WRITE | RIGHTS_FD_SEEK | RIGHTS_FD_TELL | RIGHTS_POLL_FD_READWRITE,
        0n,
      ),
    };
  }

  fd_filestat_get() {
    return {
      ret: ERRNO_SUCCESS,
      filestat: new Filestat(0n, 0n, FILETYPE_CHARACTER_DEVICE, 1, 0n, 0n, 0n, 0n),
    };
  }

  fd_write(data) {
    const str = new TextDecoder().decode(data);
    this.#writeCallback(str);
    return { ret: ERRNO_SUCCESS, nwritten: data.byteLength };
  }

  fd_pwrite(data, offset) {
    return this.fd_write(data);
  }
}

// ==========================================
// Inode - represents a file system entry
// ==========================================
class Inode {
  constructor(path, filetype, contents) {
    this.path = path;
    this.filetype = filetype;
    this.contents = contents;
    this.children = new Map();
  }
}

// ==========================================
// Directory Fd (for preopened directories)
// ==========================================
class DirectoryFd extends Fd {
  #path;
  #inode;
  #direntCache;

  constructor(path, inode) {
    super();
    this.#path = path;
    this.#inode = inode;
    this.#direntCache = null;
  }

  get path() {
    return this.#path;
  }

  get inode() {
    return this.#inode;
  }

  fd_fdstat_get() {
    return {
      ret: ERRNO_SUCCESS,
      fdstat: new Fdstat(
        FILETYPE_DIRECTORY,
        0,
        RIGHTS_ALL,
        RIGHTS_ALL,
      ),
    };
  }

  fd_prestat_get() {
    const nameBytes = new TextEncoder().encode(this.#path);
    return {
      ret: ERRNO_SUCCESS,
      prestat: new Prestat(PREOPENTYPE_DIR, nameBytes),
    };
  }

  fd_readdir_single(cookie) {
    // Build dirent cache if needed
    if (this.#direntCache === null) {
      this.#direntCache = [];
      let d_next = BigInt(1);
      for (const [name, child] of this.#inode.children) {
        this.#direntCache.push({
          d_next: d_next + 1n,
          d_ino: BigInt(this.#direntCache.length + 1),
          d_type: child.filetype,
          d_namlen: name.length,
          d_name: name,
        });
        d_next += 1n;
      }
    }

    if (cookie === 0n && this.#direntCache.length > 0) {
      const entry = this.#direntCache[0];
      return {
        ret: ERRNO_SUCCESS,
        dirent: new Dirent(entry.d_next, entry.d_ino, entry.d_type, entry.d_namlen, entry.d_name),
      };
    }

    // Find entry with matching cookie (d_next of previous entry)
    for (let i = 0; i < this.#direntCache.length; i++) {
      if (this.#direntCache[i].d_next === cookie + 1n || (cookie > 0n && this.#direntCache[i].d_next === cookie)) {
        const entry = this.#direntCache[i];
        return {
          ret: ERRNO_SUCCESS,
          dirent: new Dirent(entry.d_next, entry.d_ino, entry.d_type, entry.d_namlen, entry.d_name),
        };
      }
    }

    return { ret: ERRNO_SUCCESS, dirent: null };
  }

  path_filestat_get(flags, path) {
    const child = this.#lookup(path);
    if (child === null) {
      return { ret: ERRNO_NOENT, filestat: null };
    }
    const size = child.contents ? child.contents.byteLength : 0;
    return {
      ret: ERRNO_SUCCESS,
      filestat: new Filestat(0n, 0n, child.filetype, 1, BigInt(size), 0n, 0n, 0n),
    };
  }

  path_lookup(path, flags) {
    const child = this.#lookup(path);
    if (child === null) {
      return { ret: ERRNO_NOENT, inode_obj: null };
    }
    return { ret: ERRNO_SUCCESS, inode_obj: child };
  }

  #lookup(path) {
    const parts = path.split('/').filter(p => p !== '');
    let current = this.#inode;
    for (const part of parts) {
      if (!current.children.has(part)) {
        return null;
      }
      current = current.children.get(part);
    }
    return current;
  }

  path_create_directory(path) {
    const parts = path.split('/').filter(p => p !== '');
    const dirName = parts.pop();
    let parent = this.#inode;
    for (const part of parts) {
      if (!parent.children.has(part)) {
        return ERRNO_NOENT;
      }
      parent = parent.children.get(part);
    }
    if (parent.children.has(dirName)) {
      return ERRNO_EXIST;
    }
    parent.children.set(dirName, new Inode(path, FILETYPE_DIRECTORY, null));
    return ERRNO_SUCCESS;
  }

  path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
    wasiDebug.log("path_open:", path);
    const child = this.#lookup(path);

    if (oflags & OFLAGS_CREAT) {
      if (child !== null) {
        if (oflags & OFLAGS_EXCL) {
          return { ret: ERRNO_EXIST, fd_obj: null };
        }
      } else {
        // Create new file
        const newInode = new Inode(path, FILETYPE_REGULAR_FILE, new Uint8Array(0));
        // Add to parent
        const parts = path.split('/').filter(p => p !== '');
        const fileName = parts.pop();
        let parent = this.#inode;
        for (const part of parts) {
          if (!parent.children.has(part)) {
            return { ret: ERRNO_NOENT, fd_obj: null };
          }
          parent = parent.children.get(part);
        }
        parent.children.set(fileName, newInode);
        const fd = new FileFd(path, newInode);
        return { ret: ERRNO_SUCCESS, fd_obj: fd };
      }
    }

    if (child === null) {
      return { ret: ERRNO_NOENT, fd_obj: null };
    }

    if ((oflags & OFLAGS_DIRECTORY) && child.filetype !== FILETYPE_DIRECTORY) {
      return { ret: ERRNO_NOTDIR, fd_obj: null };
    }

    if (oflags & OFLAGS_TRUNC) {
      child.contents = new Uint8Array(0);
    }

    if (child.filetype === FILETYPE_DIRECTORY) {
      return { ret: ERRNO_SUCCESS, fd_obj: new DirectoryFd(path, child) };
    } else {
      return { ret: ERRNO_SUCCESS, fd_obj: new FileFd(path, child) };
    }
  }

  path_unlink_file(path) {
    const parts = path.split('/').filter(p => p !== '');
    const fileName = parts.pop();
    let parent = this.#inode;
    for (const part of parts) {
      if (!parent.children.has(part)) {
        return ERRNO_NOENT;
      }
      parent = parent.children.get(part);
    }
    if (!parent.children.has(fileName)) {
      return ERRNO_NOENT;
    }
    const child = parent.children.get(fileName);
    if (child.filetype === FILETYPE_DIRECTORY) {
      return ERRNO_ISDIR;
    }
    parent.children.delete(fileName);
    return ERRNO_SUCCESS;
  }

  path_remove_directory(path) {
    const parts = path.split('/').filter(p => p !== '');
    const dirName = parts.pop();
    let parent = this.#inode;
    for (const part of parts) {
      if (!parent.children.has(part)) {
        return ERRNO_NOENT;
      }
      parent = parent.children.get(part);
    }
    if (!parent.children.has(dirName)) {
      return ERRNO_NOENT;
    }
    const child = parent.children.get(dirName);
    if (child.filetype !== FILETYPE_DIRECTORY) {
      return ERRNO_NOTDIR;
    }
    if (child.children.size > 0) {
      return ERRNO_NOTEMPTY;
    }
    parent.children.delete(dirName);
    return ERRNO_SUCCESS;
  }

  path_link(path, inode_obj, replace) {
    const parts = path.split('/').filter(p => p !== '');
    const name = parts.pop();
    let parent = this.#inode;
    for (const part of parts) {
      if (!parent.children.has(part)) {
        return ERRNO_NOENT;
      }
      parent = parent.children.get(part);
    }
    if (parent.children.has(name) && !replace) {
      return ERRNO_EXIST;
    }
    parent.children.set(name, inode_obj);
    return ERRNO_SUCCESS;
  }

  path_unlink(path) {
    const parts = path.split('/').filter(p => p !== '');
    const name = parts.pop();
    let parent = this.#inode;
    for (const part of parts) {
      if (!parent.children.has(part)) {
        return { ret: ERRNO_NOENT, inode_obj: null };
      }
      parent = parent.children.get(part);
    }
    if (!parent.children.has(name)) {
      return { ret: ERRNO_NOENT, inode_obj: null };
    }
    const child = parent.children.get(name);
    parent.children.delete(name);
    return { ret: ERRNO_SUCCESS, inode_obj: child };
  }

  path_readlink(path) {
    return { ret: ERRNO_NOSYS, data: null };
  }
}

// ==========================================
// File Fd (for regular files)
// ==========================================
class FileFd extends Fd {
  #path;
  #inode;
  #offset = 0n;

  constructor(path, inode) {
    super();
    this.#path = path;
    this.#inode = inode;
  }

  fd_fdstat_get() {
    return {
      ret: ERRNO_SUCCESS,
      fdstat: new Fdstat(
        FILETYPE_REGULAR_FILE,
        0,
        RIGHTS_FD_READ | RIGHTS_FD_WRITE | RIGHTS_FD_SEEK |
          RIGHTS_FD_TELL | RIGHTS_FD_ADVISE | RIGHTS_FD_ALLOCATE |
          RIGHTS_FD_FILESTAT_GET | RIGHTS_FD_FILESTAT_SET_SIZE,
        0n,
      ),
    };
  }

  fd_read(len) {
    if (this.#inode.contents === null) {
      return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
    }
    const contents = this.#inode.contents;
    const offset = Number(this.#offset);
    if (offset >= contents.byteLength) {
      return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
    }
    const readLen = Math.min(len, contents.byteLength - offset);
    const data = new Uint8Array(contents.buffer || contents, offset, readLen);
    this.#offset += BigInt(readLen);
    return { ret: ERRNO_SUCCESS, data: new Uint8Array(data) };
  }

  fd_pread(len, offset) {
    if (this.#inode.contents === null) {
      return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
    }
    const contents = this.#inode.contents;
    const off = Number(offset);
    if (off >= contents.byteLength) {
      return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
    }
    const readLen = Math.min(len, contents.byteLength - off);
    const data = new Uint8Array(contents.buffer || contents, off, readLen);
    return { ret: ERRNO_SUCCESS, data: new Uint8Array(data) };
  }

  fd_write(data) {
    if (this.#inode.contents === null) {
      this.#inode.contents = new Uint8Array(0);
    }
    const offset = Number(this.#offset);
    const newLen = Math.max(this.#inode.contents.byteLength, offset + data.byteLength);
    const newContents = new Uint8Array(newLen);
    newContents.set(this.#inode.contents, 0);
    newContents.set(data, offset);
    this.#inode.contents = newContents;
    this.#offset = BigInt(offset + data.byteLength);
    return { ret: ERRNO_SUCCESS, nwritten: data.byteLength };
  }

  fd_pwrite(data, offset) {
    if (this.#inode.contents === null) {
      this.#inode.contents = new Uint8Array(0);
    }
    const off = Number(offset);
    const newLen = Math.max(this.#inode.contents.byteLength, off + data.byteLength);
    const newContents = new Uint8Array(newLen);
    newContents.set(this.#inode.contents, 0);
    newContents.set(data, off);
    this.#inode.contents = newContents;
    return { ret: ERRNO_SUCCESS, nwritten: data.byteLength };
  }

  fd_seek(offset, whence) {
    let newOffset;
    if (whence === WHENCE_SET) {
      newOffset = BigInt(offset);
    } else if (whence === WHENCE_CUR) {
      newOffset = this.#offset + BigInt(offset);
    } else if (whence === WHENCE_END) {
      const size = this.#inode.contents ? BigInt(this.#inode.contents.byteLength) : 0n;
      newOffset = size + BigInt(offset);
    } else {
      return { ret: ERRNO_INVAL, offset: 0n };
    }
    this.#offset = newOffset;
    return { ret: ERRNO_SUCCESS, offset: this.#offset };
  }

  fd_tell() {
    return { ret: ERRNO_SUCCESS, offset: this.#offset };
  }

  fd_filestat_get() {
    const size = this.#inode.contents ? BigInt(this.#inode.contents.byteLength) : 0n;
    return {
      ret: ERRNO_SUCCESS,
      filestat: new Filestat(0n, 0n, FILETYPE_REGULAR_FILE, 1, size, 0n, 0n, 0n),
    };
  }

  fd_filestat_set_size(size) {
    if (this.#inode.contents === null) {
      this.#inode.contents = new Uint8Array(0);
    }
    const newContents = new Uint8Array(Number(size));
    newContents.set(this.#inode.contents.subarray(0, Number(size)), 0);
    this.#inode.contents = newContents;
    return ERRNO_SUCCESS;
  }

  fd_allocate(offset, len) {
    const newLen = Number(offset + len);
    if (this.#inode.contents === null) {
      this.#inode.contents = new Uint8Array(newLen);
    } else if (newLen > this.#inode.contents.byteLength) {
      const newContents = new Uint8Array(newLen);
      newContents.set(this.#inode.contents, 0);
      this.#inode.contents = newContents;
    }
    return ERRNO_SUCCESS;
  }
}
