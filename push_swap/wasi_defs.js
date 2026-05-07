// WASI constants and data structure definitions
// Based on the WASI specification: https://github.com/WebAssembly/WASI
// This file is loaded via importScripts() in a Web Worker context

// Errno codes
const ERRNO_SUCCESS = 0;
const ERRNO_2BIG = 1;
const ERRNO_ACCES = 2;
const ERRNO_ADDRINUSE = 3;
const ERRNO_ADDRNOTAVAIL = 4;
const ERRNO_AFNOSUPPORT = 5;
const ERRNO_AGAIN = 6;
const ERRNO_ALREADY = 7;
const ERRNO_BADF = 8;
const ERRNO_BADMSG = 9;
const ERRNO_BUSY = 10;
const ERRNO_CANCELED = 11;
const ERRNO_CHILD = 12;
const ERRNO_CONNABORTED = 13;
const ERRNO_CONNREFUSED = 14;
const ERRNO_CONNRESET = 15;
const ERRNO_DEADLK = 16;
const ERRNO_DESTADDRREQ = 17;
const ERRNO_DOM = 18;
const ERRNO_DQUOT = 19;
const ERRNO_EXIST = 20;
const ERRNO_FAULT = 21;
const ERRNO_FBIG = 22;
const ERRNO_HOSTUNREACH = 23;
const ERRNO_IDRM = 24;
const ERRNO_ILSEQ = 25;
const ERRNO_INPROGRESS = 26;
const ERRNO_INTR = 27;
const ERRNO_INVAL = 28;
const ERRNO_IO = 29;
const ERRNO_ISCONN = 30;
const ERRNO_ISDIR = 31;
const ERRNO_LOOP = 32;
const ERRNO_MFILE = 33;
const ERRNO_MLINK = 34;
const ERRNO_MSGSIZE = 35;
const ERRNO_MULTIHOP = 36;
const ERRNO_NAMETOOLONG = 37;
const ERRNO_NETDOWN = 38;
const ERRNO_NETRESET = 39;
const ERRNO_NETUNREACH = 40;
const ERRNO_NFILE = 41;
const ERRNO_NOBUFS = 42;
const ERRNO_NODEV = 43;
const ERRNO_NOENT = 44;
const ERRNO_NOEXEC = 45;
const ERRNO_NOLCK = 46;
const ERRNO_NOLINK = 47;
const ERRNO_NOMEM = 48;
const ERRNO_NOMSG = 49;
const ERRNO_NOPROTOOPT = 50;
const ERRNO_NOSPC = 51;
const ERRNO_NOSYS = 52;
const ERRNO_NOTCONN = 53;
const ERRNO_NOTDIR = 54;
const ERRNO_NOTEMPTY = 55;
const ERRNO_NOTRECOVERABLE = 56;
const ERRNO_NOTSOCK = 57;
const ERRNO_NOTSUP = 58;
const ERRNO_NOTTY = 59;
const ERRNO_NXIO = 60;
const ERRNO_OVERFLOW = 61;
const ERRNO_OWNERDEAD = 62;
const ERRNO_PERM = 63;
const ERRNO_PIPE = 64;
const ERRNO_PROTO = 65;
const ERRNO_PROTONOSUPPORT = 66;
const ERRNO_PROTOTYPE = 67;
const ERRNO_RANGE = 68;
const ERRNO_ROFS = 69;
const ERRNO_SPIPE = 70;
const ERRNO_SRCH = 71;
const ERRNO_STALE = 72;
const ERRNO_TIMEDOUT = 73;
const ERRNO_TXTBSY = 74;
const ERRNO_XDEV = 75;
const ERRNO_NOTCAPABLE = 76;

// Clock IDs
const CLOCKID_REALTIME = 0;
const CLOCKID_MONOTONIC = 1;
const CLOCKID_PROCESS_CPUTIME_ID = 2;
const CLOCKID_THREAD_CPUTIME_ID = 3;

// Event types
const EVENTTYPE_CLOCK = 0;
const EVENTTYPE_FD_READ = 1;
const EVENTTYPE_FD_WRITE = 2;

// Subclock flags
const SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME = 1;

// Fd flags
const FDFLAGS_APPEND = 1;
const FDFLAGS_DSYNC = 2;
const FDFLAGS_NONBLOCK = 4;
const FDFLAGS_RSYNC = 8;
const FDFLAGS_SYNC = 16;

// File descriptor flags
const FDFLAG_READ = 1;
const FDFLAG_WRITE = 2;

// Rights
const RIGHTS_FD_DATASYNC = 1n << 0n;
const RIGHTS_FD_READ = 1n << 1n;
const RIGHTS_FD_SEEK = 1n << 2n;
const RIGHTS_FD_FDSTAT_SET_FLAGS = 1n << 3n;
const RIGHTS_FD_SYNC = 1n << 4n;
const RIGHTS_FD_TELL = 1n << 5n;
const RIGHTS_FD_WRITE = 1n << 6n;
const RIGHTS_FD_ADVISE = 1n << 7n;
const RIGHTS_FD_ALLOCATE = 1n << 8n;
const RIGHTS_PATH_CREATE_DIRECTORY = 1n << 9n;
const RIGHTS_PATH_CREATE_FILE = 1n << 10n;
const RIGHTS_PATH_LINK_SOURCE = 1n << 11n;
const RIGHTS_PATH_LINK_TARGET = 1n << 12n;
const RIGHTS_PATH_OPEN = 1n << 13n;
const RIGHTS_FD_READDIR = 1n << 14n;
const RIGHTS_PATH_READLINK = 1n << 15n;
const RIGHTS_PATH_RENAME_SOURCE = 1n << 16n;
const RIGHTS_PATH_RENAME_TARGET = 1n << 17n;
const RIGHTS_PATH_FILESTAT_GET = 1n << 18n;
const RIGHTS_PATH_FILESTAT_SET_SIZE = 1n << 19n;
const RIGHTS_PATH_FILESTAT_SET_TIMES = 1n << 20n;
const RIGHTS_FD_FILESTAT_GET = 1n << 21n;
const RIGHTS_FD_FILESTAT_SET_SIZE = 1n << 22n;
const RIGHTS_FD_FILESTAT_SET_TIMES = 1n << 23n;
const RIGHTS_PATH_SYMLINK = 1n << 24n;
const RIGHTS_PATH_REMOVE_DIRECTORY = 1n << 25n;
const RIGHTS_PATH_UNLINK_FILE = 1n << 26n;
const RIGHTS_POLL_FD_READWRITE = 1n << 27n;
const RIGHTS_SOCK_SHUTDOWN = 1n << 28n;

// All rights
const RIGHTS_ALL =
  RIGHTS_FD_DATASYNC |
  RIGHTS_FD_READ |
  RIGHTS_FD_SEEK |
  RIGHTS_FD_FDSTAT_SET_FLAGS |
  RIGHTS_FD_SYNC |
  RIGHTS_FD_TELL |
  RIGHTS_FD_WRITE |
  RIGHTS_FD_ADVISE |
  RIGHTS_FD_ALLOCATE |
  RIGHTS_PATH_CREATE_DIRECTORY |
  RIGHTS_PATH_CREATE_FILE |
  RIGHTS_PATH_LINK_SOURCE |
  RIGHTS_PATH_LINK_TARGET |
  RIGHTS_PATH_OPEN |
  RIGHTS_FD_READDIR |
  RIGHTS_PATH_READLINK |
  RIGHTS_PATH_RENAME_SOURCE |
  RIGHTS_PATH_RENAME_TARGET |
  RIGHTS_PATH_FILESTAT_GET |
  RIGHTS_PATH_FILESTAT_SET_SIZE |
  RIGHTS_PATH_FILESTAT_SET_TIMES |
  RIGHTS_FD_FILESTAT_GET |
  RIGHTS_FD_FILESTAT_SET_SIZE |
  RIGHTS_FD_FILESTAT_SET_TIMES |
  RIGHTS_PATH_SYMLINK |
  RIGHTS_PATH_REMOVE_DIRECTORY |
  RIGHTS_PATH_UNLINK_FILE |
  RIGHTS_POLL_FD_READWRITE;

// File types
const FILETYPE_UNKNOWN = 0;
const FILETYPE_BLOCK_DEVICE = 1;
const FILETYPE_CHARACTER_DEVICE = 2;
const FILETYPE_DIRECTORY = 3;
const FILETYPE_REGULAR_FILE = 4;
const FILETYPE_SOCKET_DGRAM = 5;
const FILETYPE_SOCKET_STREAM = 6;
const FILETYPE_SYMBOLIC_LINK = 7;

// OFlags
const OFLAGS_CREAT = 1;
const OFLAGS_DIRECTORY = 2;
const OFLAGS_EXCL = 4;
const OFLAGS_TRUNC = 8;

// Whence
const WHENCE_SET = 0;
const WHENCE_CUR = 1;
const WHENCE_END = 2;

// Preopen type
const PREOPENTYPE_DIR = 0;

// Fstflags
const FSTFLAGS_ATIM = 1;
const FSTFLAGS_ATIM_NOW = 2;
const FSTFLAGS_MTIM = 4;
const FSTFLAGS_MTIM_NOW = 8;

// Lookup flags
const LOOKUPFLAGS_SYMLINK_FOLLOW = 1;

// ==========================================
// WASI Data Structures
// ==========================================

class Iovec {
  constructor(buf, buf_len) {
    this.buf = buf;
    this.buf_len = buf_len;
  }

  static read_bytes(view, ptr) {
    const buf = view.getUint32(ptr, true);
    const buf_len = view.getUint32(ptr + 4, true);
    return new Iovec(buf, buf_len);
  }

  static read_bytes_array(view, ptr, len) {
    const iovecs = [];
    for (let i = 0; i < len; i++) {
      iovecs.push(Iovec.read_bytes(view, ptr + i * 8));
    }
    return iovecs;
  }
}

class Ciovec {
  constructor(buf, buf_len) {
    this.buf = buf;
    this.buf_len = buf_len;
  }

  static read_bytes(view, ptr) {
    const buf = view.getUint32(ptr, true);
    const buf_len = view.getUint32(ptr + 4, true);
    return new Ciovec(buf, buf_len);
  }

  static read_bytes_array(view, ptr, len) {
    const iovecs = [];
    for (let i = 0; i < len; i++) {
      iovecs.push(Ciovec.read_bytes(view, ptr + i * 8));
    }
    return iovecs;
  }
}

class Fdstat {
  constructor(fs_filetype, fs_flags, fs_rights_base, fs_rights_inheriting) {
    this.fs_filetype = fs_filetype;
    this.fs_flags = fs_flags;
    this.fs_rights_base = fs_rights_base;
    this.fs_rights_inheriting = fs_rights_inheriting;
  }

  write_bytes(view, ptr) {
    view.setUint8(ptr, this.fs_filetype);
    view.setUint16(ptr + 2, this.fs_flags, true);
    view.setBigUint64(ptr + 8, this.fs_rights_base, true);
    view.setBigUint64(ptr + 16, this.fs_rights_inheriting, true);
  }

  static read_bytes(view, ptr) {
    const fs_filetype = view.getUint8(ptr);
    const fs_flags = view.getUint16(ptr + 2, true);
    const fs_rights_base = view.getBigUint64(ptr + 8, true);
    const fs_rights_inheriting = view.getBigUint64(ptr + 16, true);
    return new Fdstat(fs_filetype, fs_flags, fs_rights_base, fs_rights_inheriting);
  }

  static size() {
    return 24;
  }
}

class Filestat {
  constructor(st_dev, st_ino, st_filetype, st_nlink, st_size, st_atim, st_mtim, st_ctim) {
    this.st_dev = st_dev;
    this.st_ino = st_ino;
    this.st_filetype = st_filetype;
    this.st_nlink = st_nlink;
    this.st_size = st_size;
    this.st_atim = st_atim;
    this.st_mtim = st_mtim;
    this.st_ctim = st_ctim;
  }

  write_bytes(view, ptr) {
    view.setBigUint64(ptr, this.st_dev, true);
    view.setBigUint64(ptr + 8, this.st_ino, true);
    view.setUint8(ptr + 16, this.st_filetype);
    view.setUint32(ptr + 20, this.st_nlink, true);
    view.setBigUint64(ptr + 24, this.st_size, true);
    view.setBigUint64(ptr + 32, this.st_atim, true);
    view.setBigUint64(ptr + 40, this.st_mtim, true);
    view.setBigUint64(ptr + 48, this.st_ctim, true);
  }

  static size() {
    return 56;
  }
}

class Prestat {
  constructor(pr_type, pr_name) {
    this.inner = { pr_type, pr_name };
  }

  write_bytes(view, ptr) {
    view.setUint8(ptr, this.inner.pr_type);
    view.setUint32(ptr + 4, this.inner.pr_name.byteLength, true);
  }

  static size() {
    return 8;
  }
}

class Dirent {
  constructor(d_next, d_ino, d_type, d_namlen, d_name) {
    this.d_next = d_next;
    this.d_ino = d_ino;
    this.d_type = d_type;
    this.d_namlen = d_namlen;
    this.d_name = d_name;
  }

  head_length() {
    return 24;
  }

  name_length() {
    return this.d_name.length;
  }

  write_head_bytes(view, ptr) {
    view.setBigUint64(ptr, this.d_next, true);
    view.setBigUint64(ptr + 8, this.d_ino, true);
    view.setUint32(ptr + 16, this.d_type, true);
    view.setUint32(ptr + 20, this.d_namlen, true);
  }

  write_name_bytes(buffer8, ptr, max_len) {
    const name = new TextEncoder().encode(this.d_name);
    const len = Math.min(name.length, max_len);
    buffer8.set(name.subarray(0, len), ptr);
  }
}

class Subscription {
  constructor(userdata, eventtype, clockid, timeout, flags) {
    this.userdata = userdata;
    this.eventtype = eventtype;
    this.clockid = clockid;
    this.timeout = timeout;
    this.flags = flags;
  }

  static read_bytes(view, ptr) {
    const userdata = view.getBigUint64(ptr, true);
    const eventtype = view.getUint8(ptr + 8);
    let clockid = 0;
    let timeout = 0n;
    let flags = 0;
    if (eventtype === EVENTTYPE_CLOCK) {
      clockid = view.getUint32(ptr + 16, true);
      timeout = view.getBigUint64(ptr + 24, true);
      flags = view.getUint16(ptr + 32, true);
    }
    return new Subscription(userdata, eventtype, clockid, timeout, flags);
  }
}

class WASIEvent {
  constructor(userdata, error, eventtype) {
    this.userdata = userdata;
    this.error = error;
    this.eventtype = eventtype;
  }

  write_bytes(view, ptr) {
    view.setBigUint64(ptr, this.userdata, true);
    view.setUint16(ptr + 8, this.error, true);
    view.setUint8(ptr + 10, this.eventtype);
  }
}
