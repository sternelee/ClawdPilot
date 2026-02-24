import type { Plugin } from "vite";

export function fixCjsModules(): Plugin {
  return {
    name: "fix-cjs-modules",
    enforce: "pre",

    // Intercept imports to problematic CJS modules
    resolveId(id, importer) {
      // Handle debug module
      if (id === "debug" || id.startsWith("debug/")) {
        return {
          id: "\0virtual:debug-fix",
          external: false,
        };
      }

      // Handle ms module
      if (id === "ms") {
        return {
          id: "\0virtual:ms-fix",
          external: false,
        };
      }

      // Handle extend module
      if (id === "extend" || id === "extend-shallow") {
        return {
          id: "\0virtual:extend-fix",
          external: false,
        };
      }

      // Handle is-plain-obj module
      if (id === "is-plain-obj") {
        return {
          id: "\0virtual:is-plain-obj-fix",
          external: false,
        };
      }

      return null;
    },

    // Provide stub implementations
    load(id) {
      // Debug module stub
      if (id === "\0virtual:debug-fix") {
        return `
          function createDebug(namespace) {
            function debug(...args) {}
            debug.namespace = namespace;
            debug.enabled = false;
            debug.useColors = false;
            return debug;
          }
          createDebug.debug = createDebug;
          createDebug.default = createDebug;
          createDebug.coerce = function(val) { return val; };
          createDebug.disable = function() {};
          createDebug.enable = function() {};
          createDebug.enabled = function() { return false; };
          createDebug.humanize = function(n) { return n + 'ms'; };
          createDebug.names = [];
          createDebug.skips = [];
          createDebug.formatters = {};
          createDebug.selectColor = function() { return 0; };
          export default createDebug;
          export { createDebug };
        `;
      }

      // Ms module stub
      if (id === "\0virtual:ms-fix") {
        return `
          function ms(val) {
            if (typeof val === 'string' && val.length > 0) return parse(val);
            if (typeof val === 'number' && isFinite(val)) return fmt(val);
            throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val));
          }
          function parse(str) {
            str = String(str);
            if (str.length > 100) return;
            var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
            if (!match) return;
            var n = parseFloat(match[1]);
            var type = (match[2] || 'ms').toLowerCase();
            switch (type) {
              case 'years': case 'year': case 'yrs': case 'yr': case 'y': return n * 31557600000;
              case 'weeks': case 'week': case 'w': return n * 604800000;
              case 'days': case 'day': case 'd': return n * 86400000;
              case 'hours': case 'hour': case 'hrs': case 'hr': case 'h': return n * 3600000;
              case 'minutes': case 'minute': case 'mins': case 'min': case 'm': return n * 60000;
              case 'seconds': case 'second': case 'secs': case 'sec': case 's': return n * 1000;
              case 'milliseconds': case 'millisecond': case 'msecs': case 'msec': case 'ms': return n;
            }
            return n;
          }
          function fmt(ms) {
            var long = Math.abs(ms);
            if (long >= 86400000) return Math.round(ms / 86400000) + 'd';
            if (long >= 3600000) return Math.round(ms / 3600000) + 'h';
            if (long >= 60000) return Math.round(ms / 60000) + 'm';
            if (long >= 1000) return Math.round(ms / 1000) + 's';
            return ms + 'ms';
          }
          export default ms;
          export { ms, parse, fmt };
        `;
      }

      // Extend module stub - simple object extension
      if (id === "\0virtual:extend-fix") {
        return `
          function extend() {
            var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {}, i = 1, length = arguments.length, deep = false;
            if (typeof target === 'boolean') { deep = target; target = arguments[i] || {}; i++; }
            if (typeof target !== 'object' && typeof target !== 'function') target = {};
            for (; i < length; i++) {
              if ((options = arguments[i]) != null) {
                for (name in options) {
                  src = target[name]; copy = options[name];
                  if (target === copy) continue;
                  if (deep && copy && (typeof copy === 'object' || (copyIsArray = Array.isArray(copy)))) {
                    if (copyIsArray) { copyIsArray = false; clone = src && Array.isArray(src) ? src : []; }
                    else { clone = src && typeof src === 'object' ? src : {}; }
                    target[name] = extend(deep, clone, copy);
                  } else if (copy !== undefined) {
                    target[name] = copy;
                  }
                }
              }
            }
            return target;
          }
          extend.default = extend;
          export default extend;
          export { extend };
        `;
      }

      // Is-plain-obj module stub
      if (id === "\0virtual:is-plain-obj-fix") {
        return `
          function isPlainObj(value) {
            if (Object.prototype.toString.call(value) !== '[object Object]') return false;
            const prototype = Object.getPrototypeOf(value);
            return prototype === null || prototype === Object.prototype;
          }
          export default isPlainObj;
          export { isPlainObj };
        `;
      }

      return null;
    },
  };
}
