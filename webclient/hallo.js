var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/utils/string.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Utf16Util;

  exports.escapeHTML = function(str) {
    return str.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  };

  Utf16Util = (function() {

    function Utf16Util() {}

    Utf16Util.REPLACEMENT_CHARACTER = String.fromCharCode(0xFFFD);

    Utf16Util.CHAR_TYPE = {
      BIDI: 'BIDI',
      CONTROL: 'CONTROL',
      DEPRECATED: 'DEPRECATED',
      NONCHARACTER: 'NONCHARACTER',
      OK: 'OK',
      SUPPLEMENTARY: 'SUPPLEMENTARY',
      SURROGATE: 'SURROGATE',
      TAG: 'TAG'
    };

    Utf16Util.isControl = function(cp) {
      /*
              Проверяет является ли codepoint упраляющим символом
      */      return (0 <= cp && cp <= 0x1F) || (0x7F <= cp && cp <= 0x9F);
    };

    Utf16Util.isSurrogate = function(cp) {
      /*
              Проверяет является ли codepoint суррогатным символом (обязательно состоящим из пары)
              @param c: int - строка из одного символа
              @returns: boolean
      */      return (0xD800 <= cp && cp <= 0xDFFF);
    };

    Utf16Util.isLowSurrogate = function(cp) {
      return (0xDC00 <= cp && cp <= 0xDFFF);
    };

    Utf16Util.isHighSurrogate = function(cp) {
      return (0xD800 <= cp && cp < 0xDC00);
    };

    Utf16Util.isSupplementary = function(cp) {
      /*
              Проверяет является ли codepoint символом в дополнительной таблице
      */      return cp >= 0x10000;
    };

    Utf16Util.isCodePoint = function(cp) {
      /*
              Проверяет является ли аргумент codepoint'ом
      */      return (0 <= cp && cp <= 0x10FFFF);
    };

    Utf16Util.isBidi = function(cp) {
      /*
              Проверяет является ли codepoint символом bidi формата
      */      if (cp === 0x200E || cp === 0x200F) return true;
      return (0x202A <= cp && cp <= 0x202E);
    };

    Utf16Util.isDeprecated = function(cp) {
      return (0x206A <= cp && cp <= 0x206F);
    };

    Utf16Util.isValid = function(cp) {
      /*
              Проверяет валидность символа
              @param cp: int - строка из одного символа
              @returns: boolean - true, если символ валидный, false, если это non-character символ
      */
      var d;
      if (!this.isCodePoint(cp)) return false;
      d = cp & 0xFFFF;
      if (d === 0xFFFE || d === 0xFFFF) return false;
      if ((0xFDD0 <= cp && cp <= 0xFDEF)) return false;
      return true;
    };

    Utf16Util.getCharType = function(c) {
      var cp;
      cp = c.charCodeAt(0);
      if (!this.isValid(cp)) return this.CHAR_TYPE.NONCHARACTER;
      if (this.isControl(cp)) return this.CHAR_TYPE.CONTROL;
      if (this.isSurrogate(cp)) return this.CHAR_TYPE.SURROGATE;
      if (this.isDeprecated(cp)) return this.CHAR_TYPE.DEPRECATED;
      if (this.isBidi(cp)) return this.CHAR_TYPE.BIDI;
      if (this.isSupplementary(cp)) return this.CHAR_TYPE.SUPPLEMENTARY;
      return this.CHAR_TYPE.OK;
    };

    Utf16Util.unpairedSurrogate = function(c) {
      return Utf16Util.REPLACEMENT_CHARACTER;
    };

    Utf16Util.traverseString = function(str) {
      /*
              Traverse UTF16 string
      */
      var c, i, res, _len;
      res = '';
      for (i = 0, _len = str.length; i < _len; i++) {
        c = str[i];
        switch (this.getCharType(c)) {
          case this.CHAR_TYPE.OK:
            res += c;
            break;
          case this.CHAR_TYPE.CONTROL:
          case this.CHAR_TYPE.BIDI:
          case this.CHAR_TYPE.DEPRECATED:
            continue;
          default:
            res += this.REPLACEMENT_CHARACTER;
        }
      }
      return res;
    };

    return Utf16Util;

  })();

  exports.Utf16Util = Utf16Util;

}).call(this);

});

require.define("/utils/dom.coffee", function (require, module, exports, __dirname, __filename) {
(function() {

  /*
  Вспомогательные функции для работы с DOM
  */

  var ANCHOR_ATTRIBUTES, ANCHOR_TAG, BLOCK_TAG, CHILD_STATES, NEW_LINE_TAG, TEXT_NODE, TEXT_STATE, addClass, blockTags, changeCursorAfterDeletion, contains, cursorIsAtTheEndOfBlockNode, cursorIsAtTheEndOfNode, cursorIsAtTheStartOfBlockNode, cursorIsAtTheStartOfNode, getCursor, getCursorAtTheEndOf, getCursorToTheLeftOf, getDeepestCursorPos, getDeepestFirstChild, getDeepestFirstNode, getDeepestLastChild, getDeepestLastNode, getDeepestNodeAfterCursor, getDeepestNodeBeforeCursor, getEmptyBlock, getNearestNextNode, getNearestPreviousNode, getNodeAndNextSiblings, getNodeIndex, getNonBlockNodes, getParentBlockNode, getParentOffset, getPosition, getRange, inlineTags, insertInlineNodeByRange, insertNextTo, isAnchorNode, isBlockNode, isDefaultBlockNode, isEmptyBlock, isInlineNode, isNewLine, isTextNode, mergeParagraphs, moveChildNodesNextTo, moveChildNodesToEnd, moveNodesBefore, moveNodesNextTo, moveNodesToEnd, moveNodesToStart, nodeIs, removeClass, replaceContainer, setCursor, setFullRange, setRange, splitParagraph, wrapInBlockNode;

  jQuery.fn.center = function() {
    this.css("position", "absolute");
    this.css("top", (($(window).height() - this.outerHeight()) / 2) + $(window).scrollTop() + "px");
    this.css("left", (($(window).width() - this.outerWidth()) / 2) + $(window).scrollLeft() + "px");
    return this;
  };

  blockTags = module.exports.blockTags = {
    div: null,
    p: null,
    h1: null,
    h2: null,
    h3: null,
    h4: null,
    table: null
  };

  inlineTags = module.exports.inlineTags = {
    a: null
  };

  BLOCK_TAG = module.exports.BLOCK_TAG = 'div';

  NEW_LINE_TAG = module.exports.NEW_LINE_TAG = 'br';

  TEXT_NODE = module.exports.TEXT_NODE = '#text';

  TEXT_STATE = module.exports.TEXT_STATE = 'text';

  CHILD_STATES = module.exports.CHILD_STATES = 'childStates';

  ANCHOR_TAG = exports.ANCHOR_TAG = 'a';

  ANCHOR_ATTRIBUTES = exports.ANCHOR_ATTRIBUTES = {
    'href': null,
    'target': null
  };

  isTextNode = module.exports.isTextNode = function(node) {
    /*
        Возвращает true, если указанный узел является текстовой
        @param node: HTMLNode
        @return: boolean
    */    return node.nodeName.toLowerCase() === TEXT_NODE;
  };

  isBlockNode = module.exports.isBlockNode = function(node) {
    /*
        Возвращает true, если указанный узел является блочным
        @param node: HTMLNode
        @return: boolean
    */    return node.nodeName.toLowerCase() in blockTags;
  };

  isDefaultBlockNode = module.exports.isDefaultBlockNode = function(node) {
    /*
        Возвращает true, если указанный узел является блочным "по умолчанию" (div)
        @param node: HTMLNode
        @return: boolean
    */
    var _ref;
    return ((_ref = node.tagName) != null ? _ref.toLowerCase() : void 0) === BLOCK_TAG;
  };

  isNewLine = module.exports.isNewLine = function(node) {
    /*
        Возвращает true, если указанный узел является переносом строки
        @param node: HTMLNode
        @return: boolean
    */    return node.nodeName.toLowerCase() === NEW_LINE_TAG;
  };

  isInlineNode = module.exports.isInlineNode = function(node) {
    /*
        Возвращает true, если указанный узел является inline
        @param node: HTMLNode
        @return: boolean
    */    return node.nodeName.toLowerCase() in inlineTags;
  };

  isAnchorNode = exports.isAnchorNode = function(node) {
    /*
        Возвращает true, если указанный узел является anchor
        @param node: HTMLNode
        @return: boolean
    */
    var _ref;
    return ((_ref = node.nodeName) != null ? _ref.toLowerCase() : void 0) === ANCHOR_TAG;
  };

  nodeIs = module.exports.nodeIs = function(node, name) {
    /*
        Возвращает true, если указанный узел является name
        @param node: HTMLNode
        @param name: string, имя ноды в маленьком регистре
    */    return node.nodeName.toLowerCase() === name;
  };

  insertNextTo = module.exports.insertNextTo = function(node, nextTo) {
    /*
        Вставляет узел после указанного
        Возвращает вставленный узел
        @param node: HTMLNode
        @param nextTo: HTMLNode
        @return: HTMLNode
    */
    var parentNode, siblingNode;
    parentNode = nextTo.parentNode;
    siblingNode = nextTo != null ? nextTo.nextSibling : void 0;
    if (siblingNode) {
      parentNode.insertBefore(node, siblingNode);
    } else {
      parentNode.appendChild(node);
    }
    return node;
  };

  insertInlineNodeByRange = module.exports.insertInlineNode = function(range, inlineNode, topNode) {
    var clonedNode, container, curNode, nextNode, parentNode, rightNode;
    if (!range) return;
    container = range.endContainer;
    if (!container) return;
    if (!isTextNode(container)) {
      container || (container = topNode);
      if ((container.lastChild != null) && isNewLine(container.lastChild)) {
        container.removeChild(container.lastChild);
      }
      return container.appendChild(inlineNode);
    } else {
      curNode = range.startContainer;
      parentNode = curNode.parentNode;
      if (range.startOffset === 0) {
        if (isBlockNode(parentNode)) {
          parentNode.insertBefore(inlineNode, curNode);
        } else {
          parentNode.parentNode.insertBefore(inlineNode, parentNode);
        }
        return;
      }
      if (range.startOffset === curNode.textContent.length) {
        if (isBlockNode(parentNode)) {
          insertNextTo(inlineNode, curNode);
        } else {
          insertNextTo(inlineNode, parentNode);
        }
        return;
      }
      container.splitText(range.endOffset);
      rightNode = curNode.nextSibling;
      if (!isBlockNode(parentNode)) {
        clonedNode = parentNode.cloneNode(false);
        while (rightNode) {
          nextNode = rightNode.nextSibling;
          clonedNode.appendChild(rightNode);
          rightNode = nextNode;
        }
        insertNextTo(clonedNode, parentNode);
        return clonedNode.parentNode.insertBefore(inlineNode, clonedNode);
      } else {
        return insertNextTo(inlineNode, curNode);
      }
    }
  };

  wrapInBlockNode = module.exports.wrapInBlockNode = function(nodes) {
    /*
        Оборачивает указанную ноду или массив нод в блочный контейнер
        @param nodes: [HTMLNode]
        @param nodes: HTMLNode
        @return: HTMLNode
    */
    var container, node, _i, _len;
    if (!(nodes instanceof Array)) nodes = [nodes];
    container = document.createElement(BLOCK_TAG);
    for (_i = 0, _len = nodes.length; _i < _len; _i++) {
      node = nodes[_i];
      container.appendChild(node);
    }
    return container;
  };

  moveNodesNextTo = module.exports.moveNodesNextTo = function(nodes, nextTo) {
    /*
        Переносит указанные узлы вслед за nextTo
        @param nodes: HTMLNode
        @param nodes: [HTMLNode]
        @param nextTo: HTMLNode
    */
    var node, _i, _len, _results;
    if (!(nodes instanceof Array)) nodes = [nodes];
    _results = [];
    for (_i = 0, _len = nodes.length; _i < _len; _i++) {
      node = nodes[_i];
      insertNextTo(node, nextTo);
      _results.push(nextTo = node);
    }
    return _results;
  };

  moveChildNodesToEnd = module.exports.moveChildNodesToEnd = function(toNode, fromNode) {
    /*
        Переносит узлы из одной вершины в конец другой
        @param toNode: HTMLNode, узел-приемник
        @param fromNode: [HTMLNode], узел-источник
    */
    var childNode, nextChild, _results;
    childNode = fromNode.firstChild;
    _results = [];
    while (childNode) {
      nextChild = childNode.nextSibling;
      toNode.appendChild(childNode);
      _results.push(childNode = nextChild);
    }
    return _results;
  };

  moveNodesToEnd = module.exports.moveNodesToEnd = function(toNode, nodes) {
    /*
        Переносит указанные узлы в конец указанной вершины
        @param toNode: HTMLNode, узел-приемник
        @param nodes: [HTMLNode], переносимые узлы
    */
    var node, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = nodes.length; _i < _len; _i++) {
      node = nodes[_i];
      _results.push(toNode.appendChild(node));
    }
    return _results;
  };

  moveNodesToStart = module.exports.moveNodesToStart = function(toNode, nodes) {
    /*
        Переносит указанные узлы в начало указанной вершины
        @param toNode: HTMLNode, узел-приемни
        @param nodes: [HTMLNode], переносимые узлы
    */
    var firstChild, node, _i, _len, _results;
    firstChild = toNode.firstChild;
    if (!firstChild) {
      moveNodesToEnd(toNode, nodes);
      return;
    }
    _results = [];
    for (_i = 0, _len = nodes.length; _i < _len; _i++) {
      node = nodes[_i];
      _results.push(toNode.insertBefore(node, firstChild));
    }
    return _results;
  };

  moveChildNodesNextTo = module.exports.moveChildNodesNextTo = function(nextToNode, fromNode) {
    /*
        Вставляет узлы из одной вершины после другой
        @param nextToNode: HTMLNode, узел, после которого вставлять
        @param fromNode: HTMLNode, узел, детей которого переносить
    */
    var curNode, _results;
    _results = [];
    while (fromNode.firstChild) {
      curNode = fromNode.firstChild;
      insertNextTo(fromNode.firstChild, nextToNode);
      _results.push(nextToNode = curNode);
    }
    return _results;
  };

  moveNodesBefore = module.exports.moveNodesBefore = function(nodes, beforeNode) {
    var node, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = nodes.length; _i < _len; _i++) {
      node = nodes[_i];
      _results.push(beforeNode.parentNode.insertBefore(node, beforeNode));
    }
    return _results;
  };

  replaceContainer = module.exports.replaceContainer = function(oldNode, newNode) {
    /*
        Заменяет узел на другой, сохраняя все дочерние узлы
        @param oldNode: HTMLNode
        @param newNode: HTMLNode
    */    moveChildNodesToEnd(newNode, oldNode);
    insertNextTo(newNode, oldNode);
    if (oldNode.parentNode) return oldNode.parentNode.removeChild(oldNode);
  };

  getNonBlockNodes = module.exports.getNonBlockNodes = function(startNode) {
    /*
        Возвращает все неблочные ноды, начиная с указанной и заканчивая первой
        блочной нодой
        @param startNode: HTMLNode
        @return [HTMLNode]
    */
    var curNode, res;
    res = [];
    curNode = startNode;
    while (curNode) {
      if (isBlockNode(curNode)) break;
      res.push(curNode);
      curNode = curNode.nextSibling;
    }
    return res;
  };

  getNodeAndNextSiblings = module.exports.getNodeAndNextSiblings = function(node) {
    /*
        Возвращает всех "правых" соседей ноды (nextSibling)
        @param node: HTMLNode
        @return [HTMLNode]
    */
    var res;
    res = [];
    while (node) {
      res.push(node);
      node = node.nextSibling;
    }
    return res;
  };

  getNearestPreviousNode = module.exports.getNearestPreviousNode = function(node, nodeToStop) {
    /*
        Возвращает соседа слева. Если такового нет, возвращает соседа слева от родителя,
        и так далее вплоть до nodeToStop
        @param node: HTMLNode
        @param nodeToStop: HTMLNode
        @return: HTMLNode|null
    */    if (node === nodeToStop) return null;
    if (node.previousSibling) return node.previousSibling;
    return getNearestPreviousNode(node.parentNode, nodeToStop);
  };

  getNearestNextNode = module.exports.getNearestNextNode = function(node, nodeToStop) {
    /*
        Возвращает соседа справа. Если такового нет, возвращает соседа справа от родителя,
        и так далее вплоть до nodeToStop
        @param node: HTMLNode
        @param nodeToStop: HTMLNode
        @return: HTMLNode|null
    */    if (node === nodeToStop) return null;
    if (node.nextSibling) return node.nextSibling;
    return getNearestNextNode(node.parentNode, nodeToStop);
  };

  getCursorAtTheEndOf = module.exports.getCursorAtTheEndOf = function(node) {
    /*
        Возвращает положение курсора в конце указанной ноды
        @param node: HTMLNode
        @return: [HTMLNode, int]
    */    if (isTextNode(node)) return [node, node.textContent.length];
    return getDeepestCursorPos([node, node.childNodes.length]);
  };

  getNodeIndex = exports.getNodeIndex = function(node) {
    var child, offset, parent, _i, _len, _ref;
    parent = node.parentNode;
    offset = 0;
    _ref = parent.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child === node) break;
      offset++;
    }
    return offset;
  };

  getCursorToTheLeftOf = module.exports.getCursorToTheLeftOf = function(node) {
    /*
        Возвращает положение курсора слева от указанной ноды (указанная нода
        в положении будет отстутсвовать)
        @param node: HTMLNode
        @return: [HTMLNode, int]
    */
    var child, offset, parent, prev, _i, _len, _ref;
    prev = node.previousSibling;
    if (!prev) return [node.parentNode, 0];
    if (prev.contentEditable !== 'false') return getCursorAtTheEndOf(prev);
    parent = node.parentNode;
    offset = 0;
    _ref = parent.childNodes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child === node) break;
      offset++;
    }
    return [parent, offset];
  };

  getDeepestFirstNode = module.exports.getDeepestFirstNode = function(node) {
    /*
        Возвращает самого вложенного из первых наследников указнной ноды
        Возвращает саму ноду, если у нее нет наследников
        Не заходит внутрь нод, у которых contentEditable == false
    */    if (node.contentEditable === 'false') return node;
    if (!node.firstChild) return node;
    return getDeepestFirstNode(node.firstChild);
  };

  getDeepestLastNode = module.exports.getDeepestLastNode = function(node) {
    /*
        Возвращает самого вложенного из последних наследников указнной ноды
        Возвращает саму ноду, если у нее нет наследников
        Не заходит внутрь нод, у которых contentEditable == false
        @param node: HTMLNode
        @return: HTMLNode
    */    if (node.contentEditable === 'false') return node;
    if (!node.lastChild) return node;
    return getDeepestLastNode(node.lastChild);
  };

  contains = module.exports.contains = function(container, selectedNode) {
    /*
        Возврващает true, если selectedNode содержится внутри container
        @param container: HTMLElement
        @param selectedNode: HTMLElement
        @return: boolean
    */    return !!(container.compareDocumentPosition(selectedNode) & Node.DOCUMENT_POSITION_CONTAINED_BY);
  };

  getDeepestCursorPos = module.exports.getDeepestCursorPos = function(cursor) {
    /*
        Возвращает положение курсора, указывающее на самую вложенную ноду в переданном положении
        Не возвращает курсор, указывающий на нередактируемый элемент
        @param cursor: [HTMLNode, int]
        @return: [HTMLNode, int]
    */
    var node, offset, parent;
    node = cursor[0], offset = cursor[1];
    if (isTextNode(node)) return [node, offset];
    if (offset === node.childNodes.length) {
      node = getDeepestLastNode(node);
      if (node.contentEditable === 'false') {
        parent = node.parentNode;
        return [parent, parent.childNodes.length];
      }
      return [node, node.childNodes.length];
    }
    node = getDeepestFirstNode(node.childNodes[offset]);
    if (node.contentEditable === 'false') {
      parent = node.parentNode;
      if (parent === cursor[0]) {
        return [parent, offset];
      } else {
        return [parent, 0];
      }
    }
    return [node, 0];
  };

  cursorIsAtTheEndOfNode = module.exports.cursorIsAtTheEndOfNode = function(cursor) {
    /*
        Возвращает true, если курсор указывает на конец ноды
        @param cursor: [HTMLNode, int]
        @return: boolean
    */    if (isTextNode(cursor[0])) {
      if (!(cursor[1] === cursor[0].textContent.length)) return false;
    } else {
      if (!(cursor[1] === cursor[0].childNodes.length)) return false;
    }
    return true;
  };

  cursorIsAtTheEndOfBlockNode = module.exports.cursorIsAtTheEndOfBlockNode = function(cursor) {
    /*
        Возвращает true, если курсор указывает на конец блочной ноды
        Вернет true, если курсор находится перед тегом br в конце параграфа 
        @param cursor: [HTMLNode, int]
        @return: boolean
    */
    var next, node, offset;
    node = cursor[0], offset = cursor[1];
    if (isTextNode(node)) {
      if (offset < node.length) return false;
    } else {
      if (offset < node.childNodes.length - 1) return false;
      if (node.childNodes[offset - 1]) node = node.childNodes[offset - 1];
    }
    while (node && !isBlockNode(node)) {
      next = node.nextSibling;
      if (next && isNewLine(next)) node = next;
      if (node.nextSibling) return false;
      node = node.parentNode;
    }
    return node !== null;
  };

  cursorIsAtTheStartOfNode = module.exports.cursorIsAtTheStartOfNode = function(cursor) {
    /*
        Возвращает true, если курсор указывает на начало ноды
        @param cursor: [HTMLNode, int]
        @return: boolean
    */    return cursor[1] === 0;
  };

  cursorIsAtTheStartOfBlockNode = module.exports.cursorIsAtTheStartOfBlockNode = function(cursor) {
    /*
        Возвращает true, если курсор указывает на начало блочной ноды
        @param cursor: [HTMLNode, int]
        @return: boolean
    */
    var curNode, offset;
    curNode = cursor[0], offset = cursor[1];
    if (!cursorIsAtTheStartOfNode(cursor)) return false;
    while (curNode && !isBlockNode(curNode)) {
      if (curNode.previousSibling) return false;
      curNode = curNode.parentNode;
    }
    return curNode !== null;
  };

  getCursor = module.exports.getCursor = function() {
    /*
        Возвращает текущее положение курсора
        @return: [HTMLNode, int]|null
    */
    var range;
    range = getRange();
    if (range === null) return null;
    return [range.startContainer, range.startOffset];
  };

  setCursor = module.exports.setCursor = function(cursor) {
    /*
        Устанавливает положение курсора
        @param cursor: [HTMLNode, int]
    */
    var range;
    range = document.createRange();
    range.setStart(cursor[0], cursor[1]);
    range.setEnd(cursor[0], cursor[1]);
    return setRange(range);
  };

  changeCursorAfterDeletion = module.exports.changeCursorAfterDeletion = function(node, cursor) {
    /*
        Изменяет положение курсора таким образом, чтобы после удаления node для
        пользователя оно осталось таким же
        Если курсор указывает на удаляемую ноду, смещают его влево
        @param node: HTMLNode
        @param cursor: [HTMLNode, int]|null
    */
    var _ref;
    if (!cursor) return;
    if (cursor[0] !== node) return;
    return _ref = getCursorToTheLeftOf(node), cursor[0] = _ref[0], cursor[1] = _ref[1], _ref;
  };

  getEmptyBlock = module.exports.getEmptyBlock = function() {
    /*
        Возвращает пустой параграф
        Чтобы параграф был виден в редакторе, в конце вставлен <br>
        @return: HTMLNode
    */
    var block;
    block = document.createElement(BLOCK_TAG);
    block.appendChild(document.createElement(NEW_LINE_TAG));
    return block;
  };

  isEmptyBlock = module.exports.isEmptyBlock = function(node) {
    /*
        Возвращает true, если указанная нода является пустым параграфом
        @param node: HTMLNode
        @return: boolean
    */    if (!isDefaultBlockNode(node)) return false;
    if (node.childNodes.length !== 1) return false;
    return isNewLine(node.childNodes[0]);
  };

  setRange = module.exports.setRange = function(range) {
    /*
        Устанавливает выбранную часть элементов
        @param range: HTMLRange
    */
    var selection;
    selection = window.getSelection();
    selection.removeAllRanges();
    return selection.addRange(range);
  };

  getRange = module.exports.getRange = function() {
    /*
        Возвращает текущую выбранную часть элементов
        Если ничего не выбрано, возвращает null
        @return HTMLRange|null
    */
    var selection;
    selection = window.getSelection();
    if (selection.rangeCount) {
      return selection.getRangeAt(0);
    } else {
      return null;
    }
  };

  getParentBlockNode = module.exports.getParentBlockNode = function(node) {
    /*
        Возвращает ближайшего блочного родителя
        @param node: HTMLNode
        @return: HTMLNode|null
    */    while (node && !isBlockNode(node)) {
      node = node.parentNode;
    }
    return node;
  };

  mergeParagraphs = module.exports.mergeParagraphs = function(first, second, cursor) {
    /*
        Переносит содержимое параграфа second в first, изменяет положение курсора
        @param first: HTMLNode
        @param second: HTMLNode
        @param cursor: [HTMLNode, int]
    */
    var _ref;
    _ref = getDeepestCursorPos(cursor), cursor[0] = _ref[0], cursor[1] = _ref[1];
    if (isNewLine(first.lastChild)) {
      changeCursorAfterDeletion(first.lastChild, cursor);
      first.removeChild(first.lastChild);
    }
    moveChildNodesToEnd(first, second);
    return second.parentNode.removeChild(second);
  };

  splitParagraph = module.exports.splitParagraph = function(para, start) {
    /*
        Разбивает параграф: создает новый, вставляет его сразу после para.
        Все ноды, начиная с node, переносит в созданный.
        Возвращает созданный параграф
        @param para: HTMLNode
        @param start: HTMLNode
        @return: HTMLNode
    */
    var container, leftNodes;
    leftNodes = getNodeAndNextSiblings(start);
    container = wrapInBlockNode(leftNodes);
    insertNextTo(container, para);
    return container;
  };

  getDeepestNodeBeforeCursor = module.exports.getDeepestNodeBeforeCursor = function(cursor) {
    /*
        Возвращает самую вложенную ноду перед курсором
        Если курсор находится внутри текста в текстовой ноде, возвращает ее саму
        Пропускает пустые текстовые ноды
        @param cursor: [HTMLNode, int]
        @return: HTMLNode|null
    */
    var node, offset, res;
    node = cursor[0], offset = cursor[1];
    if (cursorIsAtTheStartOfNode(cursor)) {
      res = getDeepestLastNode(getNearestPreviousNode(node));
    } else {
      if (isTextNode(node)) return node;
      res = getDeepestLastNode(node.childNodes[offset - 1]);
    }
    if ((isTextNode(res)) && (res.length === 0)) {
      res = getDeepestNodeBeforeCursor([res, 0]);
    }
    return res;
  };

  getDeepestNodeAfterCursor = module.exports.getDeepestNodeAfterCursor = function(cursor) {
    /*
        Возвращает самую вложенную ноду после курсора
        Если курсор находится внутри текста в текстовой ноде, возвращает ее саму
        Пропускает пустые текстовые ноды
        @param cursor: [HTMLNode, int]
        @return: HTMLNode|null
    */
    var node, offset, res;
    node = cursor[0], offset = cursor[1];
    if (cursorIsAtTheEndOfNode(cursor)) {
      res = getDeepestLastNode(getNearestNextNode(node));
    } else {
      if (isTextNode(node)) {
        res = node;
      } else {
        res = node.childNodes[offset];
      }
    }
    if ((isTextNode(res)) && (res.length === 0)) {
      res = getDeepestNodeAfterCursor([res, 0]);
    }
    return res;
  };

  getDeepestFirstChild = exports.getDeepestFirstChild = function(node) {
    while (node.firstChild) {
      node = node.firstChild;
    }
    return node;
  };

  getDeepestLastChild = exports.getDeepestLastChild = function(node) {
    while (node.lastChild) {
      node = node.lastChild;
    }
    return node;
  };

  exports.getParentOffset = getParentOffset = function(node) {
    /*
        Возвращает индекс переданной ноды в родильской ноде
        @param node: HTMLNode
        @returns: int
    */
    var child, offset;
    offset = 0;
    child = node.parentNode.firstChild;
    while (child !== node) {
      child = child.nextSibling;
      offset++;
    }
    return offset;
  };

  exports.setFullRange = setFullRange = function(startContainer, startOffset, endContainer, endOffset) {
    var range;
    range = document.createRange();
    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
    return setRange(range);
  };

  exports.getPosition = getPosition = function(node, offsetParent) {
    var left, top;
    top = 0;
    left = 0;
    while (node) {
      top += node.offsetTop;
      left += node.offsetLeft;
      if (node.offsetParent === offsetParent) return [top, left];
      node = node.offsetParent;
    }
    return [null, null];
  };

  exports.removeClass = removeClass = function(node, value) {
    var className;
    className = (' ' + node.className + ' ').replace(/[\n\t\r]/g, ' ').replace(' ' + value + ' ', ' ').trim();
    if (className === node.className) return false;
    node.className = className;
    return true;
  };

  exports.addClass = addClass = function(node, value) {
    var className;
    value = ' ' + value + ' ';
    className = ' ' + node.className + ' ';
    if (className.indexOf(value) !== -1) return false;
    node.className = (className + value).trim();
    return true;
  };

}).call(this);

});

require.define("/hallo.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var DomUtils, Utf16Util;

  Utf16Util = require('./utils/string').Utf16Util;

  DomUtils = require('./utils/dom');

  /*
  Hallo - a rich text editing jQuery UI widget
  (c) 2011 Henri Bergius, IKS Consortium
  Hallo may be freely distributed under the MIT license
  */

  (function(jQuery) {
    return jQuery.widget("IKS.hallo", {
      toolbar: null,
      toolbarMoved: false,
      bound: false,
      originalContent: "",
      uuid: "",
      selection: null,
      doc: null,
      _renderer: null,
      options: {
        editable: true,
        plugins: {},
        floating: true,
        offset: {
          x: 0,
          y: 0
        },
        fixed: false,
        showAlways: false,
        activated: function() {},
        deactivated: function() {},
        selected: function() {},
        unselected: function() {},
        enabled: function() {},
        disabled: function() {},
        placeholder: '',
        parentElement: 'body',
        forceStructured: true,
        buttonCssClass: null
      },
      _create: function() {
        var options, plugin, _ref, _results;
        this.originalContent = this.getContents();
        this.id = this._generateUUID();
        this._prepareToolbar();
        _ref = this.options.plugins;
        _results = [];
        for (plugin in _ref) {
          options = _ref[plugin];
          if (!jQuery.isPlainObject(options)) options = {};
          options['editable'] = this;
          options['toolbar'] = this.toolbar;
          options['uuid'] = this.id;
          options['buttonCssClass'] = this.options.buttonCssClass;
          _results.push(jQuery(this.element)[plugin](options));
        }
        return _results;
      },
      _init: function() {
        this._setToolbarPosition();
        if (this.options.editable) {
          return this.enable();
        } else {
          return this.disable();
        }
      },
      disable: function() {
        this.element.attr("contentEditable", false);
        this.element.unbind("focus", this._activated);
        this.element.unbind("blur", this._deactivated);
        this.element.unbind("keyup paste change", this._checkModified);
        this.element.unbind("keyup", this._keys);
        this.element.unbind("keypress", this._processTyping);
        this.element.unbind("keyup mouseup", this._checkSelection);
        this.bound = false;
        return this._trigger("disabled", null);
      },
      enable: function() {
        var widget;
        this.element.attr("contentEditable", true);
        if (!this.element.html()) this.element.html(this.options.placeholder);
        if (!this.bound) {
          this.element.bind("focus", this, this._activated);
          this.element.bind("blur", this, this._deactivated);
          this.element.bind("keyup paste change", this, this._checkModified);
          this.element.bind("keyup", this, this._keys);
          this.element.bind("keypress", this, this._processTyping);
          this.element.bind("keyup mouseup", this, this._checkSelection);
          widget = this;
          this.bound = true;
        }
        if (this.options.forceStructured) this._forceStructured();
        return this._trigger("enabled", null);
      },
      activate: function() {
        return this.element.focus();
      },
      getSelection: function() {
        var range, userSelection;
        if (jQuery.browser.msie) {
          range = document.selection.createRange();
        } else {
          if (window.getSelection) {
            userSelection = window.getSelection();
          } else if (document.selection) {
            userSelection = document.selection.createRange();
          } else {
            throw "Your browser does not support selection handling";
          }
          if (userSelection.rangeCount > 0) {
            range = userSelection.getRangeAt(0);
          } else {
            range = userSelection;
          }
        }
        return range;
      },
      restoreSelection: function(range) {
        if (jQuery.browser.msie) {
          return range.select();
        } else {
          window.getSelection().removeAllRanges();
          return window.getSelection().addRange(range);
        }
      },
      replaceSelection: function(cb) {
        var newTextNode, r, range, sel, t;
        if (jQuery.browser.msie) {
          t = document.selection.createRange().text;
          r = document.selection.createRange();
          return r.pasteHTML(cb(t));
        } else {
          sel = window.getSelection();
          range = sel.getRangeAt(0);
          newTextNode = document.createTextNode(cb(range.extractContents()));
          range.insertNode(newTextNode);
          range.setStartAfter(newTextNode);
          sel.removeAllRanges();
          return sel.addRange(range);
        }
      },
      removeAllSelections: function() {
        if (jQuery.browser.msie) {
          return range.empty();
        } else {
          return window.getSelection().removeAllRanges();
        }
      },
      getContents: function() {
        var contentClone, plugin;
        contentClone = this.element.clone();
        for (plugin in this.options.plugins) {
          jQuery(this.element)[plugin]('cleanupContentClone', contentClone);
        }
        return contentClone.html();
      },
      setContents: function(contents) {
        return this.element.html(contents);
      },
      isModified: function() {
        return this.originalContent !== this.getContents();
      },
      setUnmodified: function() {
        return this.originalContent = this.getContents();
      },
      setModified: function() {
        return this._trigger('modified', null, {
          editable: this,
          content: this.getContents()
        });
      },
      restoreOriginalContent: function() {
        return this.element.html(this.originalContent);
      },
      execute: function(command, value) {
        if (document.execCommand(command, false, value)) {
          return this.element.trigger("change");
        }
      },
      protectFocusFrom: function(el) {
        var widget;
        widget = this;
        return el.bind("mousedown", function(event) {
          event.preventDefault();
          widget._protectToolbarFocus = true;
          return setTimeout(function() {
            return widget._protectToolbarFocus = false;
          }, 300);
        });
      },
      _generateUUID: function() {
        var S4;
        S4 = function() {
          return ((1 + Math.random()) * 0x10000 | 0).toString(16).substring(1);
        };
        return "" + (S4()) + (S4()) + "-" + (S4()) + "-" + (S4()) + "-" + (S4()) + "-" + (S4()) + (S4()) + (S4());
      },
      _getToolbarPosition: function(event, selection) {
        var offset;
        if (!event) return;
        if (this.options.floating) {
          if (event.originalEvent instanceof KeyboardEvent) {
            return this._getCaretPosition(selection);
          } else if (event.originalEvent instanceof MouseEvent) {
            return {
              top: event.pageY,
              left: event.pageX
            };
          }
        } else {
          offset = parseFloat(this.element.css('outline-width')) + parseFloat(this.element.css('outline-offset'));
          return {
            top: this.element.offset().top - this.toolbar.outerHeight() - offset,
            left: this.element.offset().left - offset
          };
        }
      },
      _getCaretPosition: function(range) {
        var newRange, position, tmpSpan;
        tmpSpan = jQuery("<span/>");
        newRange = document.createRange();
        newRange.setStart(range.endContainer, range.endOffset);
        newRange.insertNode(tmpSpan.get(0));
        position = {
          top: tmpSpan.offset().top,
          left: tmpSpan.offset().left
        };
        tmpSpan.remove();
        return position;
      },
      _bindToolbarEventsFixed: function() {
        var _this = this;
        this.options.floating = false;
        this.element.bind("halloactivated", function(event, data) {
          _this._updateToolbarPosition(_this._getToolbarPosition(event));
          return _this.toolbar.show();
        });
        return this.element.bind("hallodeactivated", function(event, data) {
          return _this.toolbar.hide();
        });
      },
      _bindToolbarEventsRegular: function() {
        var _this = this;
        this.element.bind("halloselected", function(event, data) {
          var position;
          position = _this._getToolbarPosition(data.originalEvent, data.selection);
          if (!position) return;
          _this._updateToolbarPosition(position);
          return _this.toolbar.show();
        });
        this.element.bind("hallounselected", function(event, data) {
          return _this.toolbar.hide();
        });
        return this.element.bind("hallodeactivated", function(event, data) {
          return _this.toolbar.hide();
        });
      },
      _setToolbarPosition: function() {
        if (this.options.fixed) {
          this.toolbar.css('position', 'static');
          if (this.toolbarMoved) {
            jQuery(this.options.parentElement).append(this.toolbar);
          }
          this.toolbarMoved = false;
          return;
        }
        if (this.options.parentElement !== 'body') {
          jQuery('body').append(this.toolbar);
          this.toolbarMoved = true;
        }
        this.toolbar.css('position', 'absolute');
        this.toolbar.css('top', this.element.offset().top - 20);
        return this.toolbar.css('left', this.element.offset().left);
      },
      _prepareToolbar: function() {
        var widget;
        var _this = this;
        this.toolbar = jQuery('<div class="hallotoolbar"></div>').hide();
        this._setToolbarPosition();
        jQuery(this.options.parentElement).append(this.toolbar);
        widget = this;
        if (this.options.showAlways) this._bindToolbarEventsFixed();
        if (!this.options.showAlways) this._bindToolbarEventsRegular();
        jQuery(window).resize(function(event) {
          return _this._updateToolbarPosition(_this._getToolbarPosition(event));
        });
        return this.protectFocusFrom(this.toolbar);
      },
      _updateToolbarPosition: function(position) {
        if (this.options.fixed) return;
        if (!position) return;
        if (!(position.top && position.left)) return;
        this.toolbar.css("top", position.top);
        return this.toolbar.css("left", position.left);
      },
      _checkModified: function(event) {
        var widget;
        widget = event.data;
        if (widget.isModified()) return widget.setModified();
      },
      _keys: function(event) {
        var old, widget;
        widget = event.data;
        if (event.keyCode === 27) {
          old = widget.getContents();
          widget.restoreOriginalContent(event);
          widget._trigger("restored", null, {
            editable: widget,
            content: widget.getContents(),
            thrown: old
          });
          return widget.turnOff();
        }
      },
      _processTyping: function(event) {
        var c, doc, op, range, startElement, startOffset, widget, _ref;
        c = Utf16Util.traverseString(String.fromCharCode(event.charCode));
        if (!c.length) return true;
        widget = event.data;
        doc = widget.options.doc;
        range = widget.getSelection();
        if (!range) return true;
        _ref = widget._getStartElementAndOffset(range, event), startElement = _ref[0], startOffset = _ref[1];
        op = {
          p: startOffset,
          ti: c,
          params: {
            __TYPE: "TEXT"
          }
        };
        return doc.submitOp([op]);
      },
      _getCurrentElement: function(node, offset, event) {
        var element, leftNode, renderer, rightNode, widget;
        widget = event.data;
        renderer = widget.options._renderer;
        if (DomUtils.isTextNode(node)) {
          return [renderer.getPreviousElement(node), offset];
        }
        rightNode = node.childNodes[offset];
        if (rightNode) {
          element = renderer.getPreviousElement(rightNode);
          if (DomUtils.isTextNode(rightNode)) return [element, 0];
          return [element, renderer.getElementLength(element)];
        }
        leftNode = node.childNodes[offset - 1] || node;
        if (leftNode) {
          element = (renderer.getElementType(leftNode)) != null ? leftNode : renderer.getPreviousElement(leftNode);
          return [element, renderer.getElementLength(element)];
        }
        console.error(node, offset);
        throw 'could not determine real node';
      },
      _getOffsetBefore: function(node, event) {
        var offset, renderer, widget;
        widget = event.data;
        renderer = widget.options._renderer;
        offset = 0;
        while (node = renderer.getPreviousElement(node)) {
          offset += renderer.getElementLength(node);
        }
        return offset;
      },
      _getStartElementAndOffset: function(range, event) {
        var curNode, offset, prevOffset, widget, _ref;
        widget = event.data;
        _ref = widget._getCurrentElement(range.startContainer, range.startOffset, event), curNode = _ref[0], offset = _ref[1];
        prevOffset = widget._getOffsetBefore(curNode, event) + offset;
        return [curNode, prevOffset];
      },
      _rangesEqual: function(r1, r2) {
        return r1.startContainer === r2.startContainer && r1.startOffset === r2.startOffset && r1.endContainer === r2.endContainer && r1.endOffset === r2.endOffset;
      },
      _checkSelection: function(event) {
        var widget;
        if (event.keyCode === 27) return;
        widget = event.data;
        return setTimeout(function() {
          var sel;
          sel = widget.getSelection();
          if (widget._isEmptySelection(sel) || widget._isEmptyRange(sel)) {
            if (widget.selection) {
              widget.selection = null;
              widget._trigger("unselected", null, {
                editable: widget,
                originalEvent: event
              });
            }
            return;
          }
          if (!widget.selection || !widget._rangesEqual(sel, widget.selection)) {
            widget.selection = sel.cloneRange();
            return widget._trigger("selected", null, {
              editable: widget,
              selection: widget.selection,
              ranges: [widget.selection],
              originalEvent: event
            });
          }
        }, 0);
      },
      _isEmptySelection: function(selection) {
        if (selection.type === "Caret") return true;
        return false;
      },
      _isEmptyRange: function(range) {
        if (range.collapsed) return true;
        if (range.isCollapsed) {
          if (typeof range.isCollapsed === 'function') return range.isCollapsed();
          return range.isCollapsed;
        }
        return false;
      },
      turnOn: function() {
        var el, widthToAdd;
        if (this.getContents() === this.options.placeholder) this.setContents('');
        jQuery(this.element).addClass('inEditMode');
        if (!this.options.floating) {
          el = jQuery(this.element);
          widthToAdd = parseFloat(el.css('padding-left'));
          widthToAdd += parseFloat(el.css('padding-right'));
          widthToAdd += parseFloat(el.css('border-left-width'));
          widthToAdd += parseFloat(el.css('border-right-width'));
          widthToAdd += (parseFloat(el.css('outline-width'))) * 2;
          widthToAdd += (parseFloat(el.css('outline-offset'))) * 2;
          jQuery(this.toolbar).css("width", el.width() + widthToAdd);
        } else {
          this.toolbar.css("width", "auto");
        }
        return this._trigger("activated", this);
      },
      turnOff: function() {
        jQuery(this.element).removeClass('inEditMode');
        this._trigger("deactivated", this);
        if (!this.getContents()) return this.setContents(this.options.placeholder);
      },
      _activated: function(event) {
        return event.data.turnOn();
      },
      _deactivated: function(event) {
        if (event.data._protectToolbarFocus !== true) {
          return event.data.turnOff();
        } else {
          return setTimeout(function() {
            return jQuery(event.data.element).focus();
          }, 300);
        }
      },
      _forceStructured: function(event) {
        try {
          return document.execCommand('styleWithCSS', 0, false);
        } catch (e) {
          try {
            return document.execCommand('useCSS', 0, true);
          } catch (e) {
            try {
              return document.execCommand('styleWithCSS', false, false);
            } catch (e) {

            }
          }
        }
      }
    });
  })(jQuery);

}).call(this);

});
require("/hallo.coffee");
