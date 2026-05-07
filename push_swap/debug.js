// Debug utility for WASI
// This file is loaded via importScripts() in a Web Worker context
const wasiDebug = {
  enabled: false,

  enable(flag) {
    if (flag !== undefined) {
      wasiDebug.enabled = !!flag;
    }
  },

  log(...args) {
    if (wasiDebug.enabled) {
      console.log('WASI:', ...args);
    }
  },
};
