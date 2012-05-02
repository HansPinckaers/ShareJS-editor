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

require.define("/utils/browser_events.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var BEFORE_COPY_EVENT, BEFORE_CUT_EVENT, BEFORE_PASTE_EVENT, BLUR_EVENT, COMPOSITIONEND, COMPOSITIONSTART, COMPOSITIONUPDATE, COPY_EVENT, CUT_EVENT, KEY_DOWN_EVENT, KEY_PRESS_EVENT, KEY_UP_EVENT, PASTE_EVENT, TEXT_EVENT, TEXT_INPUT_EVENT;

  exports.MOUSE_EVENTS = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mousemove', 'mouseout', 'mousewheel', 'contextmenu', 'selectstart'];

  exports.KEYDOWN_EVENT = KEY_DOWN_EVENT = 'keydown';

  exports.KEYPRESS_EVENT = KEY_PRESS_EVENT = 'keypress';

  exports.KEYUP_EVENT = KEY_UP_EVENT = 'keyup';

  exports.KEY_EVENTS = [KEY_DOWN_EVENT, KEY_PRESS_EVENT, KEY_UP_EVENT];

  exports.DRAGDROP_EVENTS = ['drag', 'dragstart', 'dragenter', 'dragover', 'dragleave', 'dragend', 'drop'];

  exports.COPY_EVENT = COPY_EVENT = 'copy';

  exports.CUT_EVENT = CUT_EVENT = 'cut';

  exports.PASTE_EVENT = PASTE_EVENT = 'paste';

  exports.BEFORE_CUT_EVENT = BEFORE_CUT_EVENT = 'beforecut';

  exports.BEFORE_COPY_EVENT = BEFORE_COPY_EVENT = 'beforecopy';

  exports.BEFORE_PASTE_EVENT = BEFORE_PASTE_EVENT = 'beforepaste';

  exports.CLIPBOARD_EVENTS = [CUT_EVENT, COPY_EVENT, PASTE_EVENT];

  exports.BLUR_EVENT = BLUR_EVENT = 'blur';

  exports.FOCUS_EVENTS = ['focus', BLUR_EVENT, 'beforeeditfocus'];

  exports.MUTATION_EVENTS = ['DOMActivate', 'DOMAttributeNameChanged', 'DOMAttrModified', 'DOMCharacterDataModified', 'DOMElementNameChanged', 'DOMFocusIn', 'DOMFocusOut', 'DOMMouseScroll', 'DOMNodeInserted', 'DOMNodeInsertedIntoDocument', 'DOMNodeRemoved', 'DOMNodeRemovedFromDocument', 'DOMSubtreeModified'];

  COMPOSITIONSTART = "compositionstart";

  COMPOSITIONEND = "compositionend";

  COMPOSITIONUPDATE = "compositionupdate";

  exports.TEXT_EVENT = TEXT_EVENT = "text";

  exports.TEXT_INPUT_EVENT = TEXT_INPUT_EVENT = 'textInput';

  exports.INPUT_EVENTS = [COMPOSITIONSTART, COMPOSITIONEND, COMPOSITIONUPDATE, TEXT_EVENT, TEXT_INPUT_EVENT];

  exports.OTHER_EVENTS = ["load", "unload", "abort", "error", "resize", "scroll", "beforeunload", "stop", "select", "change", "submit", "reset", "domfocusin", "domfocusout", "domactivate", "afterupdate", "beforeupdate", "cellchange", "dataavailable", "datasetchanged", "datasetcomplete", "errorupdate", "rowenter", "rowexit", "rowsdelete", "rowinserted", "help", "start", "finish", "bounce", "beforeprint", "afterprint", "propertychange", "filterchange", "readystatechange", "losecapture"];

}).call(this);

});

require.define("/model/index.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var LineLevelParams, ModelField, ModelType, ObjectParams, ParamsField, TextLevelParams;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  ObjectParams = (function() {

    function ObjectParams() {}

    ObjectParams.isValid = function(param) {
      /*
              Проверяет, что указанный параметр присутствует в данном наборе параметров
              @param param: any
              @return: boolean
      */      if (typeof param !== 'string') return false;
      if (param.substring(0, 2) !== this._prefix) return false;
      if (this.hasOwnProperty(param.substring(2))) return true;
      return false;
    };

    return ObjectParams;

  })();

  TextLevelParams = (function() {

    __extends(TextLevelParams, ObjectParams);

    function TextLevelParams() {
      TextLevelParams.__super__.constructor.apply(this, arguments);
    }

    /*
        Список поддерживаемых текстовых параметров
        Соглашение имен: для проверки важно ставить значения параметров равному имени параметра с префиксом 'T_'
    */

    TextLevelParams._prefix = 'T_';

    TextLevelParams.URL = 'T_URL';

    TextLevelParams.BOLD = 'T_BOLD';

    TextLevelParams.ITALIC = 'T_ITALIC';

    TextLevelParams.STRUCKTHROUGH = 'T_STRUCKTHROUGH';

    TextLevelParams.UNDERLINED = 'T_UNDERLINED';

    return TextLevelParams;

  })();

  LineLevelParams = (function() {

    __extends(LineLevelParams, ObjectParams);

    function LineLevelParams() {
      LineLevelParams.__super__.constructor.apply(this, arguments);
    }

    /*
        Список поддерживаемых текстовых параметров
        Соглашение имен: для проверки важно ставить значения параметров равному имени параметра с префиксом 'L_'
    */

    LineLevelParams._prefix = 'L_';

    LineLevelParams.BULLETED = 'L_BULLETED';

    return LineLevelParams;

  })();

  ModelField = (function() {

    function ModelField() {}

    ModelField.PARAMS = 'params';

    ModelField.TEXT = 't';

    return ModelField;

  })();

  ParamsField = (function() {

    function ParamsField() {}

    ParamsField.TEXT = '__TEXT';

    ParamsField.TYPE = '__TYPE';

    ParamsField.ID = '__ID';

    ParamsField.URL = '__URL';

    ParamsField.RANDOM = 'RANDOM';

    return ParamsField;

  })();

  ModelType = (function() {

    function ModelType() {}

    ModelType.TEXT = 'TEXT';

    ModelType.BLIP = 'BLIP';

    ModelType.LINE = 'LINE';

    ModelType.ATTACHMENT = 'ATTACHMENT';

    ModelType.RECIPIENT = 'RECIPIENT';

    ModelType.GADGET = 'GADGET';

    return ModelType;

  })();

  exports.TextLevelParams = TextLevelParams;

  exports.LineLevelParams = LineLevelParams;

  exports.ModelField = ModelField;

  exports.ParamsField = ParamsField;

  exports.ModelType = ModelType;

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

require.define("/attachment/index.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Attachment, escapeHTML, renderAttachment;
  var __slice = Array.prototype.slice;

  renderAttachment = require('./template').renderAttachment;

  escapeHTML = require('../utils/string').escapeHTML;

  Attachment = (function() {

    function Attachment() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this._init.apply(this, args);
    }

    Attachment.prototype._init = function(_rel, url) {
      this._rel = _rel;
      this._url = url;
      return this._createDom();
    };

    Attachment.prototype._createDom = function() {
      var params;
      this._container = document.createElement('span');
      this._container.contentEditable = false;
      params = {
        src: this._url,
        rel: this._rel
      };
      return $(this._container).append(renderAttachment(params));
    };

    Attachment.prototype.getContainer = function() {
      return this._container;
    };

    return Attachment;

  })();

  exports.Attachment = Attachment;

}).call(this);

});

require.define("/attachment/template.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var attachmentEditorTmpl, attachmentTmpl, ck;

  ck = window.CoffeeKup;

  attachmentTmpl = function() {
    return div('.attachment-content', function() {
      return a({
        href: h(this.src),
        rel: h(this.rel)
      }, function() {
        return img('.attachment-preview', {
          src: h(this.src),
          alt: ''
        });
      });
    });
  };

  attachmentEditorTmpl = function() {
    /*
        Шаблон формы добавления вложений
    */    return div('js-attachment-editor.attachment-editor.window', function() {
      div('.attachment-editor-name', function() {
        span('Insert attachment');
        return span('.close-icon.js-attachment-editor-close-btn', '');
      });
      return table('.attachment-editor-content', function() {
        tr('', function() {
          td('', 'URL');
          return td('', function() {
            return div('.attachment-url', function() {
              return label(function() {
                return input('.js-attachment-editor-url-input', {
                  type: 'text'
                });
              });
            });
          });
        });
        return tr('', function() {
          td('', '');
          return td('', function() {
            return button('.js-attachment-editor-submit-btn.button', {
              title: 'Accept changes'
            }, 'Submit');
          });
        });
      });
    });
  };

  exports.renderAttachmentEditor = function() {
    return ck.render(attachmentEditorTmpl);
  };

  exports.renderAttachment = function(params) {
    return ck.render(attachmentTmpl, params);
  };

}).call(this);

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

require.define("/renderer.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var Attachment, BULLETED_LIST_LEVEL_PADDING, BrowserEvents, DATA_KEY, DomUtils, LineLevelParams, ModelField, ModelType, ParamsField, Renderer, TextLevelParams;
  var __slice = Array.prototype.slice;

  BrowserEvents = require('./utils/browser_events');

  ModelField = require('./model').ModelField;

  ParamsField = require('./model').ParamsField;

  ModelType = require('./model').ModelType;

  TextLevelParams = require('./model').TextLevelParams;

  LineLevelParams = require('./model').LineLevelParams;

  DomUtils = require('./utils/dom');

  Attachment = require('./attachment').Attachment;

  BULLETED_LIST_LEVEL_PADDING = 15;

  DATA_KEY = '__rizzoma_data_key';

  Renderer = (function() {

    function Renderer() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this._init.apply(this, args);
    }

    Renderer.prototype._init = function(_id, _container, _doc) {
      var self;
      this._id = _id;
      this._container = _container;
      this._doc = _doc;
      this._recipients = [];
      this.renderContent(this._doc.snapshot);
      self = this;
      return this._doc.on('remoteop', function(ops) {
        console.log(ops);
        return self.applyOps(ops, true);
      });
    };

    Renderer.prototype._paramsEqual = function(p1, p2) {
      var i;
      for (i in p1) {
        if (p1[i] !== p2[i]) return false;
      }
      for (i in p2) {
        if (p1[i] !== p2[i]) return false;
      }
      return true;
    };

    Renderer.prototype._data = function(element, key, value) {
      var _ref;
      if ((_ref = element[DATA_KEY]) == null) element[DATA_KEY] = {};
      if (!(key != null)) return element[DATA_KEY];
      if (typeof key === 'object') return element[DATA_KEY] = key;
      if (!(value != null)) return element[DATA_KEY][key];
      return element[DATA_KEY][key] = value;
    };

    Renderer.prototype._getDeepestLastNode = function(node) {
      /*
              Возвращает самого вложенного из последних наследников указнной ноды
              Возвращает саму ноду, если у нее нет наследников
              Не заходит внутрь нод, у которых contentEditable == false
              @param node: HTMLNode
              @return: HTMLNode
      */      if (node.contentEditable === 'false' && node !== this._container) {
        return node;
      }
      if (!node.lastChild) return node;
      return this._getDeepestLastNode(node.lastChild);
    };

    Renderer.prototype.renderContent = function(content) {
      /*
              Отрисовка содержимого редактора по снимку его содержимого
              @param _container: HTMLElement - элемент редактора, в который будет вставляться содержимое
              @param content: [Object] - снимок содержимого
      */
      var $container, $curPar, $node, element, index, _len, _results;
      $container = $(this._container);
      $container.empty();
      $curPar = null;
      _results = [];
      for (index = 0, _len = content.length; index < _len; index++) {
        element = content[index];
        $node = $(this._renderElement(element, index));
        if (element[ModelField.PARAMS][ParamsField.TYPE] === ModelType.LINE) {
          $curPar = $node;
          _results.push($container.append($node));
        } else {
          _results.push($curPar.children().last().before($node));
        }
      }
      return _results;
    };

    Renderer.prototype.preventEventsPropagation = function(node) {
      return $(node).bind("" + (BrowserEvents.KEY_EVENTS.join(' ')) + " " + (BrowserEvents.DRAGDROP_EVENTS.join(' ')) + " " + (BrowserEvents.CLIPBOARD_EVENTS.join(' ')) + " " + (BrowserEvents.INPUT_EVENTS.join(' ')), function(e) {
        return e.stopPropagation();
      });
    };

    Renderer.prototype._renderElement = function(element, index) {
      switch (element[ModelField.PARAMS][ParamsField.TYPE]) {
        case ModelType.TEXT:
          return this._createTextElement(element[ModelField.TEXT], element[ModelField.PARAMS]);
        case ModelType.LINE:
          return this._createLineElement(element[ModelField.PARAMS]);
        default:
          return this._createInlineElement(element[ModelField.PARAMS]);
      }
    };

    Renderer.prototype._setParamsToElement = function(node, params) {
      var data;
      data = this._data(node);
      data[ModelField.PARAMS] = params;
      return this._data(node, data);
    };

    Renderer.prototype._setRangeProps = function(startContainer, startOffset, endContainer, endOffset) {
      try {
        return DomUtils.setFullRange(startContainer, startOffset, endContainer, endOffset);
      } catch (e) {
        return console.warn('Failed to set range', e, e.stack);
      }
    };

    Renderer.prototype._getRangeProps = function(range) {
      return [range.startContainer, range.startOffset, range.endContainer, range.endOffset];
    };

    Renderer.prototype._createTextElement = function(text, params) {
      /*
              Создает тексторый элемент и назначает ему параметры
              @param text: string - текст элемента
              @param params: Object - параметры объекта
              @returns: HTMLNode
      */
      var decs, res, textNode;
      if (params[TextLevelParams.URL]) {
        res = document.createElement('a');
        res.href = params[TextLevelParams.URL];
      } else {
        res = document.createElement('span');
      }
      if (params[TextLevelParams.BOLD]) $(res).css('font-weight', 'bold');
      if (params[TextLevelParams.ITALIC]) $(res).css('font-style', 'italic');
      decs = [];
      if (params[TextLevelParams.UNDERLINED] || params[TextLevelParams.URL]) {
        decs.push('underline');
      }
      if (params[TextLevelParams.STRUCKTHROUGH]) decs.push('line-through');
      if (decs.length) $(res).css('text-decoration', decs.join(' '));
      textNode = document.createTextNode(text);
      res.appendChild(textNode);
      this._setParamsToElement(res, params);
      return res;
    };

    Renderer.prototype._createLineElement = function(params) {
      /*
              Создает элемент типа Line и назначает ему параметры
              @param params: Object - параметры элемента
              @returns: HTMLNode
      */
      var bulletedType, margin, res;
      res = document.createElement('p');
      res.appendChild(document.createElement('br'));
      if (params[LineLevelParams.BULLETED] != null) {
        $(res).addClass('bulleted');
        bulletedType = params[LineLevelParams.BULLETED] % 5;
        $(res).addClass("bulleted-type" + bulletedType);
        margin = params[LineLevelParams.BULLETED] * BULLETED_LIST_LEVEL_PADDING;
        $(res).css('margin-left', margin);
      }
      this._setParamsToElement(res, params);
      return res;
    };

    Renderer.prototype._createInlineElement = function(params) {
      /*
              Создает инлайн элемент и назначает ему параметры
              @param params: Object - параметры элемента
              @returns: HTMLNode
      */
      var attachment, recipient, res, url;
      switch (params[ParamsField.TYPE]) {
        case ModelType.BLIP:
          res = this._addInline(ModelType.BLIP, {
            id: params[ParamsField.ID]
          });
          break;
        case ModelType.ATTACHMENT:
          url = params[ParamsField.URL];
          attachment = new Attachment(this._id, url);
          res = attachment.getContainer();
          this.preventEventsPropagation(res);
          break;
        case ModelType.RECIPIENT:
          recipient = this._getRecipient(params[ParamsField.ID]);
          res = recipient.getContainer();
          $(res).data('recipient', recipient);
          this._recipients.push(res);
          this.preventEventsPropagation(res);
          break;
        default:
          res = document.createElement('span');
          res.contentEditable = false;
      }
      this._setParamsToElement(res, params);
      return res;
    };

    Renderer.prototype._setCursorAfter = function(element) {
      /*
              Устанавливает курсор после текущего элемента или в конец текущего элемента, если текущий элемент - текстовый
              @param node: HTMLElement
      */
      var container, offset, _ref;
      _ref = this._getContainerOffsetAfter(element), container = _ref[0], offset = _ref[1];
      return this._setRangeProps(container, offset, container, offset);
    };

    Renderer.prototype._getContainerOffsetAfter = function(element) {
      var nextElement, type;
      switch (this.getElementType(element)) {
        case ModelType.TEXT:
          return [element.firstChild, element.firstChild.length];
        case ModelType.LINE:
          nextElement = this.getNextElement(element);
          if (!nextElement || (type = this.getElementType(nextElement)) === ModelType.LINE) {
            return [element, 0];
          }
          if (type === ModelType.TEXT) {
            return [nextElement.firstChild, 0];
          } else {
            return [nextElement.parentNode, DomUtils.getParentOffset(nextElement)];
          }
          break;
        default:
          nextElement = this.getNextElement(element);
          if (!nextElement || this.getElementType(nextElement) !== ModelType.TEXT) {
            return [element.parentNode, DomUtils.getParentOffset(element) + 1];
          } else {
            return [nextElement.firstChild, 0];
          }
      }
    };

    Renderer.prototype._getElementAndOffset = function(index, node) {
      var curNode, offset;
      if (node == null) node = this._container;
      curNode = node = this.getNextElement(node);
      offset = this.getElementLength(curNode);
      while (curNode) {
        if (offset >= index) return [node, offset];
        curNode = this.getNextElement(curNode);
        if (curNode) {
          offset += this.getElementLength(curNode);
          node = curNode;
        }
      }
      return [node, offset];
    };

    Renderer.prototype.getParagraphNode = function(node) {
      while (node !== this._container && this.getElementType(node) !== ModelType.LINE) {
        node = node.parentNode;
      }
      return node;
    };

    Renderer.prototype._splitTextElement = function(element, index) {
      /*
              Разбиваем текстовый элемент на два элемента по указанному индексу, если индекс указывает не на края элемента
              @param element: HTMLElement - разбиваемый элемент
              @param index: int - индекс, по которому произойдет разбиение
              @returns: [HTMLElement, HTMLElement]
      */
      var elLength, elementOffset, endContainer, endOffset, getContainerAndOffset, newElement, range, startContainer, startOffset, _ref, _ref2, _ref3;
      elLength = element.firstChild.length;
      if (elLength === index) return [element, null];
      if (index === 0) return [null, element];
      newElement = this._createTextElement(element.firstChild.data.substr(index), this.getElementParams(element));
      if (range = DomUtils.getRange()) {
        _ref = this._getRangeProps(range), startContainer = _ref[0], startOffset = _ref[1], endContainer = _ref[2], endOffset = _ref[3];
      }
      DomUtils.insertNextTo(newElement, element);
      if (range) {
        elementOffset = DomUtils.getParentOffset(element);
        getContainerAndOffset = function(container, offset) {
          if (container === element.firstChild) {
            if (index < offset) {
              return [newElement.firstChild, offset - index];
            } else {
              return [container, offset];
            }
          }
          if (container !== element.parentNode) return [container, offset];
          if (elementOffset > offset) return [container, offset + 1];
          return [container, offset];
        };
        _ref2 = getContainerAndOffset(startContainer, startOffset), startContainer = _ref2[0], startOffset = _ref2[1];
        _ref3 = getContainerAndOffset(endContainer, endOffset), endContainer = _ref3[0], endOffset = _ref3[1];
      }
      element.firstChild.deleteData(index, elLength - index);
      if (range) {
        this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
      }
      return [element, newElement];
    };

    Renderer.prototype._insertText = function(text, params, element, offset, shiftCursor) {
      var elementParams, endContainer, endOffset, getOffset, leftElement, newElement, parNode, range, rightElement, rightNode, startContainer, startOffset, textNode, _ref;
      elementParams = this.getElementParams(element);
      if (this._paramsEqual(params, elementParams)) {
        textNode = element.firstChild;
        if (!shiftCursor) {
          if (range = DomUtils.getRange()) {
            getOffset = function(container, index, isStart) {
              if (container !== textNode) return index;
              if (isStart) {
                if (index < offset) return index;
              } else {
                if (index <= offset) return index;
              }
              return index + text.length;
            };
            startContainer = range.startContainer;
            startOffset = getOffset(startContainer, range.startOffset, true);
            endContainer = range.endContainer;
            endOffset = getOffset(endContainer, range.endOffset, false);
          }
        }
        textNode.insertData(offset, text);
        if (shiftCursor) {
          return DomUtils.setCursor([textNode, offset + text.length]);
        } else if (range) {
          return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
        }
      } else {
        newElement = this._createTextElement(text, params);
        _ref = this._splitTextElement(element, offset), leftElement = _ref[0], rightElement = _ref[1];
        if (!shiftCursor) {
          if (range = DomUtils.getRange()) {
            rightNode = leftElement ? leftElement.nextSibling : rightElement;
            parNode = this.getParagraphNode(rightNode);
            getOffset = function(container, index) {
              var offsetNode;
              if (container !== parNode) return index;
              offsetNode = parNode.childNodes[index];
              if (!offsetNode) return index + 1;
              while (rightNode) {
                if (rightNode === offsetNode) return index + 1;
                rightNode = rightNode.nextSibling;
              }
              return index;
            };
            startContainer = range.startContainer;
            startOffset = getOffset(startContainer, range.startOffset);
            endContainer = range.endContainer;
            endOffset = getOffset(endContainer, range.endOffset);
          }
        }
        if (leftElement) {
          DomUtils.insertNextTo(newElement, leftElement);
        } else {
          rightElement.parentNode.insertBefore(newElement, rightElement);
        }
        if (shiftCursor) {
          return this._setCursorAfter(newElement);
        } else if (range) {
          return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
        }
      }
    };

    Renderer.prototype._handleTiOp = function(op, shiftCursor) {
      var element, elementOffset, endContainer, endOffset, index, newElement, nextElement, nextElementType, offset, offsetBefore, params, range, realOffset, startContainer, startOffset, text, type, _ref, _ref2;
      index = op.p;
      text = op.ti;
      params = op.params;
      _ref = this._getElementAndOffset(index), element = _ref[0], offset = _ref[1];
      type = this.getElementType(element);
      switch (type) {
        case ModelType.TEXT:
          offsetBefore = offset - this.getElementLength(element);
          realOffset = index - offsetBefore;
          return this._insertText(text, params, element, realOffset, shiftCursor);
        default:
          nextElement = this.getNextElement(element);
          nextElementType = this.getElementType(nextElement);
          if (nextElementType === ModelType.TEXT) {
            return this._insertText(text, params, nextElement, 0, shiftCursor);
          } else {
            newElement = this._createTextElement(text, params);
            if (!shiftCursor) {
              if (range = DomUtils.getRange()) {
                _ref2 = this._getRangeProps(range), startContainer = _ref2[0], startOffset = _ref2[1], endContainer = _ref2[2], endOffset = _ref2[3];
              }
            }
            if (type === ModelType.LINE) {
              if (!shiftCursor && range) {
                if (startContainer === element) startOffset++;
                if (endContainer === element && endOffset) endOffset++;
              }
              element.insertBefore(newElement, element.firstChild);
            } else {
              if (!shiftCursor && range) {
                elementOffset = DomUtils.getParentOffset(element) + 1;
                if (startContainer === element.parentNode && startOffset > elementOffset) {
                  startOffset++;
                }
                if (endContainer === element.parentNode && endOffset > elementOffset) {
                  endOffset++;
                }
              }
              DomUtils.insertNextTo(newElement, element);
            }
            if (shiftCursor) {
              return this._setCursorAfter(newElement);
            } else if (range) {
              return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
            }
          }
      }
    };

    Renderer.prototype._handleLineInsertOp = function(params, node, offset, shiftCursor) {
      var endContainer, endOffset, getNodeAndOffset, newNode, nodes, parNode, range, startContainer, startNode, startOffset, type, _ref, _ref2, _ref3;
      newNode = this._createLineElement(params);
      if (!offset) {
        this._container.insertBefore(newNode, this._container.firstChild);
        return;
      }
      type = this.getElementType(node);
      parNode = this.getParagraphNode(node);
      DomUtils.insertNextTo(newNode, parNode);
      switch (type) {
        case ModelType.TEXT:
          _ref = this._splitTextElement(node, offset), node = _ref[0], startNode = _ref[1];
          if (!startNode) startNode = node.nextSibling;
          break;
        case ModelType.LINE:
          startNode = node.firstChild;
          break;
        case ModelType.BLIP:
        case ModelType.ATTACHMENT:
        case ModelType.RECIPIENT:
          startNode = node.nextSibling;
      }
      nodes = DomUtils.getNodeAndNextSiblings(startNode);
      nodes.pop();
      if (!shiftCursor && nodes.length) {
        if (range = DomUtils.getRange()) {
          getNodeAndOffset = function(container, offset) {
            var nodeIndex, offsetNode;
            if (container !== parNode) return [container, offset];
            offsetNode = parNode.childNodes[offset];
            if (!offsetNode) return [parNode, offset];
            if (offsetNode === parNode.lastChild) return [newNode, nodes.length];
            nodeIndex = nodes.indexOf(offsetNode);
            if (nodeIndex < 1) return [parNode, offset];
            return [newNode, nodeIndex];
          };
          _ref2 = getNodeAndOffset(range.startContainer, range.startOffset), startContainer = _ref2[0], startOffset = _ref2[1];
          _ref3 = getNodeAndOffset(range.endContainer, range.endOffset), endContainer = _ref3[0], endOffset = _ref3[1];
        }
      }
      DomUtils.moveNodesToStart(newNode, nodes);
      if (shiftCursor) {
        return DomUtils.setCursor([newNode, 0]);
      } else if (range) {
        return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
      }
    };

    Renderer.prototype._handleLineDeleteOp = function(element, shiftCursor) {
      var endContainer, endOffset, getNodeAndOffset, nextElement, nodes, parNode, range, startContainer, startOffset, _ref, _ref2;
      nextElement = this.getNextElement(element);
      nodes = DomUtils.getNodeAndNextSiblings(nextElement.firstChild);
      nodes.pop();
      parNode = this.getParagraphNode(element);
      if (!shiftCursor) {
        if (range = DomUtils.getRange()) {
          getNodeAndOffset = function(container, offset) {
            var nodeIndex, offsetNode, parNodeLength;
            if (container !== nextElement) return [container, offset];
            parNodeLength = parNode.childNodes.length;
            offsetNode = nextElement.childNodes[offset];
            if (!nodes.length || !offsetNode || offsetNode === nextElement.lastChild) {
              return [parNode, nodes.length + parNodeLength - 1];
            }
            nodeIndex = nodes.indexOf(offsetNode);
            return [parNode, nodeIndex + parNodeLength - 1];
          };
          _ref = getNodeAndOffset(range.startContainer, range.startOffset), startContainer = _ref[0], startOffset = _ref[1];
          _ref2 = getNodeAndOffset(range.endContainer, range.endOffset), endContainer = _ref2[0], endOffset = _ref2[1];
        }
      }
      DomUtils.moveNodesBefore(nodes, parNode.lastChild);
      $(nextElement).remove();
      if (shiftCursor) {
        return this._setCursorAfter(element);
      } else if (range) {
        return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
      }
    };

    Renderer.prototype._handleInlineInsertOp = function(params, node, offset, shiftCursor) {
      var endContainer, endOffset, getContainerAndOffset, insert, newElement, parNode, range, startContainer, startNode, startOffset, type, _ref, _ref2, _ref3, _ref4, _ref5;
      type = this.getElementType(node);
      newElement = this._createInlineElement(params);
      parNode = this.getParagraphNode(node);
      getContainerAndOffset = function(container, index) {
        var newElementIndex;
        if (container !== parNode) return [container, index];
        newElementIndex = DomUtils.getParentOffset(newElement);
        if (index <= newElementIndex) return [container, index];
        return [container, index + 1];
      };
      switch (type) {
        case ModelType.TEXT:
          _ref = this._splitTextElement(node, offset), node = _ref[0], startNode = _ref[1];
          if (node) {
            insert = DomUtils.insertNextTo;
          } else {
            node = startNode;
            insert = parNode.insertBefore;
          }
          while (node.parentNode !== parNode) {
            node = node.parentNode;
          }
          if (!shiftCursor && (range = DomUtils.getRange())) {
            _ref2 = this._getRangeProps(range), startContainer = _ref2[0], startOffset = _ref2[1], endContainer = _ref2[2], endOffset = _ref2[3];
          }
          insert(newElement, node);
          break;
        default:
          if (!shiftCursor && (range = DomUtils.getRange())) {
            _ref3 = this._getRangeProps(range), startContainer = _ref3[0], startOffset = _ref3[1], endContainer = _ref3[2], endOffset = _ref3[3];
          }
          if (type === ModelType.LINE) {
            parNode.insertBefore(newElement, parNode.firstChild);
          } else {
            DomUtils.insertNextTo(newElement, node);
          }
      }
      if (params[ParamsField.TYPE] === ModelType.ATTACHMENT) {
        $(this._container).find('a[rel="' + this._id + '"]').lightBox();
      }
      if (shiftCursor) {
        return this._setCursorAfter(newElement);
      } else if (range) {
        _ref4 = getContainerAndOffset(startContainer, startOffset), startContainer = _ref4[0], startOffset = _ref4[1];
        _ref5 = getContainerAndOffset(endContainer, endOffset), endContainer = _ref5[0], endOffset = _ref5[1];
        return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
      }
    };

    Renderer.prototype._handleInlineDeleteOp = function(element, shiftCursor) {
      var endContainer, endOffset, getContainerAndOffset, index, nextElement, range, startContainer, startOffset, type, _ref, _ref2, _ref3, _ref4;
      nextElement = this.getNextElement(element);
      type = this.getElementType(nextElement);
      if (type === ModelType.RECIPIENT && (index = this._recipients.indexOf(nextElement)) !== -1) {
        if ((_ref = $(this._recipients[index]).data('recipient')) != null) {
          _ref.destroy();
        }
        this._recipients = this._recipients.slice(0, index).concat(this._recipients.slice(index + 1));
      }
      if (!shiftCursor && (range = DomUtils.getRange())) {
        getContainerAndOffset = function(container, index) {
          var nextElementIndex;
          if (container !== nextElement.parentNode) return [container, index];
          nextElementIndex = DomUtils.getParentOffset(nextElement);
          if (index > nextElementIndex) return [container, index - 1];
          return [container, index];
        };
        _ref2 = this._getRangeProps(range), startContainer = _ref2[0], startOffset = _ref2[1], endContainer = _ref2[2], endOffset = _ref2[3];
        _ref3 = getContainerAndOffset(startContainer, startOffset), startContainer = _ref3[0], startOffset = _ref3[1];
        _ref4 = getContainerAndOffset(endContainer, endOffset), endContainer = _ref4[0], endOffset = _ref4[1];
      }
      $(nextElement).remove();
      if (type === ModelType.ATTACHMENT) {
        $(this._container).find('a[rel="' + this._id + '"]').lightBox();
      }
      if (shiftCursor) {
        return this._setCursorAfter(element);
      } else if (range) {
        return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
      }
    };

    Renderer.prototype._handleOiOp = function(op, shiftCursor) {
      var index, node, offset, params, realOffset, _ref;
      index = op.p;
      params = op.params;
      _ref = this._getElementAndOffset(index), node = _ref[0], offset = _ref[1];
      realOffset = index - offset + this.getElementLength(node);
      switch (params[ParamsField.TYPE]) {
        case ModelType.LINE:
          return this._handleLineInsertOp(params, node, realOffset, shiftCursor);
        default:
          return this._handleInlineInsertOp(params, node, realOffset, shiftCursor);
      }
    };

    Renderer.prototype._handleTdOp = function(op, shiftCursor) {
      var cursorElement, element, endContainer, endElement, endIndex, endOffset, index, nextNode, offset, range, startContainer, startElement, startOffset, textLength, _, _ref, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8;
      index = op.p;
      textLength = op.td.length;
      if (!index) throw new Error('trying to delete 0 element');
      _ref = this._getElementAndOffset(index), element = _ref[0], offset = _ref[1];
      if (this.getElementType(element) !== ModelType.TEXT || offset - index === 0) {
        _ref2 = this._getElementAndOffset(index + 1), element = _ref2[0], offset = _ref2[1];
      }
      _ref3 = this._splitTextElement(element, index - offset + this.getElementLength(element)), _ = _ref3[0], startElement = _ref3[1];
      endIndex = index + textLength;
      _ref4 = this._getElementAndOffset(endIndex), element = _ref4[0], offset = _ref4[1];
      _ref5 = this._splitTextElement(element, endIndex - offset + this.getElementLength(element)), endElement = _ref5[0], _ = _ref5[1];
      endElement = this.getNextElement(endElement);
      cursorElement = this.getPreviousElement(startElement);
      if (!shiftCursor) {
        if (range = DomUtils.getRange()) {
          _ref6 = this._getRangeProps(range), startContainer = _ref6[0], startOffset = _ref6[1], endContainer = _ref6[2], endOffset = _ref6[3];
        }
      }
      while (startElement !== endElement) {
        nextNode = this.getNextElement(startElement);
        if (this.getElementType(startElement) !== ModelType.TEXT) {
          throw new Error('trying to delete non-text element in text operation');
        }
        $(startElement).remove();
        if (!shiftCursor) {
          if (startContainer === startElement || startContainer === startElement.firstChild) {
            _ref7 = this._getContainerOffsetAfter(cursorElement), startContainer = _ref7[0], startOffset = _ref7[1];
          }
          if (endContainer === startElement || endContainer === startElement.firstChild) {
            _ref8 = this._getContainerOffsetAfter(cursorElement), endContainer = _ref8[0], endOffset = _ref8[1];
          }
        }
        startElement = nextNode;
      }
      if (shiftCursor) {
        return this._setCursorAfter(cursorElement);
      } else if (range) {
        return this._setRangeProps(startContainer, startOffset, endContainer, endOffset);
      }
    };

    Renderer.prototype._handleOdOp = function(op, shiftCursor) {
      var element, index, offset, params, _ref;
      index = op.p;
      if (!index) throw new Error('trying to delete 0 element');
      params = op.params;
      _ref = this._getElementAndOffset(index), element = _ref[0], offset = _ref[1];
      switch (params[ParamsField.TYPE]) {
        case ModelType.LINE:
          return this._handleLineDeleteOp(element, shiftCursor);
        default:
          return this._handleInlineDeleteOp(element, shiftCursor);
      }
    };

    Renderer.prototype._getParamValue = function(params) {
      var param, value;
      for (param in params) {
        value = params[param];
        return [param, value];
      }
    };

    Renderer.prototype._handleParamsOp = function(op, shiftCursor, insert) {
      var elLength, element, endContainer, endElement, endIndex, endOffset, index, length, newElement, nodes, offset, param, params, range, realOffset, startContainer, startElement, startOffset, type, value, _, _ref, _ref2, _ref3, _ref4, _ref5, _ref6, _results;
      index = op.p;
      length = op.len;
      params = insert ? op.paramsi : op.paramsd;
      _ref = this._getElementAndOffset(index), element = _ref[0], offset = _ref[1];
      if (this.getElementType(element) !== ModelType.TEXT || offset - index === 0) {
        _ref2 = this._getElementAndOffset(index + 1), element = _ref2[0], offset = _ref2[1];
      }
      type = this.getElementType(element);
      _ref3 = this._getParamValue(params), param = _ref3[0], value = _ref3[1];
      switch (type) {
        case ModelType.TEXT:
          if (!TextLevelParams.isValid(param)) {
            throw "unexpected text param: " + param;
          }
          elLength = this.getElementLength(element);
          realOffset = index - offset + elLength;
          _ref4 = this._splitTextElement(element, realOffset), _ = _ref4[0], startElement = _ref4[1];
          endIndex = index + length;
          _ref5 = this._getElementAndOffset(endIndex), element = _ref5[0], offset = _ref5[1];
          _ref6 = this._splitTextElement(element, endIndex - offset + this.getElementLength(element)), endElement = _ref6[0], _ = _ref6[1];
          _results = [];
          while (true) {
            type = this.getElementType(startElement);
            if (type !== ModelType.TEXT) {
              throw "text param could not be applied to " + type + " type";
            }
            if (range = DomUtils.getRange()) {
              startContainer = range.startContainer;
              startOffset = range.startOffset;
              endContainer = range.endContainer;
              endOffset = range.endOffset;
            }
            params = this.getElementParams(startElement);
            if (insert) {
              params[param] = value;
            } else {
              delete params[param];
            }
            newElement = this._createTextElement(startElement.firstChild.data, params);
            DomUtils.insertNextTo(newElement, startElement);
            $(startElement).remove();
            if (range) {
              if (endContainer === startElement.firstChild) {
                range.setEnd(newElement.firstChild, endOffset);
              } else if (endContainer === startElement) {
                range.setEnd(newElement, endOffset);
              } else {
                range.setEnd(endContainer, endOffset);
              }
              if (startContainer === startElement.firstChild) {
                range.setStart(newElement.firstChild, startOffset);
              } else if (startContainer === startElement) {
                range.setStart(newElement, startOffset);
              }
              DomUtils.setRange(range);
            }
            if (startElement === endElement) break;
            _results.push(startElement = this.getNextElement(newElement));
          }
          return _results;
          break;
        case ModelType.LINE:
          if (!LineLevelParams.isValid(param)) {
            throw "unexpected text param: " + param;
          }
          if (range = DomUtils.getRange()) {
            startContainer = range.startContainer;
            startOffset = range.startOffset;
            endContainer = range.endContainer;
            endOffset = range.endOffset;
          }
          params = this.getElementParams(element);
          if (insert) {
            params[param] = value;
          } else {
            delete params[param];
          }
          newElement = this._createLineElement(params);
          nodes = DomUtils.getNodeAndNextSiblings(element.firstChild);
          nodes.pop();
          DomUtils.moveNodesToStart(newElement, nodes);
          DomUtils.insertNextTo(newElement, element);
          $(element).remove();
          if (range) {
            if (endContainer === element) {
              range.setEnd(newElement, endOffset);
            } else {
              range.setEnd(endContainer, endOffset);
            }
            if (startContainer === element) {
              range.setStart(newElement, startOffset);
            } else {
              range.setStart(startContainer, startOffset);
            }
            return DomUtils.setRange(range);
          }
          break;
        default:
          throw 'not implemented yet';
      }
    };

    Renderer.prototype.getNextElement = function(node) {
      var child, firstNode, nextNode, type;
      if (node == null) node = this._container;
      type = this.getElementType(node);
      if (!type || type === ModelType.LINE) {
        child = node.firstChild;
        while (child) {
          if (this.getElementType(child) != null) return child;
          firstNode = this.getNextElement(child);
          if (firstNode) return firstNode;
          child = child.nextSibling;
        }
      }
      while (node !== this._container) {
        nextNode = node.nextSibling;
        while (nextNode) {
          if (this.getElementType(nextNode) != null) return nextNode;
          nextNode = nextNode.nextSibling;
        }
        node = node.parentNode;
      }
      return null;
    };

    Renderer.prototype.getPreviousElement = function(node) {
      var child, prevChild, prevElement, prevNode, type, _ref;
      if (node == null) node = this._container;
      type = this.getElementType(node);
      if (type === ModelType.LINE) {
        prevChild = (_ref = node.previousSibling) != null ? _ref.lastChild : void 0;
        if (prevChild) {
          prevElement = this.getPreviousElement(prevChild);
          if (prevElement) return prevElement;
        }
      }
      if (!type) {
        if (child = this._getDeepestLastNode(node)) {
          if (child !== node) {
            prevElement = this.getPreviousElement(child);
            if (prevElement) return prevElement;
          }
        }
      }
      while (node !== this._container) {
        prevNode = node.previousSibling;
        while (prevNode) {
          if (this.getElementType(prevNode) != null) return prevNode;
          prevNode = prevNode.previousSibling;
        }
        node = node.parentNode;
        if (this.getElementType(node) != null) return node;
      }
      return null;
    };

    Renderer.prototype.getElementType = function(element) {
      /*
              Возвращает тип указанного элемента
              @param element: HTMLElement - элемент, тип которого требуется получить
              @returns: null, если элемент не имеет типа, иначе string - одно из значений параметров класса ModelType
      */
      var _ref;
      if (!element) return null;
      return ((_ref = this._data(element, ModelField.PARAMS)) != null ? _ref[ParamsField.TYPE] : void 0) || null;
    };

    Renderer.prototype.getElementParams = function(element) {
      /*
              Возвращает копию параметров указанного элемента
              @param element: HTMLElement - элемент, параметры которого требуется получить
              @returns: Object - параметры данного элемента
      */
      var res;
      if (!element) return null;
      res = {};
      $.extend(res, this._data(element, ModelField.PARAMS));
      return res;
    };

    Renderer.prototype.getElementLength = function(element) {
      /*
              Возвращает длину элемента - смещение, которое задает элемент в снимке содержимого редактора
              @param: element - HTMLElement - элемент, длину которого требуется получить
              @returns: int - длина элемента
      */
      var type;
      type = this.getElementType(element);
      if (type == null) return 0;
      if (type !== ModelType.TEXT) return 1;
      return element.firstChild.data.length;
    };

    Renderer.prototype.insertNodeAt = function(node, index) {
      /*
              Вставляет указанную ноду по индексу в снимке содержимого, не проверяя параметры и не устанавливая параметры
              Нода будет вставлена после ноды, на которую попадает индекс
              @param node: HTMLNode - нода для вставки
              @param index: int - индекс, по котороуму следует вставить ноду
      */
      var elType, element, insert, navElement, offset, parNode, right, _ref, _ref2;
      _ref = this._getElementAndOffset(index), element = _ref[0], offset = _ref[1];
      elType = this.getElementType(element);
      switch (elType) {
        case ModelType.TEXT:
          parNode = this.getParagraphNode(element);
          _ref2 = this._splitTextElement(element, index - offset + this.getElementLength(element)), navElement = _ref2[0], right = _ref2[1];
          if (navElement) {
            insert = DomUtils.insertNextTo;
          } else {
            navElement = right;
            insert = parNode.insertBefore;
          }
          return insert(node, navElement);
        case ModelType.LINE:
          return element.insertBefore(node, element.firstChild);
        default:
          return DomUtils.insertNextTo(node, element);
      }
    };

    Renderer.prototype.getRecipientNodes = function() {
      return this._recipients;
    };

    Renderer.prototype.applyOps = function(ops, shiftCursor) {
      var lastOp, op, _i, _len;
      if (shiftCursor == null) shiftCursor = false;
      lastOp = ops.pop();
      for (_i = 0, _len = ops.length; _i < _len; _i++) {
        op = ops[_i];
        this.applyOp(op, false);
      }
      this.applyOp(lastOp, shiftCursor);
      return ops.push(lastOp);
    };

    Renderer.prototype.applyOp = function(op, shiftCursor) {
      if (shiftCursor == null) shiftCursor = false;
      if ((op.ti != null) && op[ModelField.PARAMS][ParamsField.TYPE] !== ModelType.TEXT) {
        return this._handleOiOp(op, shiftCursor);
      }
      if ((op.td != null) && op[ModelField.PARAMS][ParamsField.TYPE] !== ModelType.TEXT) {
        return this._handleOdOp(op, shiftCursor);
      }
      if (op.ti) return this._handleTiOp(op, shiftCursor);
      if (op.td) return this._handleTdOp(op, shiftCursor);
      if (op.paramsi) return this._handleParamsOp(op, shiftCursor, true);
      if (op.paramsd) return this._handleParamsOp(op, shiftCursor, false);
      if (op.oparamsi) return console.error('not implemented');
      if (op.oparamsd) return console.error('not implemented');
    };

    Renderer.prototype.destroy = function() {
      var recipientNode, _i, _len, _ref, _ref2, _results;
      _ref = this._recipients;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        recipientNode = _ref[_i];
        _results.push((_ref2 = $(recipientNode).data('recipient')) != null ? _ref2.destroy() : void 0);
      }
      return _results;
    };

    return Renderer;

  })();

  exports.Renderer = Renderer;

}).call(this);

});
require("/renderer.coffee");
