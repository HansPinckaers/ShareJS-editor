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

require.define("/template.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ck, tmpl;

  ck = window.CoffeeKup;

  tmpl = function(unread_blips) {
    /*
        Шаблон волны
    */    div('.js-wave-panel.wave-panel', function() {
      div('.editor-panel', function() {
        if (!this.editable) {
          return div('.editing-disabled-panel', 'Editing is enabled in Chromium and Google Chrome browsers');
        } else {
          button('.js-undo.undo', {
            title: 'Undo (Ctrl+Z)'
          });
          button('.js-redo.redo', {
            title: 'Redo (Ctrl+Shift+Z, Ctrl+Y)'
          });
          button('.js-make-bold.bold', {
            title: 'Bold (Ctrl+B)'
          });
          button('.js-make-italic.italic', {
            title: 'Italic (Ctrl+I)'
          });
          button('.js-make-underlined.make-underlined', {
            title: 'Underline (Ctrl+U)'
          });
          button('.js-make-struckthrough.make-struckthrough', {
            title: 'Strikethrough'
          });
          button('.js-clear-formatting.clear-formatting', {
            title: 'Clear formatting'
          });
          button('.js-make-bulleted-list.bulleted', {
            title: 'Bulleted list'
          });
          button('.js-manage-link.add-url', {
            title: 'Insert link (Ctrl+L)'
          });
          return button('.js-insert-attachment.add-image', {
            title: 'Insert attachment'
          });
        }
      });
      return div('.js-wave-error', '');
    });
    return div(function() {
      return div({
        id: 'editor'
      }, function() {});
    });
  };

  exports.renderContainer = function(params) {
    if (params == null) params = {};
    return ck.render(tmpl, params);
  };

}).call(this);

});

require.define("/editor/editor_v2.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var BrowserEvents, DomUtils, Editor, EventType, HtmlSelectionHelper, INITIAL_CONTENT, INITIAL_LINE, KeyCodes, LINK_POPUP_TIMEOUT, LineLevelParams, LinkEditor, LinkPopup, MicroEvent, ModelField, ModelType, ParamsField, Renderer, SelectionAction, TextLevelParams, Utf16Util, renderEditor;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __slice = Array.prototype.slice;

  BrowserEvents = require('../utils/browser_events');

  KeyCodes = require('../utils/key_codes').KeyCodes;

  TextLevelParams = require('./model').TextLevelParams;

  LineLevelParams = require('./model').LineLevelParams;

  ModelField = require('./model').ModelField;

  ParamsField = require('./model').ParamsField;

  ModelType = require('./model').ModelType;

  renderEditor = require('./template').renderEditor;

  Renderer = require('./renderer').Renderer;

  HtmlSelectionHelper = require('./selection/html_selection_helper').HtmlSelectionHelper;

  DomUtils = require('../utils/dom');

  MicroEvent = require('../utils/microevent');

  Utf16Util = require('../utils/string').Utf16Util;

  LinkPopup = require('./link_editor/link_popup').LinkPopup;

  LinkEditor = require('./link_editor').LinkEditor;

  EventType = (function() {

    function EventType() {}

    EventType.INPUT = 'INPUT';

    EventType.NAVIGATION = 'NAVIGATION';

    EventType.DELETE = 'DELETE';

    EventType.LINE = 'LINE';

    EventType.TAB = 'TAB';

    EventType.DANGEROUS = 'DANGEROUS';

    EventType.NOEFFECT = 'NOEFFECT';

    return EventType;

  })();

  SelectionAction = (function() {

    function SelectionAction() {}

    SelectionAction.DELETE = 'DELETE';

    SelectionAction.TEXT = 'TEXT';

    SelectionAction.LINE = 'LINE';

    SelectionAction.GETTEXTPARAMS = 'GETTEXTPARAMS';

    SelectionAction.GETLINEPARAMS = 'GETLINEPARAMS';

    SelectionAction.CLEARTEXTPARAMS = 'CLEARTEXTPARAMS';

    return SelectionAction;

  })();

  INITIAL_LINE = {};

  INITIAL_LINE[ModelField.TEXT] = ' ';

  INITIAL_LINE[ModelField.PARAMS] = {};

  INITIAL_LINE[ModelField.PARAMS][ParamsField.TYPE] = ModelType.LINE;

  INITIAL_CONTENT = [INITIAL_LINE];

  LINK_POPUP_TIMEOUT = 50;

  Editor = (function() {

    function Editor() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this._processLinkPopup = __bind(this._processLinkPopup, this);
      this._removeRecipient = __bind(this._removeRecipient, this);
      this._processClipboardEvent = __bind(this._processClipboardEvent, this);
      this._processDragDropEvent = __bind(this._processDragDropEvent, this);
      this._processKeyEvent = __bind(this._processKeyEvent, this);
      this._init.apply(this, args);
    }

    Editor.prototype._init = function(id, _getSnapshot, addInline, _getRecipient, _alwaysShowPopupAtBottom) {
      var _this = this;
      this._getSnapshot = _getSnapshot;
      this._getRecipient = _getRecipient;
      this._alwaysShowPopupAtBottom = _alwaysShowPopupAtBottom;
      this._editable = !!$.browser.webkit || !!$.browser.mozilla;
      this._createDom();
      this._renderer = new Renderer(id, addInline, function(id) {
        return _this._getRecipient(id, _this._removeRecipient);
      });
      this._htmlSelectionHelper = new HtmlSelectionHelper(this._container);
      return this._modifiers = {};
    };

    Editor.prototype._createDom = function() {
      var tmpContainer;
      tmpContainer = document.createElement('span');
      $(tmpContainer).append(renderEditor({
        isEditable: this._editable
      }));
      return this._container = tmpContainer.firstChild;
    };

    Editor.prototype.initContent = function() {
      var content, i, ops, _ref;
      try {
        content = this._getSnapshot();
        if (!content.length) {
          content = INITIAL_CONTENT;
          ops = [];
          for (i = _ref = content.length - 1; _ref <= 0 ? i <= 0 : i >= 0; _ref <= 0 ? i++ : i--) {
            ops.push({
              p: 0,
              ti: content[i].t,
              params: content[i].params
            });
          }
        }
        this._registerDomEventHandling();
        this._renderer.renderContent(this._container, content);
        if (ops != null) return this.emit('ops', ops);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype._registerDomEventHandling = function() {
      var $container;
      $container = $(this._container);
      this._container.addEventListener(BrowserEvents.KEYDOWN_EVENT, this._processKeyEvent, false);
      this._container.addEventListener(BrowserEvents.KEYPRESS_EVENT, this._processKeyEvent, false);
      $container.bind(BrowserEvents.DRAGDROP_EVENTS.join(' '), this._processDragDropEvent);
      $container.bind(BrowserEvents.CLIPBOARD_EVENTS.join(' '), this._processClipboardEvent);
      return $container.bind("" + BrowserEvents.TEXT_INPUT_EVENT + " " + BrowserEvents.TEXT_EVENT, this._processTextInputEvent);
    };

    Editor.prototype._unregisterDomEventHandling = function() {
      this._container.removeEventListener(BrowserEvents.KEYDOWN_EVENT, this._processKeyEvent, false);
      this._container.removeEventListener(BrowserEvents.KEYPRESS_EVENT, this._processKeyEvent, false);
      return $(this._container).unbind();
    };

    Editor.prototype._processTextInputEvent = function(event) {};

    Editor.prototype._processKeyEvent = function(event) {
      var cancel;
      cancel = this._handleKeyEvent(event);
      if (cancel) {
        event.stopPropagation();
        return event.preventDefault();
      }
    };

    Editor.prototype._handleKeyEvent = function(event) {
      var eventType;
      eventType = this._getKeyEventType(event);
      switch (eventType) {
        case EventType.INPUT:
          return this._handleTyping(event);
        case EventType.LINE:
          return this._handleNewLine(event);
        case EventType.TAB:
          return this._handleTab(event);
        case EventType.DELETE:
          return this._handleDelete(event);
        case EventType.NAVIGATION:
          return false;
        case EventType.NOEFFECT:
          event.stopPropagation();
          return false;
        case EventType.DANGEROUS:
          return true;
        default:
          console.log('unknown type');
          return true;
      }
    };

    Editor.prototype._getKeyEventType = function(event) {
      var computedKeyCode, type;
      computedKeyCode = event.which !== 0 ? event.which : event.keyCode;
      type = null;
      if (!computedKeyCode) {
        type = EventType.DANGEROUS;
      } else if (KeyCodes.NAVIGATION_KEYS.indexOf(computedKeyCode) !== -1) {
        type = EventType.NAVIGATION;
      } else if (event.type === BrowserEvents.KEYPRESS_EVENT) {
        if (computedKeyCode === KeyCodes.KEY_ESCAPE) {
          type = EventType.NOEFFECT;
        } else if (computedKeyCode === KeyCodes.KEY_TAB) {
          type = EventType.TAB;
        } else {
          type = EventType.INPUT;
        }
      } else if (computedKeyCode === KeyCodes.KEY_DELETE || computedKeyCode === KeyCodes.KEY_BACKSPACE) {
        type = EventType.DELETE;
      } else if (computedKeyCode === KeyCodes.KEY_ESCAPE || event.keyIdentifier === 'U+0010' || event.type === BrowserEvents.KEYUP_EVENT) {
        type = EventType.NOEFFECT;
      } else if (computedKeyCode === KeyCodes.KEY_ENTER) {
        type = EventType.LINE;
      } else if (computedKeyCode === KeyCodes.KEY_TAB) {
        type = EventType.TAB;
      } else {
        type = EventType.NOEFFECT;
      }
      return type;
    };

    Editor.prototype._getCurrentElement = function(node, offset) {
      var element, leftNode, rightNode;
      if (DomUtils.isTextNode(node)) {
        return [this._renderer.getPreviousElement(node), offset];
      }
      rightNode = node.childNodes[offset];
      if (rightNode) {
        element = this._renderer.getPreviousElement(rightNode);
        if (DomUtils.isTextNode(rightNode)) return [element, 0];
        return [element, this._renderer.getElementLength(element)];
      }
      leftNode = node.childNodes[offset - 1] || node;
      if (leftNode) {
        element = (this._renderer.getElementType(leftNode)) != null ? leftNode : this._renderer.getPreviousElement(leftNode);
        return [element, this._renderer.getElementLength(element)];
      }
      console.error(node, offset);
      throw 'could not determine real node';
    };

    Editor.prototype._getOffsetBefore = function(node) {
      var offset;
      offset = 0;
      while (node = this._renderer.getPreviousElement(node)) {
        offset += this._renderer.getElementLength(node);
      }
      return offset;
    };

    Editor.prototype._getStartElementAndOffset = function(range) {
      var curNode, offset, prevOffset, _ref;
      _ref = this._getCurrentElement(range.startContainer, range.startOffset), curNode = _ref[0], offset = _ref[1];
      prevOffset = this._getOffsetBefore(curNode) + offset;
      return [curNode, prevOffset];
    };

    Editor.prototype._getEndElementAndOffset = function(range) {
      var curElement, offset, prevOffset, _ref;
      _ref = this._getCurrentElement(range.endContainer, range.endOffset), curElement = _ref[0], offset = _ref[1];
      prevOffset = this._getOffsetBefore(curElement) + offset;
      return [curElement, prevOffset];
    };

    Editor.prototype._getElementTextParams = function(element) {
      /*
              Возвращает текстовые параметры указанного элемента (для нетекстовых
              элементов возвращает пустые параметры текстового объекта)
              @param element: DOM node
              @return: object
      */
      var params;
      if (this._renderer.getElementType(element) === ModelType.TEXT) {
        return this._renderer.getElementParams(element);
      }
      params = {};
      params[ParamsField.TYPE] = ModelType.TEXT;
      return params;
    };

    Editor.prototype._handleTyping = function(event) {
      var c, endElement, endElementParams, endElementUrl, endOffset, key, nextElement, nextElementParams, op, ops, params, prevElement, range, realEndOffset, realStartOffset, startElement, startOffset, value, _ref, _ref2, _ref3;
      c = Utf16Util.traverseString(String.fromCharCode(event.charCode));
      if (!c.length) return true;
      range = this.getRange();
      if (!range) return true;
      if (c === '@') {
        this.insertRecipient();
        return true;
      }
      ops = [];
      _ref = this._getStartElementAndOffset(range), startElement = _ref[0], startOffset = _ref[1];
      if (!range.collapsed) {
        try {
          _ref2 = this._getEndElementAndOffset(range), endElement = _ref2[0], endOffset = _ref2[1];
          ops = this._processSelection(startOffset, endOffset, endElement, SelectionAction.DELETE);
        } catch (e) {
          console.warn(e);
          return true;
        }
      }
      if (endElement == null) endElement = startElement;
      if (endOffset == null) endOffset = startOffset;
      params = this._getElementTextParams(startElement);
      _ref3 = this._modifiers;
      for (key in _ref3) {
        value = _ref3[key];
        if (value === null) {
          delete params[key];
        } else {
          params[key] = value;
        }
      }
      if (params[TextLevelParams.URL] != null) {
        realStartOffset = startOffset - this._getOffsetBefore(startElement);
        if (!realStartOffset) {
          if ((prevElement = this._renderer.getPreviousElement(startElement))) {
            if (this._renderer.getElementParams(prevElement)[TextLevelParams.URL] !== params[TextLevelParams.URL]) {
              delete params[TextLevelParams.URL];
            }
          } else {
            delete params[TextLevelParams.URL];
          }
        }
      }
      if (params[TextLevelParams.URL] != null) {
        endElementParams = this._renderer.getElementParams(endElement);
        endElementUrl = endElementParams[TextLevelParams.URL];
        if (endElementUrl !== params[TextLevelParams.URL]) {
          delete params[TextLevelParams.URL];
        } else {
          realEndOffset = endOffset - this._getOffsetBefore(endElement);
          if (realEndOffset === this._renderer.getElementLength(endElement)) {
            if ((nextElement = this._renderer.getNextElement(endElement))) {
              nextElementParams = this._renderer.getElementParams(nextElement);
              if (nextElementParams[TextLevelParams.URL] !== params[TextLevelParams.URL]) {
                delete params[TextLevelParams.URL];
              }
            } else {
              delete params[TextLevelParams.URL];
            }
          }
        }
      }
      op = {
        p: startOffset,
        ti: c,
        params: params
      };
      ops.push(op);
      this._submitOps(ops);
      return true;
    };

    Editor.prototype._lineIsEmpty = function(line) {
      /*
              Возвращает true, если переданный параграф является пустым
              @param line: HTMLElement
              @return: boolean
      */
      var next;
      next = this._renderer.getNextElement(line);
      if (next == null) return true;
      return this._renderer.getElementType(next) === ModelType.LINE;
    };

    Editor.prototype._handleNewLine = function(event) {
      var elem, op, params, prevLine, prevOffset, prevParams, range, _ref;
      range = this.getRange();
      if (!range) return true;
      _ref = this._getStartElementAndOffset(range), elem = _ref[0], prevOffset = _ref[1];
      prevLine = this._renderer.getParagraphNode(elem);
      prevParams = this._renderer.getElementParams(prevLine);
      params = {};
      if (prevParams[LineLevelParams.BULLETED] != null) {
        params[LineLevelParams.BULLETED] = prevParams[LineLevelParams.BULLETED];
      }
      if (this._lineIsEmpty(prevLine) && (prevParams[LineLevelParams.BULLETED] != null)) {
        op = {
          p: prevOffset - 1,
          len: 1,
          paramsd: params
        };
      } else {
        params[ParamsField.TYPE] = ModelType.LINE;
        params[ParamsField.RANDOM] = Math.random();
        op = {
          p: prevOffset,
          ti: ' ',
          params: params
        };
      }
      this._submitOp(op);
      return true;
    };

    Editor.prototype._handleTab = function(event) {
      /*
              Обрабатывает нажатие на tab
      */
      var diff, elem, line, newLevel, offset, oldLevel, opd, opi, paramsd, paramsi, prevParams, range;
      range = this.getRange();
      if (!range) return true;
      elem = this._getStartElementAndOffset(range)[0];
      line = this._renderer.getParagraphNode(elem);
      offset = this._getOffsetBefore(line);
      prevParams = this._renderer.getElementParams(line);
      if (prevParams[LineLevelParams.BULLETED] == null) return true;
      diff = event.shiftKey ? -1 : 1;
      oldLevel = prevParams[LineLevelParams.BULLETED];
      newLevel = Math.max(0, oldLevel + diff);
      if (oldLevel === newLevel) return true;
      paramsd = {};
      paramsd[LineLevelParams.BULLETED] = oldLevel;
      opd = {
        p: offset,
        len: 1,
        paramsd: paramsd
      };
      paramsi = {};
      paramsi[LineLevelParams.BULLETED] = newLevel;
      opi = {
        p: offset,
        len: 1,
        paramsi: paramsi
      };
      this._submitOps([opd, opi]);
      return true;
    };

    Editor.prototype._getDeleteOp = function(element, index, length) {
      /*
              Генерирует операцию удаления
              @param element: HTMLNode - элемент, в котором будет происходить удаление
              @param index: int - индекс, по которому будет происходить удаление
              @param length: int - обязательный параметр для удаления текста, при удалении элементов остальных
                      типов не будет использован
      */
      var beforeOffset, op, textOffset, type;
      type = this._renderer.getElementType(element);
      op = {
        p: index,
        params: this._renderer.getElementParams(element)
      };
      switch (type) {
        case ModelType.TEXT:
          beforeOffset = this._getOffsetBefore(element);
          textOffset = index - beforeOffset;
          op.td = element.firstChild.data.substr(textOffset, length);
          break;
        default:
          op.td = ' ';
      }
      return op;
    };

    Editor.prototype._deleteNext = function(element, offset, moveToNextElement) {
      var nextElement, realOffset, type;
      if (moveToNextElement == null) moveToNextElement = true;
      if (!offset) return null;
      nextElement = this._renderer.getNextElement(element);
      type = this._renderer.getElementType(element);
      switch (type) {
        case ModelType.TEXT:
          realOffset = offset - this._getOffsetBefore(element);
          if (this._renderer.getElementLength(element) > realOffset) {
            return this._getDeleteOp(element, offset, 1);
          } else {
            if (moveToNextElement && nextElement) {
              return this._deleteNext(nextElement, offset, false);
            }
            return null;
          }
          break;
        default:
          if (moveToNextElement) {
            if (nextElement) return this._deleteNext(nextElement, offset, false);
            return null;
          } else {
            if (this._renderer.getElementType(element) === ModelType.BLIP) {
              return null;
            }
            return this._getDeleteOp(element, offset);
          }
      }
    };

    Editor.prototype._deletePrev = function(element, offset) {
      var prevElement, realOffset, type;
      if (!offset) return null;
      prevElement = this._renderer.getPreviousElement(element);
      type = this._renderer.getElementType(element);
      switch (type) {
        case ModelType.TEXT:
          realOffset = offset - this._getOffsetBefore(element);
          if (realOffset < 0) {
            if (prevElement) return this._deletePrev(prevElement, offset);
            return null;
          } else {
            return this._getDeleteOp(element, offset, 1);
          }
          break;
        default:
          if (this._renderer.getElementType(element) === ModelType.BLIP) {
            return null;
          }
          return this._getDeleteOp(element, offset);
      }
    };

    Editor.prototype._getTextMarkupOps = function(element, index, length, param, value) {
      var op, ops, params, type;
      ops = [];
      if (!TextLevelParams.isValid(param)) {
        throw new Error("Bad text param is set: " + param + ", " + value);
      }
      type = this._renderer.getElementType(element);
      if (type !== ModelType.TEXT) return ops;
      params = this._renderer.getElementParams(element);
      if (params[param] != null) {
        op = {
          p: index,
          len: length,
          paramsd: {}
        };
        op.paramsd[param] = params[param];
        ops.push(op);
      }
      if (value != null) {
        op = {
          p: index,
          len: length,
          paramsi: {}
        };
        op.paramsi[param] = value;
        ops.push(op);
      }
      return ops;
    };

    Editor.prototype._getClearTextMarkupOps = function(element, index, length) {
      var op, ops, param, params, type;
      ops = [];
      type = this._renderer.getElementType(element);
      if (type !== ModelType.TEXT) return ops;
      params = this._renderer.getElementParams(element);
      for (param in params) {
        if (param === ParamsField.TYPE) continue;
        if (param === TextLevelParams.URL) continue;
        op = {
          p: index,
          len: length,
          paramsd: {}
        };
        op.paramsd[param] = params[param];
        ops.push(op);
      }
      return ops;
    };

    Editor.prototype._getLineMarkupOps = function(element, index, param, value) {
      var op, ops, params, type;
      ops = [];
      if (!LineLevelParams.isValid(param)) {
        throw new Error("Bad line param is set: " + param + ", " + value);
      }
      type = this._renderer.getElementType(element);
      if (type !== ModelType.LINE) return ops;
      params = this._renderer.getElementParams(element);
      if (params[param] != null) {
        op = {
          p: index,
          len: 1,
          paramsd: {}
        };
        op.paramsd[param] = params[param];
        ops.push(op);
      }
      if (value != null) {
        op = {
          p: index,
          len: 1,
          paramsi: {}
        };
        op.paramsi[param] = value;
        ops.push(op);
      }
      return ops;
    };

    Editor.prototype._processSelection = function(startOffset, endOffset, lastElement, action, param, value) {
      /*
              The specified selection returns the results obtained by one of the following:
              SelectionAction.DELETE: delete returns ShareJS-deletion
              SelectionAction.TEXT: modify text vozvvraschaet ShareJS-operation
                  Marking the text
              SelectionAction.LINE: parameter has modified the paragraph returns ShareJS-operation
                  marking paragraphs
              SelectionAction.GETTEXTPARAMS: text parameters, returns an array of options
                  for all text boxes within the selection
              SelectionAction.GETLINEPARAMS: abzatsevye parameters. returns an array of options
                  for all paragraphs containing the selection
              SelectionAction.CLEARTEXTPARAMS: delete the text parameter, returns ShareJS-operation
                  removal of marking text (excluding references)
              @ Param startOffset: int - the starting offset
              @ Param endOffset: int - the end offset (not including the element of bias)
              @ Param lastElement: HTMLElement - the element that gets the end of selection (included in release)
              @ Param action: SelectionAction - an action that will take place over the allocation of
              @ Param param: the parameter name for the label (for action by the marking allocation)
              @ Param value: value for labeling (for action on labeling vedeleniya)
              @ Returns: [object]
      */
      var beforeOffset, index, ops, params, res, selectionLength, type, workingLength;
      res = [];
      selectionLength = endOffset - startOffset;
      while (selectionLength) {
        params = this._renderer.getElementParams(lastElement);
        type = this._renderer.getElementType(lastElement);
        beforeOffset = this._getOffsetBefore(lastElement);
        workingLength = Math.min(selectionLength, endOffset - beforeOffset);
        index = endOffset - workingLength;
        switch (action) {
          case SelectionAction.DELETE:
            ops = [this._getDeleteOp(lastElement, index, workingLength)];
            break;
          case SelectionAction.TEXT:
            ops = this._getTextMarkupOps(lastElement, index, workingLength, param, value);
            break;
          case SelectionAction.LINE:
            ops = this._getLineMarkupOps(lastElement, index, param, value);
            break;
          case SelectionAction.CLEARTEXTPARAMS:
            ops = this._getClearTextMarkupOps(lastElement, index, workingLength);
            break;
          case SelectionAction.GETTEXTPARAMS:
            type = this._renderer.getElementType(lastElement);
            if (type === ModelType.TEXT) {
              ops = [this._renderer.getElementParams(lastElement)];
            } else {
              ops = null;
            }
            break;
          case SelectionAction.GETLINEPARAMS:
            type = this._renderer.getElementType(lastElement);
            if (type === ModelType.LINE) {
              ops = [this._renderer.getElementParams(lastElement)];
            } else {
              ops = null;
            }
        }
        while (ops && ops.length) {
          if (action === SelectionAction.TEXT) {
            res.unshift(ops.pop());
          } else {
            res.push(ops.shift());
          }
        }
        endOffset -= workingLength;
        selectionLength -= workingLength;
        lastElement = this._renderer.getPreviousElement(lastElement);
      }
      return res;
    };

    Editor.prototype._handleDelete = function(event) {
      var element, endElement, endOffset, op, ops, prevOffset, range, _ref, _ref2, _ref3;
      range = this.getRange();
      if (!range) return true;
      _ref = this._getStartElementAndOffset(range), element = _ref[0], prevOffset = _ref[1];
      if (!range.collapsed) {
        try {
          _ref2 = this._getEndElementAndOffset(range), endElement = _ref2[0], endOffset = _ref2[1];
          ops = this._processSelection(prevOffset, endOffset, endElement, SelectionAction.DELETE);
          if (ops.length) this._submitOps(ops);
        } catch (e) {
          console.warn(e);
          console.warn(e.stack);
        }
        return true;
      }
      _ref3 = this._getStartElementAndOffset(range), element = _ref3[0], prevOffset = _ref3[1];
      if (event.keyCode === KeyCodes.KEY_DELETE) {
        try {
          op = this._deleteNext(element, prevOffset);
        } catch (e) {
          console.warn('Error while handle delete', element, prevOffset, e);
          console.warn(e.stack);
          return true;
        }
      } else {
        try {
          op = this._deletePrev(element, prevOffset - 1);
        } catch (e) {
          console.warn('Error while handle bcksp', element, prevOffset, e);
          console.warn(e.stack);
          return true;
        }
      }
      if (op) this._submitOp(op);
      return true;
    };

    Editor.prototype._processDragDropEvent = function(event) {
      console.warn('block dnd event');
      event.preventDefault();
      return event.stopPropagation();
    };

    Editor.prototype._processClipboardEvent = function($event) {
      var cancel, event;
      event = $event.originalEvent;
      cancel = this._handleClipboardEvent(event);
      if (cancel) {
        event.stopPropagation();
        return event.preventDefault();
      }
    };

    Editor.prototype._handleClipboardEvent = function(event) {
      if (event.type === BrowserEvents.COPY_EVENT) return false;
      if (event.type === BrowserEvents.PASTE_EVENT) {
        return this._handlePasteEvent(event);
      }
      if (event.type === BrowserEvents.CUT_EVENT) return true;
      console.warn('block clipboardevent event', event.type);
      event.stopPropagation();
      event.preventDefault();
      return true;
    };

    Editor.prototype._handlePasteEvent = function(event) {
      var data, endElement, endOffset, line, lineOp, lines, offset, ops, params, range, startElement, textOp, _i, _len, _ref, _ref2;
      if (!(event.clipboardData && event.clipboardData.getData)) return true;
      range = this.getRange();
      if (!range) return;
      if (/text\/plain/.test(event.clipboardData.types)) {
        ops = [];
        _ref = this._getStartElementAndOffset(range), startElement = _ref[0], offset = _ref[1];
        if (!range.collapsed) {
          _ref2 = this._getEndElementAndOffset(range), endElement = _ref2[0], endOffset = _ref2[1];
          try {
            ops = this._processSelection(offset, endOffset, endElement, SelectionAction.DELETE);
          } catch (e) {
            this.emit('error', e);
            return true;
          }
        }
        data = event.clipboardData.getData('text/plain');
        data = data.replace(/\t/g, '    ');
        lines = data.split(/[\n\r]/g);
        for (_i = 0, _len = lines.length; _i < _len; _i++) {
          line = lines[_i];
          line = Utf16Util.traverseString(line);
          if (line.length) {
            params = {};
            params[ParamsField.TYPE] = ModelType.TEXT;
            textOp = {
              p: offset,
              ti: line,
              params: params
            };
            offset += line.length;
            ops.push(textOp);
          }
          params = {};
          params[ParamsField.TYPE] = ModelType.LINE;
          params[ParamsField.RANDOM] = Math.random();
          lineOp = {
            p: offset,
            ti: ' ',
            params: params
          };
          ops.push(lineOp);
          offset++;
        }
        if (ops.length < 2) return true;
        ops.pop();
        try {
          this._submitOps(ops);
        } catch (e) {
          this.emit('error', e);
        }
      }
      return true;
    };

    Editor.prototype._submitOp = function(op) {
      var _this = this;
      this._renderer.applyOp(op, true);
      if (this._cursor) {
        setTimeout(function() {
          return _this._processCursor();
        }, 0);
      }
      return this.emit('ops', [op]);
    };

    Editor.prototype._submitOps = function(ops) {
      var _this = this;
      this._renderer.applyOps(ops, true);
      if (this._cursor) {
        setTimeout(function() {
          return _this._processCursor();
        }, 0);
      }
      return this.emit('ops', ops);
    };

    Editor.prototype.getRange = function() {
      return this._htmlSelectionHelper.getRange();
    };

    Editor.prototype.insertBlip = function(id) {
      var op, params, range, startElement, startOffset, _ref;
      try {
        range = this.getRange();
        if (!range) return;
        _ref = this._getEndElementAndOffset(range), startElement = _ref[0], startOffset = _ref[1];
        params = {};
        params[ParamsField.TYPE] = ModelType.BLIP;
        params[ParamsField.ID] = id;
        params[ParamsField.RANDOM] = Math.random();
        op = {
          p: startOffset,
          ti: ' ',
          params: params
        };
        return this._submitOp(op);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.insertBlipToEnd = function(id) {
      var element, offset, op, params;
      offset = 0;
      while (element = this._renderer.getNextElement(element)) {
        offset += this._renderer.getElementLength(element);
      }
      params = {};
      params[ParamsField.TYPE] = ModelType.BLIP;
      params[ParamsField.ID] = id;
      params[ParamsField.RANDOM] = Math.random();
      op = {
        p: offset,
        ti: ' ',
        params: params
      };
      try {
        return this._submitOp(op);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.removeBlip = function(id) {
      var element, offset, op, params, _results;
      try {
        element = null;
        _results = [];
        while (element = this._renderer.getNextElement(element)) {
          if (this._renderer.getElementType(element) !== ModelType.BLIP) continue;
          params = this._renderer.getElementParams(element);
          if (params[ParamsField.ID] !== id) continue;
          offset = this._getOffsetBefore(element);
          op = {
            p: offset,
            td: ' ',
            params: params
          };
          this._submitOp(op);
          break;
        }
        return _results;
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.insertAttachment = function(url) {
      var op, params, range, startElement, startOffset, _ref;
      try {
        range = this.getRange();
        if (!range) return;
        _ref = this._getEndElementAndOffset(range), startElement = _ref[0], startOffset = _ref[1];
        params = {};
        params[ParamsField.TYPE] = ModelType.ATTACHMENT;
        params[ParamsField.URL] = url;
        params[ParamsField.RANDOM] = Math.random();
        op = {
          p: startOffset,
          ti: ' ',
          params: params
        };
        return this._submitOp(op);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.insertRecipient = function() {
      /*
              Вставляет поле ввода для получателя сообщения
              Создает обработчики потери фокуса и нажатия клавиш.
              При выборе участника удаляет поле ввода и генерирует операцию для вставки получателя
      */
      var offset, params, range, recipient, recipientContainer, startElement, _ref;
      var _this = this;
      try {
        range = this.getRange();
        if (!range) return;
        recipient = this._getRecipient(null);
        recipientContainer = recipient.getContainer();
        this._renderer.preventEventsPropagation(recipientContainer);
        _ref = this._getEndElementAndOffset(range), startElement = _ref[0], offset = _ref[1];
        this._renderer.insertNodeAt(recipientContainer, offset);
        params = this._renderer.getElementParams(startElement);
        recipient.focus();
        $(recipientContainer).bind('itemSelected', function(event, userId) {
          var op;
          if (userId == null) return;
          offset = _this._getOffsetBefore(recipientContainer);
          $(recipientContainer).remove();
          params = {};
          params[ParamsField.TYPE] = ModelType.RECIPIENT;
          params[ParamsField.ID] = userId;
          params[ParamsField.RANDOM] = Math.random();
          op = {
            p: offset,
            ti: ' ',
            params: params
          };
          return _this._submitOp(op);
        });
        return $(recipientContainer).bind("blur " + (BrowserEvents.KEY_EVENTS.join(' ')), function(event) {
          var op;
          if ((event.keyCode != null) && event.keyCode !== KeyCodes.KEY_ESCAPE) {
            return;
          }
          offset = _this._getOffsetBefore(recipientContainer);
          $(recipientContainer).remove();
          if (params[ParamsField.TYPE] !== ModelType.TEXT) {
            params = {};
            params[ParamsField.TYPE] = ModelType.TEXT;
          }
          op = {
            p: offset,
            ti: '@',
            params: params
          };
          return _this._submitOp(op);
        });
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype._removeRecipient = function(recipient) {
      /*
              Удаляет получателя сообщения из редактора
              @param recipient: Recipient - получатель, которого надо удалить
      */
      var offset, op, recipientNode, recipientParams;
      recipientNode = recipient.getContainer();
      recipientParams = this._renderer.getElementParams(recipientNode);
      offset = this._getOffsetBefore(recipientNode);
      op = {
        p: offset,
        td: ' ',
        params: recipientParams
      };
      try {
        return this._submitOp(op);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.hasRecipients = function() {
      /*
              Проверяет наличия хотя бы одного получателя сообщения в редакторе
              @returns: boolean - true, если в редакторе присутствует хотя бы один получатель, иначе false
      */      return this._renderer.getRecipientNodes().length > 0;
    };

    Editor.prototype.getRecipients = function() {
      /*
              Возвращает массив, содержащий объекты получателей данного сообщения
              @returns: [Recipient]
      */
      var recipientNode, recipientNodes, recipients, _i, _len;
      recipientNodes = this._renderer.getRecipientNodes();
      recipients = [];
      for (_i = 0, _len = recipientNodes.length; _i < _len; _i++) {
        recipientNode = recipientNodes[_i];
        recipients.push($(recipientNode).data('recipient'));
      }
      return recipients;
    };

    Editor.prototype.getNextBlip = function(element) {
      if (element == null) element = null;
      /*
              Возвращает идентификатор блипа, следующего за указанной нодой, или null, если следующего блипа нет
              @param element: HTMLNode - нода, после которой надо начать поиск
              @returns: [string, HTMLElement]
      */
      while (element = this._renderer.getNextElement(element)) {
        if (this._renderer.getElementType(element) !== ModelType.BLIP) continue;
        return [this._renderer.getElementParams(element)[ParamsField.ID], element];
      }
      return [null, null];
    };

    Editor.prototype.markLink = function(value) {
      var element, endElement, endOffset, ops, prevOffset, range, _ref, _ref2;
      try {
        range = this.getRange();
        if (!range || range.collapsed) return true;
        _ref = this._getStartElementAndOffset(range), element = _ref[0], prevOffset = _ref[1];
        _ref2 = this._getEndElementAndOffset(range), endElement = _ref2[0], endOffset = _ref2[1];
        ops = this._processSelection(prevOffset, endOffset, endElement, SelectionAction.TEXT, TextLevelParams.URL, value);
        if (ops != null ? ops.length : void 0) this._submitOps(ops);
        return true;
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.getContainer = function() {
      return this._container;
    };

    Editor.prototype.applyOps = function(ops, shiftCursor) {
      var _this = this;
      try {
        this._renderer.applyOps(ops, shiftCursor);
        if (this._cursor) {
          return setTimeout(function() {
            return _this._processCursor();
          }, 0);
        }
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.setEditable = function(editable) {
      if (!($.browser.webkit || $.browser.mozilla)) return;
      if (editable === this._editable) return;
      this._editable = editable;
      this._container.contentEditable = this._editable.toString();
      if (this._editable) {
        return this._registerDomEventHandling();
      } else {
        return this._unregisterDomEventHandling();
      }
    };

    Editor.prototype.containsNode = function(node) {
      /*
              Возвращает true, если указанный элемент находиться в этом редакторе
              @param node: HTMLElement
              @return: boolean
      */      return DomUtils.contains(this._container, node);
    };

    Editor.prototype.setEditingModifiers = function(_modifiers) {
      return this._modifiers = _modifiers;
      /*
              Устанавливает модификаторы стиля текста, которые будут применены к
              вводимому тексту
              @param _modifiers: object
      */
    };

    Editor.prototype.setRangeTextParam = function(name, value) {
      /*
              Устанавливает указанный текстовый параметр на текущем выбранном
              диапазоне в указанное значение.
              Если value=null, удаляет указанный параметр.
              @param name: string
              @param value: any
      */
      var element, endElement, endOffset, ops, prevOffset, range, _ref, _ref2;
      try {
        range = this.getRange();
        if (!range || range.collapsed) return;
        _ref = this._getStartElementAndOffset(range), element = _ref[0], prevOffset = _ref[1];
        _ref2 = this._getEndElementAndOffset(range), endElement = _ref2[0], endOffset = _ref2[1];
        ops = this._processSelection(prevOffset, endOffset, endElement, SelectionAction.TEXT, name, value);
        if (ops != null ? ops.length : void 0) return this._submitOps(ops);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype._filterSameParams = function(blocks) {
      /*
              Возвращает объект, содержащий все пары ключ-значение, совпадающие
              у всех объектов переданного массива.
              @param blocks: [object]
              @return: object
      */
      var blockParams, key, params, _i, _j, _len, _len2, _ref;
      if (!blocks.length) return {};
      params = blocks.pop();
      for (_i = 0, _len = blocks.length; _i < _len; _i++) {
        blockParams = blocks[_i];
        _ref = Object.keys(params);
        for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
          key = _ref[_j];
          if (params[key] !== blockParams[key]) delete params[key];
        }
      }
      return params;
    };

    Editor.prototype._hasTextParams = function(block, neededParams) {
      /*
              Возвращает true, если для указанного блока есть текстовый параметр
              @param block: object
              @param neededParams: {paramName: anything}
              @return: boolean
      */
      var param;
      for (param in block) {
        if (param === ParamsField.TYPE) continue;
        if (!(param in neededParams)) continue;
        return true;
      }
      return false;
    };

    Editor.prototype.hasTextParams = function(neededParams) {
      /*
              Возврващает true, если в выделенном тексте установлен хотя бы один из
              переданных параметров.
              @param neededParams: {paramName: anything}
              @return: boolean
      */
      var blocks, endElement, endOffset, params, range, startElement, startOffset, _i, _len, _ref, _ref2;
      try {
        range = this.getRange();
        if (!range) return false;
        _ref = this._getEndElementAndOffset(range), endElement = _ref[0], endOffset = _ref[1];
        if (range.collapsed) {
          params = this._getElementTextParams(endElement);
          return this._hasTextParams(params, neededParams);
        } else {
          _ref2 = this._getStartElementAndOffset(range), startElement = _ref2[0], startOffset = _ref2[1];
          blocks = this._processSelection(startOffset, endOffset, endElement, SelectionAction.GETTEXTPARAMS);
          for (_i = 0, _len = blocks.length; _i < _len; _i++) {
            params = blocks[_i];
            if (this._hasTextParams(params, neededParams)) return true;
          }
        }
        return false;
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.getTextParams = function() {
      /*
              Возвращает общие для выделенного текста параметры.
              @return: object
      */
      var blocks, endElement, endOffset, params, range, startElement, startOffset, _ref, _ref2;
      try {
        range = this.getRange();
        if (!range) return {};
        _ref = this._getEndElementAndOffset(range), endElement = _ref[0], endOffset = _ref[1];
        if (range.collapsed) {
          params = this._getElementTextParams(endElement);
        } else {
          _ref2 = this._getStartElementAndOffset(range), startElement = _ref2[0], startOffset = _ref2[1];
          blocks = this._processSelection(startOffset, endOffset, endElement, SelectionAction.GETTEXTPARAMS);
          params = this._filterSameParams(blocks);
        }
        delete params[ParamsField.TYPE];
        return params;
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.setRangeLineParam = function(name, value) {
      /*
              Устанавливает указанный параметр параграфа для всех параграфов, которые
              содержат текущий выбранный диапазон.
              Если value=null, удаляет указанный параметр.
              @param name: string
              @param value: any
      */
      var endElement, endOffset, ops, range, startElement, startOffset, _ref;
      try {
        range = this.getRange();
        if (!range) return;
        startElement = this._getStartElementAndOffset(range)[0];
        startElement = this._renderer.getParagraphNode(startElement);
        startOffset = this._getOffsetBefore(startElement);
        _ref = this._getEndElementAndOffset(range), endElement = _ref[0], endOffset = _ref[1];
        ops = this._processSelection(startOffset, endOffset, endElement, SelectionAction.LINE, name, value);
        if (ops != null ? ops.length : void 0) return this._submitOps(ops);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.getLineParams = function() {
      /*
              Возвращает параметры
      */
      var blocks, endElement, endOffset, params, range, startElement, startOffset, _ref;
      try {
        range = this.getRange();
        if (!range) return {};
        _ref = this._getEndElementAndOffset(range), endElement = _ref[0], endOffset = _ref[1];
        startElement = this._getStartElementAndOffset(range)[0];
        startElement = this._renderer.getParagraphNode(startElement);
        startOffset = this._getOffsetBefore(startElement);
        blocks = this._processSelection(startOffset, endOffset, endElement, SelectionAction.GETLINEPARAMS);
        params = this._filterSameParams(blocks);
        delete params[ParamsField.TYPE];
        return params;
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.clearSelectedTextFormatting = function() {
      /*
              Очищает текстовое форматирование выбранного участка
      */
      var element, endElement, endOffset, ops, prevOffset, range, _ref, _ref2;
      try {
        range = this.getRange();
        if (!range || range.collapsed) return;
        _ref = this._getStartElementAndOffset(range), element = _ref[0], prevOffset = _ref[1];
        _ref2 = this._getEndElementAndOffset(range), endElement = _ref2[0], endOffset = _ref2[1];
        ops = this._processSelection(prevOffset, endOffset, endElement, SelectionAction.CLEARTEXTPARAMS);
        if (ops != null ? ops.length : void 0) return this._submitOps(ops);
      } catch (e) {
        return this.emit('error', e);
      }
    };

    Editor.prototype.selectAll = function() {
      /*
              Выделяет все содержимое редактора
              range.selectNodeContents(@_container)
      */
      var range;
      range = document.createRange();
      range.selectNodeContents(this._container);
      return DomUtils.setRange(range);
    };

    Editor.prototype.setCursorToStart = function() {
      /*
              Устанавливает курсор в начало редактора
      */
      var range;
      range = document.createRange();
      range.setStart(this._container, 0);
      range.setEnd(this._container, 0);
      return DomUtils.setRange(range);
    };

    Editor.prototype._processLinkPopup = function() {
      var linkPopup, nextElement, offset, openLinkEditor, prevElement, range, relativeNode, relativeParent, startElement, url, _ref, _ref2;
      var _this = this;
      this._linkPopupTimer = null;
      range = this.getRange();
      linkPopup = LinkPopup.get();
      if (!range) return linkPopup.hide();
      _ref = this._getStartElementAndOffset(range), startElement = _ref[0], offset = _ref[1];
      url = (_ref2 = this._renderer.getElementParams(startElement)) != null ? _ref2[TextLevelParams.URL] : void 0;
      if (url == null) return linkPopup.hide();
      offset -= this._getOffsetBefore(startElement);
      if (offset === 0) {
        prevElement = this._renderer.getPreviousElement(startElement);
        if (!prevElement || url !== this._renderer.getElementParams(prevElement)[TextLevelParams.URL]) {
          return linkPopup.hide();
        }
      }
      if (offset === this._renderer.getElementLength(startElement)) {
        nextElement = this._renderer.getNextElement(startElement);
        if (!nextElement || url !== this._renderer.getElementParams(nextElement)[TextLevelParams.URL]) {
          return linkPopup.hide();
        }
      }
      if (linkPopup.getContainer().parentNode !== this._container.parentNode) {
        DomUtils.insertNextTo(linkPopup.getContainer(), this._container);
      }
      openLinkEditor = function() {
        return LinkEditor.get().open(_this);
      };
      relativeNode = document.createElement('span');
      range.insertNode(relativeNode);
      linkPopup.show(url, relativeNode, openLinkEditor, this._alwaysShowPopupAtBottom);
      relativeParent = relativeNode.parentNode;
      relativeParent.removeChild(relativeNode);
      return relativeParent.normalize();
    };

    Editor.prototype._processCursor = function() {
      if (this._linkPopupTimer != null) clearTimeout(this._linkPopupTimer);
      return this._linkPopupTimer = setTimeout(this._processLinkPopup, LINK_POPUP_TIMEOUT);
    };

    Editor.prototype.setCursor = function() {
      this._cursor = true;
      return this._processCursor();
    };

    Editor.prototype.updateCursor = function() {
      return this._processCursor();
    };

    Editor.prototype.clearCursor = function() {
      this._cursor = false;
      return LinkPopup.get().hide();
    };

    Editor.prototype.setCursorToEnd = function() {
      /*
              Устанавливает курсор в конец редактора
      */
      var range;
      range = document.createRange();
      range.setStartAfter(this._container.lastChild);
      range.setEndAfter(this._container.lastChild);
      return DomUtils.setRange(range);
    };

    Editor.prototype.hasCollapsedCursor = function() {
      /*
              Возвращает true, если в редакторе содержится курсор без выделения
              @return: boolean
      */
      var range;
      range = this.getRange();
      if (!range) return false;
      return range.collapsed;
    };

    Editor.prototype.isLastElementNotShiftedBlip = function() {
      var element, parNode;
      element = this._renderer.getPreviousElement(null);
      if (this._renderer.getElementType(element) !== ModelType.BLIP) return false;
      parNode = this._renderer.getParagraphNode(element);
      if (this._renderer.getElementParams(parNode)[LineLevelParams.BULLETED] == null) {
        return true;
      }
      return false;
    };

    Editor.prototype.destroy = function() {
      this._unregisterDomEventHandling();
      return this._renderer.destroy();
    };

    return Editor;

  })();

  MicroEvent.mixin(Editor);

  exports.Editor = Editor;

}).call(this);

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

require.define("/utils/key_codes.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var KeyCodes;

  KeyCodes = (function() {

    function KeyCodes() {}

    KeyCodes.KEY_ALT = 18;

    KeyCodes.KEY_BACKSPACE = 8;

    KeyCodes.KEY_CTRL = 17;

    KeyCodes.KEY_DELETE = 46;

    KeyCodes.KEY_DOWN = 40;

    KeyCodes.KEY_END = 35;

    KeyCodes.KEY_ENTER = 13;

    KeyCodes.KEY_ESCAPE = 27;

    KeyCodes.KEY_HOME = 36;

    KeyCodes.KEY_LEFT = 37;

    KeyCodes.KEY_PAGEDOWN = 34;

    KeyCodes.KEY_PAGEUP = 33;

    KeyCodes.KEY_RIGHT = 39;

    KeyCodes.KEY_SHIFT = 16;

    KeyCodes.KEY_TAB = 9;

    KeyCodes.KEY_UP = 38;

    KeyCodes.NAVIGATION_KEYS = [KeyCodes.KEY_LEFT, KeyCodes.KEY_RIGHT, KeyCodes.KEY_UP, KeyCodes.KEY_DOWN, KeyCodes.KEY_PAGEUP, KeyCodes.KEY_PAGEDOWN, KeyCodes.KEY_HOME, KeyCodes.KEY_END];

    return KeyCodes;

  })();

  exports.KeyCodes = KeyCodes;

}).call(this);

});

require.define("/editor/model/index.coffee", function (require, module, exports, __dirname, __filename) {
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

require.define("/editor/template.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ck, editorTmpl;

  ck = window.CoffeeKup;

  editorTmpl = function() {
    return div('.editor', {
      contentEditable: this.isEditable.toString(),
      spellcheck: 'false'
    }, '');
  };

  exports.renderEditor = function(params) {
    return ck.render(editorTmpl, params);
  };

}).call(this);

});

require.define("/editor/renderer.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Attachment, BULLETED_LIST_LEVEL_PADDING, BrowserEvents, DATA_KEY, DomUtils, LineLevelParams, ModelField, ModelType, ParamsField, Renderer, TextLevelParams;
  var __slice = Array.prototype.slice;

  BrowserEvents = require('../utils/browser_events');

  ModelField = require('./model').ModelField;

  ParamsField = require('./model').ParamsField;

  ModelType = require('./model').ModelType;

  TextLevelParams = require('./model').TextLevelParams;

  LineLevelParams = require('./model').LineLevelParams;

  DomUtils = require('../utils/dom');

  Attachment = require('./attachment').Attachment;

  BULLETED_LIST_LEVEL_PADDING = 15;

  DATA_KEY = '__rizzoma_data_key';

  Renderer = (function() {

    function Renderer() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this._init.apply(this, args);
    }

    Renderer.prototype._init = function(_id, _addInline, _getRecipient) {
      this._id = _id;
      this._addInline = _addInline;
      this._getRecipient = _getRecipient;
      return this._recipients = [];
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

    Renderer.prototype.renderContent = function(_container, content) {
      var $container, $curPar, $node, element, index, _len, _results;
      this._container = _container;
      /*
              Отрисовка содержимого редактора по снимку его содержимого
              @param _container: HTMLElement - элемент редактора, в который будет вставляться содержимое
              @param content: [Object] - снимок содержимого
      */
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
      console.log(node);
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
        console.log("not" + type + "or ModelType.LINE");
        child = node.firstChild;
        while (child) {
          console.log(this.getElementType(child) != null);
          if (this.getElementType(child) != null) return child;
          firstNode = this.getNextElement(child);
          console.log(firstNode);
          if (firstNode) return firstNode;
          child = child.nextSibling;
        }
      }
      while (node !== this._container) {
        console.log("node is @_container");
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

require.define("/editor/attachment/index.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var Attachment, escapeHTML, renderAttachment;
  var __slice = Array.prototype.slice;

  renderAttachment = require('./template').renderAttachment;

  escapeHTML = require('../../utils/string').escapeHTML;

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

require.define("/editor/attachment/template.coffee", function (require, module, exports, __dirname, __filename) {
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

require.define("/editor/selection/html_selection_helper.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var DomUtils, HtmlSelectionHelper;
  var __slice = Array.prototype.slice;

  DomUtils = require('../../utils/dom');

  HtmlSelectionHelper = (function() {

    /*
        Вспомогательный класс для работы с выделениями
    */

    function HtmlSelectionHelper() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this._init.apply(this, args);
    }

    HtmlSelectionHelper.prototype._init = function(_container) {
      this._container = _container;
    };

    HtmlSelectionHelper.prototype._isFullyInside = function(selection, node) {
      /*
                  Check that current selection is fully inside node
      */
      var anchorNode, focusNode;
      anchorNode = selection.anchorNode;
      focusNode = selection.focusNode;
      return (anchorNode === node || DomUtils.contains(node, anchorNode)) && (focusNode === node || DomUtils.contains(node, anchorNode));
    };

    HtmlSelectionHelper.prototype._isNodeInChildEditorOrNonEditableNode = function(node) {
      node = DomUtils.isTextNode(node) ? node.parentNode : node;
      while ((node != null) && node !== this._container) {
        if (node.hasAttribute('contentEditable')) return true;
        node = node.parentNode;
      }
      return false;
    };

    HtmlSelectionHelper.prototype._isInChildEditorOrNonEditableNode = function(selection) {
      if (selection.isCollapsed) {
        return this._isNodeInChildEditorOrNonEditableNode(selection.anchorNode);
      } else {
        return this._isNodeInChildEditorOrNonEditableNode(selection.anchorNode) || this._isNodeInChildEditorOrNonEditableNode(selection.focusNode);
      }
    };

    HtmlSelectionHelper.prototype.getSelection = function() {
      var selection;
      selection = window.getSelection();
      if (!(selection != null) || !this._isFullyInside(selection, this._container) || this._isInChildEditorOrNonEditableNode(selection)) {
        return null;
      }
      return selection;
    };

    HtmlSelectionHelper.prototype.getRange = function() {
      var selection;
      selection = this.getSelection();
      if (!selection || !selection.rangeCount) return null;
      return selection.getRangeAt(0);
    };

    return HtmlSelectionHelper;

  })();

  exports.HtmlSelectionHelper = HtmlSelectionHelper;

}).call(this);

});

require.define("/utils/microevent.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var MicroEvent, nextTick;
  var __slice = Array.prototype.slice;

  nextTick = (typeof process !== "undefined" && process !== null ? process.nextTick : void 0) || function(fn) {
    return setTimeout(fn, 0);
  };

  MicroEvent = (function() {

    function MicroEvent() {}

    MicroEvent.prototype.on = function(event, fct) {
      var _base;
      this._events || (this._events = {});
      (_base = this._events)[event] || (_base[event] = []);
      this._events[event].push(fct);
      return this;
    };

    MicroEvent.prototype.removeListener = function(event, fct) {
      var i, listeners, _base;
      this._events || (this._events = {});
      listeners = ((_base = this._events)[event] || (_base[event] = []));
      i = 0;
      while (i < listeners.length) {
        if (listeners[i] === fct) listeners[i] = void 0;
        i++;
      }
      nextTick(function() {
        var x;
        return listeners = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = listeners.length; _i < _len; _i++) {
            x = listeners[_i];
            if (x) _results.push(x);
          }
          return _results;
        })();
      });
      return this;
    };

    MicroEvent.prototype.removeListeners = function(event) {
      this._events || (this._events = {});
      if (this._events.hasOwnProperty(event)) delete this._events[event];
      return this;
    };

    MicroEvent.prototype.emit = function() {
      var args, event, fn, _i, _len, _ref, _ref2;
      event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (!((_ref = this._events) != null ? _ref[event] : void 0)) return this;
      _ref2 = this._events[event];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        fn = _ref2[_i];
        if (fn) fn.apply(this, args);
      }
      return this;
    };

    return MicroEvent;

  })();

  MicroEvent.mixin = function(obj) {
    var proto;
    proto = obj.prototype || obj;
    proto.on = proto['on'] = MicroEvent.prototype.on;
    proto.removeListener = proto['removeListener'] = MicroEvent.prototype.removeListener;
    proto.removeListeners = proto['removeListeners'] = MicroEvent.prototype.removeListeners;
    proto.emit = MicroEvent.prototype.emit;
    return obj;
  };

  if (typeof module !== "undefined" && module !== null ? module.exports : void 0) {
    module.exports = MicroEvent;
  }

}).call(this);

});

require.define("/editor/link_editor/link_popup.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var DomUtils, LinkPopup, renderLinkPopup;
  var __slice = Array.prototype.slice;

  renderLinkPopup = require('./template').renderLinkPopup;

  DomUtils = require('../../utils/dom');

  LinkPopup = (function() {
    var MAX_OFFSET;

    MAX_OFFSET = 50;

    function LinkPopup() {
      var $tmpNode, args;
      var _this = this;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      $tmpNode = $(document.createElement('span'));
      $tmpNode.append(renderLinkPopup());
      this._anchor = $tmpNode.find('.js-link-anchor')[0];
      this._changeButton = $tmpNode.find('.js-link-popup-change')[0];
      this._changeButton.addEventListener('click', function(event) {
        if (_this._changeCallback) return _this._changeCallback();
      }, false);
      this._container = $tmpNode[0].firstChild;
      this._container.addEventListener('mousedown', function(event) {
        return event.stopPropagation();
      }, false);
      this._container.addEventListener('mouseup', function(event) {
        return event.stopPropagation();
      }, false);
      this._container.addEventListener('click', function(event) {
        return event.stopPropagation();
      }, false);
    }

    LinkPopup.prototype._setText = function(text) {
      return $(this._anchor).empty().text(text);
    };

    LinkPopup.prototype._setUrl = function(url) {
      return this._anchor.href = url;
    };

    LinkPopup.prototype.getContainer = function() {
      return this._container;
    };

    LinkPopup.prototype.hide = function() {
      this._container.style.display = 'none';
      this._changeCallback = null;
      this._lastTop = null;
      return this._lastLeft = null;
    };

    LinkPopup.prototype.show = function(url, relativeTo, _changeCallback, showAtBottom) {
      var $container, $parent, containerHeight, containerWidth, left, parentHeight, parentWidth, posTop, relativeHeight, top, _ref;
      this._changeCallback = _changeCallback;
      this._setText(url);
      this._setUrl(url);
      _ref = DomUtils.getPosition(relativeTo, this._container.parentNode), top = _ref[0], left = _ref[1];
      if (!(top != null) || !(left != null)) return this.hide();
      this._container.style.display = 'block';
      relativeHeight = relativeTo.offsetHeight;
      $container = $(this._container);
      containerWidth = $container.width();
      containerHeight = $container.height();
      $parent = $(this._container.parentNode);
      parentWidth = $parent.width();
      parentHeight = $parent.height();
      posTop = top + relativeHeight + 4;
      if (left + containerWidth > parentWidth) left = parentWidth - containerWidth;
      if (!showAtBottom && (posTop + containerHeight > parentHeight)) {
        posTop = top - containerHeight - 4;
      }
      if (posTop !== this._lastTop || Math.abs(left - this._lastLeft) > MAX_OFFSET) {
        this._lastTop = posTop;
        this._lastLeft = left;
        this._container.style.top = posTop + 'px';
        return this._container.style.left = left + 'px';
      }
    };

    LinkPopup.get = function() {
      var _ref;
      return (_ref = this.instance) != null ? _ref : this.instance = new this;
    };

    return LinkPopup;

  })();

  exports.LinkPopup = LinkPopup;

}).call(this);

});

require.define("/editor/link_editor/template.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var ck, linkEditorTmpl, linkPopupTmpl;

  ck = window.CoffeeKup;

  linkEditorTmpl = function() {
    return div('.js-link-editor.link-editor.window', function() {
      div('.link-editor-name', function() {
        span('Insert link');
        return span('.close-icon.js-link-editor-close-btn', '');
      });
      return table('.link-editor-content', function() {
        tr('.link-name', function() {
          td('', 'Text');
          return td('', function() {
            label(function() {
              return input('.js-link-editor-text-input', {
                type: 'text'
              });
            });
            return div('.js-link-editor-text-div', '');
          });
        });
        tr('.link-url', function() {
          td('', 'URL');
          return td('', function() {
            return label(function() {
              return input('.js-link-editor-url-input', {
                type: 'text'
              });
            });
          });
        });
        return tr('', function() {
          td('', '');
          return td('', function() {
            button('.js-link-editor-update-btn.button', {
              title: 'Accept changes'
            }, 'Submit');
            return button('.js-link-editor-remove-btn.button', {
              title: 'Remove link'
            }, 'Remove');
          });
        });
      });
    });
  };

  linkPopupTmpl = function() {
    return div('.js-link-popup.link-popup', function() {
      a('.js-link-anchor', {
        target: '_blank'
      });
      return button('.js-link-popup-change.button', 'Change');
    });
  };

  exports.renderLinkEditor = function() {
    return ck.render(linkEditorTmpl);
  };

  exports.renderLinkPopup = function() {
    return ck.render(linkPopupTmpl);
  };

}).call(this);

});

require.define("/editor/link_editor/index.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var AnchorNodeWrapper, DomUtils, LinkEditor, renderLinkEditor;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  DomUtils = require('../../utils/dom');

  AnchorNodeWrapper = require('../selection/anchor_wrapper').AnchorNodeWrapper;

  renderLinkEditor = require('./template').renderLinkEditor;

  LinkEditor = (function() {

    function LinkEditor() {
      this._close = __bind(this._close, this);
      this._clickHandler = __bind(this._clickHandler, this);
      this._keyHandler = __bind(this._keyHandler, this);
      this._remove = __bind(this._remove, this);
      this._update = __bind(this._update, this);      $(document.body).append(renderLinkEditor());
      this._$container = $('.js-link-editor');
      this._currentRange = null;
      this._$textInput = $('.js-link-editor-text-input');
      this._$textDiv = $('.js-link-editor-text-div');
      this._hide();
      this._$urlInput = $('.js-link-editor-url-input');
      this._$textInput.bind('keydown', this._keyHandler);
      this._$urlInput.bind('keydown', this._keyHandler);
      $('.js-link-editor-update-btn').bind('click', this._update);
      $('.js-link-editor-remove-btn').bind('click', this._remove);
      $('.js-link-editor-close-btn').bind('click', this._close);
    }

    LinkEditor.get = function() {
      var _ref;
      return (_ref = this.instance) != null ? _ref : this.instance = new this;
    };

    LinkEditor.prototype._normalizeLink = function(link) {
      if (!/^[a-zA-Z0-9\-]+:/.test(link)) return 'http://' + link;
      return link;
    };

    LinkEditor.prototype._hide = function() {
      this._$container.offset({
        left: -1000,
        top: -1000
      });
      this._$textInput.hide();
      return this._$textDiv.hide();
    };

    LinkEditor.prototype._clear = function() {
      this._$textInput.val('');
      this._$urlInput.val('');
      if (this._currentRange) this._currentRange.detach();
      return this._currentRange = null;
    };

    LinkEditor.prototype._update = function() {
      /*
              Обработчик нажатия кнопки Update
      */
      var url;
      url = this._$urlInput.val();
      if (!url) return this._remove();
      url = this._normalizeLink(url);
      DomUtils.setRange(this._currentRange);
      this._editor.markLink(url);
      return this._close();
    };

    LinkEditor.prototype._remove = function() {
      /*
              Обработчик нажатия кнопки Remove
      */      DomUtils.setRange(this._currentRange);
      this._editor.markLink(null);
      return this._close();
    };

    LinkEditor.prototype._keyHandler = function(event) {
      /*
              Обработчик клавиатурных событий keypress, keydown
              @param node: Event | KeyEvent
      */      if (event.keyCode === 13) {
        this._update();
        return event.preventDefault();
      }
      if (event.keyCode === 27) {
        this._close();
        return event.preventDefault();
      }
    };

    LinkEditor.prototype._clickHandler = function(event) {
      if (!$.contains(this._$container[0], event.target)) return this._close();
    };

    LinkEditor.prototype._close = function() {
      this._hide();
      return window.removeEventListener('mousedown', this._clickHandler, true);
    };

    LinkEditor.prototype._isLinkNode = function(node) {
      var _ref;
      return DomUtils.isAnchorNode(node) && ((_ref = node.parentNode) != null ? _ref.parentNode : void 0) === this._editor.getContainer();
    };

    LinkEditor.prototype._getLinkNode = function(node) {
      while (node !== this._editor.getContainer()) {
        if (this._isLinkNode(node)) return node;
        node = node.parentNode;
      }
      return null;
    };

    LinkEditor.prototype._expandRangeStartToAnchor = function(range) {
      var node, _results;
      node = this._getLinkNode(range.startContainer);
      _results = [];
      while (node) {
        if (!this._isLinkNode(node)) return;
        range.setStart(DomUtils.getDeepestFirstChild(node), 0);
        _results.push(node = node.previousSibling);
      }
      return _results;
    };

    LinkEditor.prototype._expandRangeEndToAnchor = function(range) {
      var node, textNode, _results;
      node = this._getLinkNode(range.endContainer);
      _results = [];
      while (node) {
        if (!this._isLinkNode(node)) return;
        textNode = DomUtils.getDeepestLastChild(node);
        range.setEnd(textNode, textNode.data.length);
        _results.push(node = node.nextSibling);
      }
      return _results;
    };

    LinkEditor.prototype._expandRange = function(range) {
      if (!range) return null;
      range = range.cloneRange();
      this._expandRangeStartToAnchor(range);
      this._expandRangeEndToAnchor(range);
      return range;
    };

    LinkEditor.prototype._getFirstAnchor = function() {
      var anchor, editorAnchors, endPoints, range, startPoints, textEnd, textStart, _i, _len;
      editorAnchors = $(this._editor.getContainer()).find('a');
      for (_i = 0, _len = editorAnchors.length; _i < _len; _i++) {
        anchor = editorAnchors[_i];
        if (!this._isLinkNode(anchor)) continue;
        range = document.createRange();
        textStart = DomUtils.getDeepestFirstChild(anchor);
        textEnd = DomUtils.getDeepestLastChild(anchor);
        range.selectNode(anchor);
        if (textStart && DomUtils.isTextNode(textStart)) {
          range.setStart(textStart, 0);
        }
        if (textEnd && DomUtils.isTextNode(textEnd)) {
          range.setEnd(textEnd, textEnd.data.length);
        }
        startPoints = this._currentRange.compareBoundaryPoints(Range.START_TO_START, range);
        endPoints = this._currentRange.compareBoundaryPoints(Range.END_TO_END, range);
        if ((!startPoints && !endPoints) || ((startPoints || endPoints) && (startPoints * endPoints <= 0))) {
          return anchor;
        }
      }
      return null;
    };

    LinkEditor.prototype._getUrlFromSelection = function() {
      var anchor;
      anchor = this._getFirstAnchor();
      if (!anchor) return '';
      return anchor.href;
    };

    LinkEditor.prototype._setText = function(text) {
      this._$textInput.val(text);
      return this._$textDiv.text(text);
    };

    LinkEditor.prototype._setUrl = function(url) {
      return this._$urlInput.val(url);
    };

    LinkEditor.prototype.open = function(_editor) {
      var currentText, range;
      this._editor = _editor;
      /*
              Показывает окно редактирования url
              @param editor: Editor, объект, в котором редактируется ссылка
              @param range: DOM range, выделенный фрагмент
      */
      this._clear();
      range = this._expandRange(this._editor.getRange());
      if (!range) return;
      if (range.collapsed) return;
      this._currentRange = range.cloneRange();
      this._$container.center();
      currentText = this._currentRange.toString();
      this._setText(currentText);
      if (currentText === '') {
        this._$textInput.show();
      } else {
        this._$textDiv.show();
      }
      this._setUrl(this._getUrlFromSelection());
      window.addEventListener('mousedown', this._clickHandler, false);
      return this._$urlInput.select();
    };

    return LinkEditor;

  })();

  exports.LinkEditor = LinkEditor;

}).call(this);

});

require.define("/editor/selection/anchor_wrapper.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var AnchorNodeWrapper, DomUtils, InlineNodeWrapper;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  DomUtils = require('../../utils/dom');

  InlineNodeWrapper = require('./inline_node_wrapper').InlineNodeWrapper;

  AnchorNodeWrapper = (function() {

    __extends(AnchorNodeWrapper, InlineNodeWrapper);

    function AnchorNodeWrapper() {
      AnchorNodeWrapper.__super__.constructor.apply(this, arguments);
    }

    AnchorNodeWrapper.prototype._createAnchorNode = function(attrs) {
      var attr, key, link;
      link = document.createElement(DomUtils.ANCHOR_TAG);
      for (key in attrs) {
        attr = attrs[key];
        link[key] = attr;
      }
      console.log(link);
      return link;
    };

    AnchorNodeWrapper.prototype.wrapLeaf = function(node, attrs) {
      var link, nextSibling, parentNode;
      if (!(node || node.parentNode)) return;
      console.log('wrapLeaf');
      console.log(node, node.parentNode);
      parentNode = node.parentNode;
      nextSibling = node.nextSibling;
      console.log('nextSibling', nextSibling);
      link = this._createAnchorNode(attrs);
      parentNode.removeChild(node);
      link.appendChild(node);
      return parentNode.insertBefore(link, nextSibling);
    };

    AnchorNodeWrapper.prototype.wrapLeafFromTo = function(node, attrs, from, to) {
      var link, nextSibling, parentNode, part1, part2, part3, text, textNode;
      if (!(node || node.parentNode)) return;
      console.log('wrapLeafFromTo');
      text = node.textContent;
      if (from < 0) from = 0;
      if (to < 0) to = text.length;
      if (from === 0 && to >= text.length) return this.wrapLeaf(node, attrs);
      part1 = text.substring(0, from);
      part2 = text.substring(from, to);
      part3 = text.substring(to, text.length);
      parentNode = node.parentNode;
      nextSibling = node.nextSibling;
      parentNode.removeChild(node);
      if (part1.length > 0) {
        textNode = document.createTextNode(part1);
        parentNode.insertBefore(textNode, nextSibling);
      }
      if (part2.length > 0) {
        link = this._createAnchorNode(attrs);
        textNode = document.createTextNode(part2);
        link.appendChild(textNode);
        parentNode.insertBefore(link, nextSibling);
      }
      if (part3.length > 0) {
        textNode = document.createTextNode(part3);
        return parentNode.insertBefore(textNode, nextSibling);
      }
    };

    AnchorNodeWrapper.prototype.wrap = function(range, url) {
      return AnchorNodeWrapper.__super__.wrap.call(this, range, {
        href: url,
        target: '_blank'
      });
    };

    return AnchorNodeWrapper;

  })();

  exports.AnchorNodeWrapper = AnchorNodeWrapper;

}).call(this);

});

require.define("/editor/selection/inline_node_wrapper.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var InlineNodeWrapper;

  InlineNodeWrapper = (function() {

    function InlineNodeWrapper() {}

    InlineNodeWrapper.prototype.getNextLeaf = function(node) {
      var leaf;
      while (!node.nextSibling) {
        node = node.parentNode;
        if (!node) return node;
      }
      leaf = node.nextSibling;
      while (leaf.firstChild) {
        leaf = leaf.firstChild;
      }
      return leaf;
    };

    InlineNodeWrapper.prototype.getPreviousLeaf = function(node) {
      var leaf;
      while (!node.previousSibling) {
        node = node.parentNode;
        if (!node) return node;
      }
      leaf = node.previousSibling;
      while (leaf.lastChild) {
        leaf = leaf.lastChild;
      }
      return leaf;
    };

    InlineNodeWrapper.prototype.wrapNode = function(node, attrs) {
      var childNode, nextSibling, _results;
      childNode = node.firstChild;
      if (!childNode) return this.wrapLeaf(node, attrs);
      _results = [];
      while (childNode) {
        nextSibling = childNode.nextSibling;
        this.wrapNode(childNode, attrs);
        _results.push(childNode = nextSibling);
      }
      return _results;
    };

    InlineNodeWrapper.prototype.wrapLeaf = function(node, attrs) {
      throw new Error('Not Implemented');
    };

    InlineNodeWrapper.prototype.wrapLeafFromTo = function(node, attrs, from, to) {
      throw new Error('Not Implemented');
    };

    InlineNodeWrapper.prototype.wrapNodeFromTo = function(node, attrs, from, to) {
      var childNode, i, _results;
      childNode = node.firstChild;
      if (!childNode) return this.wrapLeafFromTo(node, attrs, from, to);
      _results = [];
      for (i = from; from <= to ? i < to : i > to; from <= to ? i++ : i--) {
        _results.push(this.wrapNode(node.childNodes[i], attrs));
      }
      return _results;
    };

    InlineNodeWrapper.prototype.wrap = function(range, attrs) {
      var endContainer, endLeaf, endOffset, nextLeaf, startContainer, startLeaf, startOffset, _results;
      startContainer = range.startContainer;
      startOffset = range.startOffset;
      endContainer = range.endContainer;
      endOffset = range.endOffset;
      console.log(startContainer, startOffset);
      console.log(endContainer, endOffset);
      if (startContainer === endContainer) {
        console.log('startContainer is endContainer');
        return this.wrapNodeFromTo(startContainer, attrs, startOffset, endOffset);
      } else {
        if (startContainer.firstChild) {
          console.log('startContainer.firstChild');
          startLeaf = startContainer.childNodes[startOffset];
        } else {
          console.log('not startContainer.firstChild');
          startLeaf = this.getNextLeaf(startContainer);
          this.wrapLeafFromTo(startContainer, attrs, startOffset, -1);
        }
        if (endContainer.firstChild) {
          if (endOffset > 0) {
            console.log('endOffset > 0');
            endLeaf = endContainer.childNodes[endOffset - 1];
          } else {
            console.log('endOffset <= 0');
            endLeaf = this.getPreviousLeaf(endContainer);
          }
        } else {
          console.log('not endContainer.firstChild');
          endLeaf = this.getPreviousLeaf(endContainer);
          this.wrapLeafFromTo(endContainer, attrs, 0, endOffset);
        }
        console.log('leaf', startLeaf, endLeaf);
        return;
        _results = [];
        while (startLeaf) {
          console.log('while startLeaf', startLeaf);
          nextLeaf = this.getNextLeaf(startLeaf);
          this.wrapLeaf(startLeaf, attrs);
          if (startLeaf === endLeaf) break;
          _results.push(startLeaf = nextLeaf);
        }
        return _results;
      }
    };

    return InlineNodeWrapper;

  })();

  exports.InlineNodeWrapper = InlineNodeWrapper;

}).call(this);

});

require.define("/editor/attachment/editor.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var AttachmentEditor, DomUtils, KeyCodes, renderAttachmentEditor;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  renderAttachmentEditor = require('./template').renderAttachmentEditor;

  KeyCodes = require('../../utils/key_codes').KeyCodes;

  DomUtils = require('../../utils/dom');

  AttachmentEditor = (function() {

    /*
        Редактор для добавления вложений
    */

    function AttachmentEditor() {
      this._processUrlInputKeyPress = __bind(this._processUrlInputKeyPress, this);
      this._submit = __bind(this._submit, this);
      this._close = __bind(this._close, this);
      this._clickHandler = __bind(this._clickHandler, this);      this._init();
    }

    AttachmentEditor.get = function() {
      var _ref;
      return (_ref = this.instance) != null ? _ref : this.instance = new this;
    };

    AttachmentEditor.prototype._init = function() {
      var c;
      this._createDom();
      this._hide();
      c = $(this._container);
      c.find('.js-attachment-editor-submit-btn').click(this._submit);
      c.find('.js-attachment-editor-close-btn').click(this._close);
      this._$urlInput = c.find('.js-attachment-editor-url-input');
      return this._$urlInput.bind('keydown keypress', this._processUrlInputKeyPress);
    };

    AttachmentEditor.prototype._createDom = function() {
      $(document.body).append(renderAttachmentEditor());
      return this._container = $(document.body).find('.js-attachment-editor')[0];
    };

    AttachmentEditor.prototype._clickHandler = function(event) {
      if (!$.contains(this._container, event.target)) return this._close();
    };

    AttachmentEditor.prototype._close = function() {
      /*
              Закрывает окно без подтверждения ввода url
      */      DomUtils.setRange(this._currentRange);
      return this._hide();
    };

    AttachmentEditor.prototype._submit = function() {
      /*
              Закрывает окно, подтверждая ввод url
      */
      var url;
      url = this._$urlInput.val();
      DomUtils.setRange(this._currentRange);
      this._editor.insertAttachment(url);
      return this._hide();
    };

    AttachmentEditor.prototype._processUrlInputKeyPress = function(event) {
      if (event.keyCode === KeyCodes.KEY_ENTER) {
        this._submit();
        return event.preventDefault();
      }
      if (event.keyCode === KeyCodes.KEY_ESCAPE) {
        this._close();
        return event.preventDefault();
      }
    };

    AttachmentEditor.prototype._hide = function() {
      $(this._container).removeClass('shown');
      return $(window).unbind('mousedown', this._clickHandler);
    };

    AttachmentEditor.prototype.show = function(_editor) {
      this._editor = _editor;
      /*
              Показывает окно вставки вложения
              @param _editor: Editor, редактор, в который предполагается вставить вложение
      */
      this._currentRange = this._editor.getRange();
      if (!this._currentRange) return;
      $(this._container).center().addClass('shown');
      this._$urlInput.val('');
      this._$urlInput.focus();
      return $(window).bind('mousedown', this._clickHandler);
    };

    return AttachmentEditor;

  })();

  exports.AttachmentEditor = AttachmentEditor;

}).call(this);

});

require.define("/index.coffee", function (require, module, exports, __dirname, __filename) {
    (function() {
  var AttachmentEditor, DOM, Editor, FText, LineLevelParams, LinkEditor, MicroEvent, ModelField, ModelType, ParamsField, Rizzoma, SCROLL_INTO_VIEW_TIMER, TextLevelParams, UNDO_GROUP_TIMEOUT, clone, renderContainer;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, _this = this;

  renderContainer = require('./template').renderContainer;

  Editor = require('./editor/editor_v2').Editor;

  TextLevelParams = require('./editor/model').TextLevelParams;

  LineLevelParams = require('./editor/model').LineLevelParams;

  ModelField = require('./editor/model').ModelField;

  ModelType = require('./editor/model').ModelType;

  ParamsField = require('./editor/model').ParamsField;

  LinkEditor = require('./editor/link_editor').LinkEditor;

  AttachmentEditor = require('./editor/attachment/editor').AttachmentEditor;

  MicroEvent = require('./utils/microevent');

  DOM = require('./utils/dom');

  FText = sharejs.types.ftext;

  SCROLL_INTO_VIEW_TIMER = 50;

  clone = function(o) {
    return JSON.parse(JSON.stringify(o));
  };

  UNDO_GROUP_TIMEOUT = 3000;

  Rizzoma = (function() {

    function Rizzoma(_doc) {
      var _this = this;
      this._doc = _doc;
      this._addRedoOps = __bind(this._addRedoOps, this);
      this._mergeUndoOps = __bind(this._mergeUndoOps, this);
      this._addUndoOps = __bind(this._addUndoOps, this);
      this._addAndMergeUndoOps = __bind(this._addAndMergeUndoOps, this);
      this._scrollIntoCursor = __bind(this._scrollIntoCursor, this);
      this._selectAll = __bind(this._selectAll, this);
      this._applyOps = __bind(this._applyOps, this);
      this._processEditorChanges = __bind(this._processEditorChanges, this);
      this._processKeyDownEvent = __bind(this._processKeyDownEvent, this);
      this._preProcessKeyDownEvent = __bind(this._preProcessKeyDownEvent, this);
      this.updateUndoRedoState = __bind(this.updateUndoRedoState, this);
      this._undo = __bind(this._undo, this);
      this._redo = __bind(this._redo, this);
      this._manageLink = __bind(this._manageLink, this);
      this._insertAttachment = __bind(this._insertAttachment, this);
      this._makeStruckthrough = __bind(this._makeStruckthrough, this);
      this._makeUnderlined = __bind(this._makeUnderlined, this);
      this._makeItalic = __bind(this._makeItalic, this);
      this._makeBold = __bind(this._makeBold, this);
      this._makeBulletedList = __bind(this._makeBulletedList, this);
      this._clearFormatting = __bind(this._clearFormatting, this);
      this.runCheckRange = __bind(this.runCheckRange, this);
      this._checkRange = __bind(this._checkRange, this);
      this._checkChangedRange = __bind(this._checkChangedRange, this);
      this._setEditorButtonsUnpressed = __bind(this._setEditorButtonsUnpressed, this);
      this._getSnapshot = __bind(this._getSnapshot, this);
      this._editable = !!$.browser.webkit || !!$.browser.mozilla;
      this._container = $('#rizzoma')[0];
      this._createDom();
      this._undoOps = [];
      this._redoOps = [];
      this._editor = new Editor(this._doc.name, this._getSnapshot);
      this._editorNode = this._editor.getContainer();
      this._initEditingMenu();
      this._initRangeChangeEvent();
      this.on('range-change', function(range) {
        return _this._editor.updateCursor();
      });
      this._editor.on('ops', this._processEditorChanges);
      this._editor.on('error', function(err) {
        return console.log(err);
      });
      this._editor.initContent();
      $('#editor').append(this._editorNode);
      this._doc.on('remoteop', this._applyOps);
    }

    Rizzoma.prototype._createDom = function() {
      /*
              Создает DOM для отображения документа
      */
      var c;
      c = $(this._container);
      return c.empty().append(renderContainer({
        editable: this._editable
      }));
    };

    Rizzoma.prototype._getSnapshot = function() {
      return this._doc.snapshot;
    };

    Rizzoma.prototype._initEditingMenu = function() {
      /*
              Инициализирует меню редактирования волны
      */      if (!this._editable) return;
      this._initEditingMenuKeyHandlers();
      this._initEditingMenuButtons();
      return this._initEditingModifiers();
    };

    Rizzoma.prototype._initEditingMenuButtons = function() {
      /*
              Инициализирует кнопки меню
      */
      var action, button, c, filter, name, _fn, _i, _j, _len, _len2, _ref, _ref2;
      var _this = this;
      c = $(this._container);
      this._buttons = [['_manageLinkButton', '.js-manage-link', this._manageLink], ['_insertAttachmentButton', '.js-insert-attachment', this._insertAttachment], ['_makeBoldButton', '.js-make-bold', this._makeBold], ['_makeItalicButton', '.js-make-italic', this._makeItalic], ['_makeUnderlinedButton', '.js-make-underlined', this._makeUnderlined], ['_makeBulletedButton', '.js-make-bulleted-list', this._makeBulletedList], ['_makeStruckthroughButton', '.js-make-struckthrough', this._makeStruckthrough], ['_clearFormattingButton', '.js-clear-formatting', this._clearFormatting], ['_undoButton', '.js-undo', this._undo], ['_redoButton', '.js-redo', this._redo]];
      _ref = this._buttons;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        button = _ref[_i];
        name = button[0], filter = button[1], action = button[2];
        if (!this[name]) this[name] = c.find(filter)[0];
        $(this[name]).bind('mousedown', this._eventHandler(action));
      }
      this.updateUndoRedoState();
      this._editorButtons = [this._manageLinkButton, this._insertAttachmentButton, this._clearFormattingButton];
      _ref2 = this._editorButtons;
      _fn = function(button) {
        return $(button).bind('mousedown', function() {
          return _this._setPressed(button, true);
        });
      };
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        button = _ref2[_j];
        _fn(button);
      }
      return $(window).bind('mouseup', this._setEditorButtonsUnpressed);
    };

    Rizzoma.prototype._initEditingMenuKeyHandlers = function() {
      /*
              Инициализирует обработчики нажатий на клавиши в волне
      */      this._ctrlHandlers = {
        65: this._selectAll,
        66: this._makeBold,
        73: this._makeItalic,
        76: this._manageLink,
        85: this._makeUnderlined,
        89: this._redo,
        90: this._undo
      };
      this._ctrlShiftHandlers = {
        90: this._redo
      };
      return this._editorNode.addEventListener('keydown', this._preProcessKeyDownEvent, true);
    };

    Rizzoma.prototype._initEditingModifiers = function() {
      /*
              Инициализирует модификаторы вводимого текста для волны
      */
      var _this = this;
      this._availableEditingModifiers = {};
      this._availableEditingModifiers[TextLevelParams.BOLD] = this._makeBoldButton;
      this._availableEditingModifiers[TextLevelParams.ITALIC] = this._makeItalicButton;
      this._availableEditingModifiers[TextLevelParams.UNDERLINED] = this._makeUnderlinedButton;
      this._availableEditingModifiers[TextLevelParams.STRUCKTHROUGH] = this._makeStruckthroughButton;
      this._availableLineParams = {};
      this._availableLineParams[LineLevelParams.BULLETED] = this._makeBulletedButton;
      this._editingModifiers = {};
      return this.on('range-change', function(range) {
        var textParams;
        _this._editingModifiers = {};
        _this._editor.setEditingModifiers({});
        if (range) {
          textParams = _this._editor.getTextParams();
          _this._hasTextParams = _this._editor.hasTextParams(_this._availableEditingModifiers);
        } else {
          textParams = {};
          _this._hasTextParams = false;
        }
        _this._copyEditingModifiers(textParams);
        _this._updateEditingButtonsState();
        return _this._updateLineParamsButtonsState();
      });
    };

    Rizzoma.prototype._initRangeChangeEvent = function() {
      /*
              Инициализирует событие "изменение курсора"
      */
      var _this = this;
      this._lastRange = null;
      window.addEventListener('keydown', this.runCheckRange, false);
      return $(this._editorNode).bind('mousedown mouseup', function(e) {
        return window.setTimeout(function() {
          return _this._checkChangedRange(_this._getRange());
        }, 0);
      });
    };

    Rizzoma.prototype._setEditorButtonsUnpressed = function() {
      var button, _i, _len, _ref, _results;
      _ref = this._editorButtons;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        button = _ref[_i];
        _results.push(this._setPressed(button, false));
      }
      return _results;
    };

    Rizzoma.prototype._copyEditingModifiers = function(textParams) {
      /*
              Копирует в @_editingModifiers параметры текста, которые доступны в меню
              @param textParams: obect
      */
      var key, _results;
      _results = [];
      for (key in this._availableEditingModifiers) {
        if (textParams[key] != null) {
          _results.push(this._editingModifiers[key] = textParams[key]);
        } else {
          _results.push(this._editingModifiers[key] = null);
        }
      }
      return _results;
    };

    Rizzoma.prototype._checkChangedRange = function(range) {
      if (range === this._lastRange) return;
      if (range && this._lastRange && range.compareBoundaryPoints(Range.START_TO_START, this._lastRange) === 0 && range.compareBoundaryPoints(Range.END_TO_END, this._lastRange) === 0) {
        return;
      }
      this._lastRange = range;
      if (this._lastRange) this._lastRange = this._lastRange.cloneRange();
      return this.emit('range-change', this._lastRange);
    };

    Rizzoma.prototype._checkRange = function() {
      /*
              Проверяет положение курсора и генерирует событие изменения положения
              курсора при необходимости
      */      return this._checkChangedRange(this._getRange());
    };

    Rizzoma.prototype.runCheckRange = function() {
      var _this = this;
      return window.setTimeout(function() {
        return _this._checkRange();
      }, 0);
    };

    Rizzoma.prototype._eventHandler = function(func) {
      /*
              Возвращает функцию, которая остановит событие и вызовет переданную
              @param func: function
              @return: function
                  function(event)
      */      return function(event) {
        event.preventDefault();
        event.stopPropagation();
        return func();
      };
    };

    Rizzoma.prototype._switchBooleanModifier = function(name) {
      /*
              Изменяет значение boolean-параметра текста
              @param name: string
      */      if (this._editingModifiers[name]) {
        return this._editingModifiers[name] = null;
      } else {
        return this._editingModifiers[name] = true;
      }
    };

    Rizzoma.prototype._clearFormatting = function() {
      /*
              Обрабатывает нажатие на кнопку "Clear formatting"
      */      if (this._editor.hasCollapsedCursor()) {
        this._clearEditingModifiers();
        return this._editor.setEditingModifiers(this._editingModifiers);
      } else {
        return this._editor.clearSelectedTextFormatting();
      }
    };

    Rizzoma.prototype._makeBulletedList = function() {
      /*
              Обрабатывает нажатие на кнопку "Bulleted list"
      */
      var key, params, r;
      r = this._getRange();
      if (!r) return;
      params = this._editor.getLineParams();
      key = LineLevelParams.BULLETED;
      if (params[key] != null) {
        params[key] = null;
      } else {
        params[key] = 0;
      }
      this._editor.setRangeLineParam(key, params[key]);
      return this._updateLineParamsButtonsState();
    };

    Rizzoma.prototype._clearEditingModifiers = function() {
      /*
              Сбрасывает модификаторы редактирования текста
      */      this._copyEditingModifiers({});
      this._hasTextParams = false;
      return this._updateEditingButtonsState();
    };

    Rizzoma.prototype._updateEditingButtonsState = function() {
      /*
              Обновляет состояние кнопок в панели редактирования
      */
      var button, key, _ref;
      _ref = this._availableEditingModifiers;
      for (key in _ref) {
        button = _ref[key];
        this._setPressed(button, !!this._editingModifiers[key]);
      }
      return this._setEnabled(this._clearFormattingButton, this._hasTextParams);
    };

    Rizzoma.prototype._setPressed = function(button, isPressed) {
      if (!isPressed) $(button).removeClass('pressed');
      if (isPressed) return $(button).addClass('pressed');
    };

    Rizzoma.prototype._setEnabled = function(button, isEnabled) {
      if (isEnabled) {
        return $(button).removeAttr('disabled');
      } else {
        return $(button).attr('disabled', 'disabled');
      }
    };

    Rizzoma.prototype._getRange = function() {
      /*
              Возвращает текущее выделение и блип, в котором оно сделано
              @return: DOMRange | null
      */      return this._editor.getRange();
    };

    Rizzoma.prototype._processBooleanModifierClick = function(name, button) {
      /*
              Обрабатывает нажатие на кнопку boolean-свойства текста
              @param name: string, название свойства в @_editingModifiers
              @param button: HTMLElement, кнопка в интерфейсе
      */
      var range;
      range = this._getRange();
      if (!range) return;
      this._switchBooleanModifier(name);
      this._setPressed(button, !!this._editingModifiers[name]);
      if (range.collapsed) {
        return this._editor.setEditingModifiers(this._editingModifiers);
      } else {
        return this._editor.setRangeTextParam(name, this._editingModifiers[name]);
      }
    };

    Rizzoma.prototype._makeBold = function() {
      /*
              Обрабатывает нажатие на кнопку "Bold"
      */      return this._processBooleanModifierClick(TextLevelParams.BOLD, this._makeBoldButton);
    };

    Rizzoma.prototype._makeItalic = function() {
      /*
              Обрабатывает нажатие на кнопку "Italic"
      */      return this._processBooleanModifierClick(TextLevelParams.ITALIC, this._makeItalicButton);
    };

    Rizzoma.prototype._makeUnderlined = function() {
      /*
              Обрабатывает нажатие на кнопку "Underline"
      */      return this._processBooleanModifierClick(TextLevelParams.UNDERLINED, this._makeUnderlinedButton);
    };

    Rizzoma.prototype._makeStruckthrough = function() {
      /*
              Обрабатывает нажатие на кнопку "Strikethrough"
      */      return this._processBooleanModifierClick(TextLevelParams.STRUCKTHROUGH, this._makeStruckthroughButton);
    };

    Rizzoma.prototype._updateLineParamsButtonsState = function() {
      /*
              Обновляет состояние всех кнопок, отвечающих за параметры параграфов
      */
      var button, key, params, r, _ref, _results;
      r = this._getRange();
      if (r) {
        params = this._editor.getLineParams();
      } else {
        params = {};
      }
      _ref = this._availableLineParams;
      _results = [];
      for (key in _ref) {
        button = _ref[key];
        _results.push(this._setPressed(button, params[key] != null));
      }
      return _results;
    };

    Rizzoma.prototype._insertAttachment = function() {
      /*
              Обрабатывает нажатие на кнопку вставки вложения
      */      if (!this._getRange()) return;
      return AttachmentEditor.get().show(this._editor);
    };

    Rizzoma.prototype._manageLink = function() {
      /*
              Обрабатывает нажатие на кнопку редактирования ссылки
      */      return LinkEditor.get().open(this._editor);
    };

    Rizzoma.prototype._redo = function() {
      /*
              Повторяет последнее отмененное пользователем действие
      */      this.redo();
      return this.updateUndoRedoState();
    };

    Rizzoma.prototype._undo = function() {
      /*
              Отменяет последнее сделанное пользователем действие
      */      this.undo();
      return this.updateUndoRedoState();
    };

    Rizzoma.prototype._updateButtonState = function(button, state) {
      if (!button) return;
      if (state) {
        if (button.disabled) {
          button.disabled = false;
          return button.removeAttribute('disabled');
        }
      } else {
        if (!button.disabled) {
          button.disabled = true;
          return button.setAttribute('disabled', 'disabled');
        }
      }
    };

    Rizzoma.prototype.updateUndoRedoState = function() {
      /*
              Обновляет состояния кнопок undo и redo
      */      this._updateButtonState(this._undoButton, this.hasUndoOps());
      return this._updateButtonState(this._redoButton, this.hasRedoOps());
    };

    Rizzoma.prototype._preProcessKeyDownEvent = function(e) {
      var handlers;
      handlers = e.shiftKey ? this._ctrlShiftHandlers : this._ctrlHandlers;
      return this._processKeyDownEvent(handlers, e);
    };

    Rizzoma.prototype._processKeyDownEvent = function(handlers, e) {
      /*
              Обрабатывает нажатия клавиш внутри блипов
              @param e: DOM event
      */      if ((!e.ctrlKey) || e.altKey) return;
      if (!(e.keyCode in handlers)) return;
      handlers[e.keyCode]();
      e.preventDefault();
      return e.stopPropagation();
    };

    Rizzoma.prototype._processEditorChanges = function(ops) {
      this._submitOps(ops);
      this.scrollIntoView();
      this._redoOps = [];
      this._addAndMergeUndoOps(this._doc.name, ops);
      return this.updateUndoRedoState();
    };

    Rizzoma.prototype._applyOps = function(ops) {
      this._editor.applyOps(ops);
      return this._transformUndoRedoOps(this._doc.name, ops);
    };

    Rizzoma.prototype._submitOps = function(ops) {
      return this._doc.submitOp(ops);
    };

    Rizzoma.prototype._selectAll = function() {
      return this._editor.selectAll();
    };

    Rizzoma.prototype._scrollIntoCursor = function() {
      var container, elementBottom, elementTop, range, waveViewBottom, waveViewTop;
      this._scrollTimer = null;
      range = DOM.getRange();
      if (!range) return;
      if (!range.collapsed) return;
      container = range.startContainer;
      if (DOM.isTextNode(container)) container = container.parentNode;
      waveViewTop = this._container.getBoundingClientRect().top;
      waveViewBottom = waveViewTop + this._container.offsetHeight;
      elementTop = container.getBoundingClientRect().top;
      elementBottom = elementTop + container.offsetHeight;
      if (waveViewTop > elementTop) return container.scrollIntoView();
      if (waveViewBottom < elementBottom) return container.scrollIntoView(false);
    };

    Rizzoma.prototype.scrollIntoView = function() {
      /*
              Скролирует элемент с текущим курсором в видимую область
      */      if (this._scrollTimer != null) clearTimeout(this._scrollTimer);
      return this._scrollTimer = setTimeout(this._scrollIntoCursor, SCROLL_INTO_VIEW_TIMER);
    };

    Rizzoma.prototype._isTextOp = function(op) {
      return op[ModelField.PARAMS][ParamsField.TYPE] === ModelType.TEXT;
    };

    Rizzoma.prototype._getOpType = function(op) {
      if ((op.ti != null) && this._isTextOp(op)) return 'text insert';
      if ((op.td != null) && this._isTextOp(op)) return 'text delete';
      return 'other';
    };

    Rizzoma.prototype._getOpsType = function(ops) {
      /*
              Возвращает 'text insert', если все указанные операции являются операциями
              вставки текста.
              Возвращает 'text delete', если все указанные операции являются операциями
              вставки текста.
              Возвращает 'other' иначе
      */
      var firstOpType, op, opType, _i, _len, _ref;
      if (!ops.length) return 'other';
      firstOpType = this._getOpType(ops[0]);
      if (firstOpType === 'other') return 'other';
      _ref = ops.slice(1);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        op = _ref[_i];
        opType = this._getOpType(op);
        if (opType === 'other') return 'other';
        if (opType !== firstOpType) return 'other';
      }
      return firstOpType;
    };

    Rizzoma.prototype._shouldMergeOps = function(id, ops) {
      /*
              Возвращает true, если указанные операции стоит объединить с последними
              сделанными для отмены
              @param id: string
              @param ops: [ShareJS operations]
              @return: boolean
      */
      var curTime, delta, lastOp, lastOps, type;
      if (this._undoOps.length === 0) return false;
      if (this._undoOps[this._undoOps.length - 1].id !== id) return false;
      curTime = (new Date()).getTime();
      if (curTime > this._lastUndoGroupStartTime + UNDO_GROUP_TIMEOUT) {
        return false;
      }
      type = this._getOpsType(ops);
      if (type !== 'text insert' && type !== 'text delete') return false;
      if (type !== this._lastUndoGroupType) return false;
      lastOps = this._undoOps[this._undoOps.length - 1].ops;
      lastOp = lastOps[0];
      if (type === 'text insert') {
        delta = lastOp.td.length;
      } else {
        delta = -lastOp.ti.length;
      }
      if (ops[0].p !== lastOp.p + delta) return false;
      return true;
    };

    Rizzoma.prototype._addAndMergeUndoOps = function(id, ops) {
      if (this._shouldMergeOps(id, ops)) {
        return this._mergeUndoOps(ops);
      } else {
        this._addUndoOps(id, ops);
        this._lastUndoGroupType = this._getOpsType(ops);
        return this._lastUndoGroupStartTime = (new Date()).getTime();
      }
    };

    Rizzoma.prototype._addUndoOps = function(id, ops) {
      /*
              Добавляет новую группу undo-операций
              @param id: string
              @param ops: [ShareJS operations]
      */      return this._undoOps.push({
        id: id,
        ops: FText.invert(ops)
      });
    };

    Rizzoma.prototype._mergeUndoOps = function(ops) {
      /*
              Сливает указанные операции с последней группой undo-операций
              @param id: string
              @param ops: [ShareJS operations]
      */
      var lastOps, _ref;
      lastOps = this._undoOps[this._undoOps.length - 1].ops;
      return ([].splice.apply(lastOps, [0, 0].concat(_ref = FText.invert(ops))), _ref);
    };

    Rizzoma.prototype._transformUndoRedoOps = function(id, ops) {
      this._transformOps(id, ops, this._undoOps);
      return this._transformOps(id, ops, this._redoOps);
    };

    Rizzoma.prototype._transformOps = function(id, ops, blocks) {
      var block, blockOps, _i, _len;
      ops = clone(ops);
      blocks.reverse();
      for (_i = 0, _len = blocks.length; _i < _len; _i++) {
        block = blocks[_i];
        if (id !== block.id) continue;
        blockOps = block.ops;
        block.ops = FText.transform(blockOps, ops, 'right');
        ops = FText.transform(ops, blockOps, 'left');
      }
      return blocks.reverse();
    };

    Rizzoma.prototype._addRedoOps = function(id, ops) {
      return this._redoOps.push({
        id: id,
        ops: FText.invert(ops)
      });
    };

    Rizzoma.prototype._applyUndoRedo = function(ops, invertAction) {
      /*
              Применяет операцию undo или redo, содержит общую логику по ожиданию
              загрузки блипов
      */
      var id, o;
      o = ops.pop();
      if (!o) return;
      if (!o.ops.length) return this._applyUndoRedo(ops, invertAction);
      id = o.id;
      this._editor.applyOps(o.ops, true);
      this.scrollIntoView();
      this._submitOps(o.ops);
      return invertAction(id, o.ops);
    };

    Rizzoma.prototype.undo = function() {
      /*
              Отменяет последнюю совершенную пользователем операцию, которую
              еще можно отменить
      */      this._applyUndoRedo(this._undoOps, this._addRedoOps);
      return this._lastUndoGroupStartTime = 0;
    };

    Rizzoma.prototype.redo = function() {
      /*
              Повторяет последнюю отмененную операцию, если после нее не было простого
              ввода текста.
      */      return this._applyUndoRedo(this._redoOps, this._addUndoOps);
    };

    Rizzoma.prototype.hasUndoOps = function() {
      /*
              Возвращает true, если есть undo-операции
      */      return this._undoOps.length > 0;
    };

    Rizzoma.prototype.hasRedoOps = function() {
      /*
              Возвращает true, если есть redo-операции
      */      return this._redoOps.length > 0;
    };

    return Rizzoma;

  })();

  Rizzoma = MicroEvent.mixin(Rizzoma);

  sharejs.open('hello', 'ftext', function(error, doc) {
    var rizzoma;
    return rizzoma = new Rizzoma(doc);
  });

}).call(this);

});
require("/index.coffee");
