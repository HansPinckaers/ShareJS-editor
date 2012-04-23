(function() {
  var BCSocket, Connection, Doc, FormattedText, MicroEvent, append, bootstrapTransform, check, checkValidComponent, checkValidOp, clone, exports, formattedText, invertComponent, nextTick, strInject, text, transformComponent, transformPosition, types,
    __slice = Array.prototype.slice,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = Object.prototype.hasOwnProperty,
    __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  window.sharejs = exports = {
    'version': '0.5.0-pre'
  };

  if (typeof WEB === 'undefined') window.WEB = true;

  nextTick = typeof WEB !== "undefined" && WEB !== null ? function(fn) {
    return setTimeout(fn, 0);
  } : process['nextTick'];

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
      var i, listeners, _base,
        _this = this;
      this._events || (this._events = {});
      listeners = ((_base = this._events)[event] || (_base[event] = []));
      i = 0;
      while (i < listeners.length) {
        if (listeners[i] === fct) listeners[i] = void 0;
        i++;
      }
      nextTick(function() {
        var x;
        return _this._events[event] = (function() {
          var _i, _len, _ref, _results;
          _ref = this._events[event];
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            x = _ref[_i];
            if (x) _results.push(x);
          }
          return _results;
        }).call(_this);
      });
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
    proto.on = MicroEvent.prototype.on;
    proto.removeListener = MicroEvent.prototype.removeListener;
    proto.emit = MicroEvent.prototype.emit;
    return obj;
  };

  if (typeof WEB === "undefined" || WEB === null) module.exports = MicroEvent;

  exports['_bt'] = bootstrapTransform = function(type, transformComponent, checkValidOp, append) {
    var transformComponentX, transformX;
    transformComponentX = function(left, right, destLeft, destRight) {
      transformComponent(destLeft, left, right, 'left');
      return transformComponent(destRight, right, left, 'right');
    };
    type.transformX = type['transformX'] = transformX = function(leftOp, rightOp) {
      var k, l, l_, newLeftOp, newRightOp, nextC, r, r_, rightComponent, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2;
      checkValidOp(leftOp);
      checkValidOp(rightOp);
      newRightOp = [];
      for (_i = 0, _len = rightOp.length; _i < _len; _i++) {
        rightComponent = rightOp[_i];
        newLeftOp = [];
        k = 0;
        while (k < leftOp.length) {
          nextC = [];
          transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
          k++;
          if (nextC.length === 1) {
            rightComponent = nextC[0];
          } else if (nextC.length === 0) {
            _ref = leftOp.slice(k);
            for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
              l = _ref[_j];
              append(newLeftOp, l);
            }
            rightComponent = null;
            break;
          } else {
            _ref2 = transformX(leftOp.slice(k), nextC), l_ = _ref2[0], r_ = _ref2[1];
            for (_k = 0, _len3 = l_.length; _k < _len3; _k++) {
              l = l_[_k];
              append(newLeftOp, l);
            }
            for (_l = 0, _len4 = r_.length; _l < _len4; _l++) {
              r = r_[_l];
              append(newRightOp, r);
            }
            rightComponent = null;
            break;
          }
        }
        if (rightComponent != null) append(newRightOp, rightComponent);
        leftOp = newLeftOp;
      }
      return [leftOp, newRightOp];
    };
    return type.transform = type['transform'] = function(op, otherOp, type) {
      var left, right, _, _ref, _ref2;
      if (!(type === 'left' || type === 'right')) {
        throw new Error("type must be 'left' or 'right'");
      }
      if (otherOp.length === 0) return op;
      if (op.length === 1 && otherOp.length === 1) {
        return transformComponent([], op[0], otherOp[0], type);
      }
      if (type === 'left') {
        _ref = transformX(op, otherOp), left = _ref[0], _ = _ref[1];
        return left;
      } else {
        _ref2 = transformX(otherOp, op), _ = _ref2[0], right = _ref2[1];
        return right;
      }
    };
  };

  if (typeof WEB === 'undefined') exports.bootstrapTransform = bootstrapTransform;

  text = {};

  text.name = 'text';

  text.create = function() {
    return '';
  };

  strInject = function(s1, pos, s2) {
    return s1.slice(0, pos) + s2 + s1.slice(pos);
  };

  checkValidComponent = function(c) {
    var d_type, i_type;
    if (typeof c.p !== 'number') {
      throw new Error('component missing position field');
    }
    i_type = typeof c.i;
    d_type = typeof c.d;
    if (!((i_type === 'string') ^ (d_type === 'string'))) {
      throw new Error('component needs an i or d field');
    }
    if (!(c.p >= 0)) throw new Error('position cannot be negative');
  };

  checkValidOp = function(op) {
    var c, _i, _len;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      checkValidComponent(c);
    }
    return true;
  };

  text.apply = function(snapshot, op) {
    var component, deleted, _i, _len;
    checkValidOp(op);
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      component = op[_i];
      if (component.i != null) {
        snapshot = strInject(snapshot, component.p, component.i);
      } else {
        deleted = snapshot.slice(component.p, (component.p + component.d.length));
        if (component.d !== deleted) {
          throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");
        }
        snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
      }
    }
    return snapshot;
  };

  text._append = append = function(newOp, c) {
    var last, _ref, _ref2;
    if (c.i === '' || c.d === '') return;
    if (newOp.length === 0) {
      return newOp.push(c);
    } else {
      last = newOp[newOp.length - 1];
      if ((last.i != null) && (c.i != null) && (last.p <= (_ref = c.p) && _ref <= (last.p + last.i.length))) {
        return newOp[newOp.length - 1] = {
          i: strInject(last.i, c.p - last.p, c.i),
          p: last.p
        };
      } else if ((last.d != null) && (c.d != null) && (c.p <= (_ref2 = last.p) && _ref2 <= (c.p + c.d.length))) {
        return newOp[newOp.length - 1] = {
          d: strInject(c.d, last.p - c.p, last.d),
          p: c.p
        };
      } else {
        return newOp.push(c);
      }
    }
  };

  text.compose = function(op1, op2) {
    var c, newOp, _i, _len;
    checkValidOp(op1);
    checkValidOp(op2);
    newOp = op1.slice();
    for (_i = 0, _len = op2.length; _i < _len; _i++) {
      c = op2[_i];
      append(newOp, c);
    }
    return newOp;
  };

  text.compress = function(op) {
    return text.compose([], op);
  };

  text.normalize = function(op) {
    var c, newOp, _i, _len;
    newOp = [];
    if ((op.i != null) || (op.p != null)) op = [op];
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      if (c.p == null) c.p = 0;
      append(newOp, c);
    }
    return newOp;
  };

  transformPosition = function(pos, c, insertAfter) {
    if (c.i != null) {
      if (c.p < pos || (c.p === pos && insertAfter)) {
        return pos + c.i.length;
      } else {
        return pos;
      }
    } else {
      if (pos <= c.p) {
        return pos;
      } else if (pos <= c.p + c.d.length) {
        return c.p;
      } else {
        return pos - c.d.length;
      }
    }
  };

  text.transformCursor = function(position, op, insertAfter) {
    var c, _i, _len;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      position = transformPosition(position, c, insertAfter);
    }
    return position;
  };

  text._tc = transformComponent = function(dest, c, otherC, type) {
    var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;
    checkValidOp([c]);
    checkValidOp([otherC]);
    if (c.i != null) {
      append(dest, {
        i: c.i,
        p: transformPosition(c.p, otherC, type === 'right')
      });
    } else {
      if (otherC.i != null) {
        s = c.d;
        if (c.p < otherC.p) {
          append(dest, {
            d: s.slice(0, (otherC.p - c.p)),
            p: c.p
          });
          s = s.slice(otherC.p - c.p);
        }
        if (s !== '') {
          append(dest, {
            d: s,
            p: c.p + otherC.i.length
          });
        }
      } else {
        if (c.p >= otherC.p + otherC.d.length) {
          append(dest, {
            d: c.d,
            p: c.p - otherC.d.length
          });
        } else if (c.p + c.d.length <= otherC.p) {
          append(dest, c);
        } else {
          newC = {
            d: '',
            p: c.p
          };
          if (c.p < otherC.p) newC.d = c.d.slice(0, (otherC.p - c.p));
          if (c.p + c.d.length > otherC.p + otherC.d.length) {
            newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);
          }
          intersectStart = Math.max(c.p, otherC.p);
          intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
          cIntersect = c.d.slice(intersectStart - c.p, (intersectEnd - c.p));
          otherIntersect = otherC.d.slice(intersectStart - otherC.p, (intersectEnd - otherC.p));
          if (cIntersect !== otherIntersect) {
            throw new Error('Delete ops delete different text in the same region of the document');
          }
          if (newC.d !== '') {
            newC.p = transformPosition(newC.p, otherC);
            append(dest, newC);
          }
        }
      }
    }
    return dest;
  };

  invertComponent = function(c) {
    if (c.i != null) {
      return {
        d: c.i,
        p: c.p
      };
    } else {
      return {
        i: c.d,
        p: c.p
      };
    }
  };

  text.invert = function(op) {
    var c, _i, _len, _ref, _results;
    _ref = op.slice().reverse();
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      c = _ref[_i];
      _results.push(invertComponent(c));
    }
    return _results;
  };

  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.types || (exports.types = {});
    bootstrapTransform(text, transformComponent, checkValidOp, append);
    exports.types.text = text;
  } else {
    module.exports = text;
    require('./helpers').bootstrapTransform(text, transformComponent, checkValidOp, append);
  }

  if (typeof WEB === 'undefined') text = require('./text');

  text.api = {
    provides: {
      text: true
    },
    getLength: function() {
      return this.snapshot.length;
    },
    getText: function() {
      return this.snapshot;
    },
    insert: function(pos, text, callback) {
      var op;
      op = [
        {
          p: pos,
          i: text
        }
      ];
      this.submitOp(op, callback);
      return op;
    },
    del: function(pos, length, callback) {
      var op;
      op = [
        {
          p: pos,
          d: this.snapshot.slice(pos, (pos + length))
        }
      ];
      this.submitOp(op, callback);
      return op;
    },
    _register: function() {
      return this.on('remoteop', function(op) {
        var component, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = op.length; _i < _len; _i++) {
          component = op[_i];
          if (component.i !== void 0) {
            _results.push(this.emit('insert', component.p, component.i));
          } else {
            _results.push(this.emit('delete', component.p, component.d));
          }
        }
        return _results;
      });
    }
  };

  /*
  Operations on rich text.
  
  Document is of the next form:
  [
      {
          t: "Bold fragment"
          params:
              bold: true
              font-size: 14
      }
      {
          t: "Italic fragment"
          params: {italic: true}
      }
  ]
  
  T is a text field, common text operation are applied on this field.
  Params is a set of key-value pairs, only "insert" and "delete" operations are applied for them.
  All positions are measured from the start of document, not a start of fragment.
  
  Available operations:
      * text insertion
          p: 9                    # Text will be inserted before this position
          ti: "bold"              # Text to insert
          params:                 # Params of the inserted text
              bold: true
              font-size: 14
      * text deletion
          p: 8                    # Text will be deleted starting with this position
          td: "Fragment"          # Text to delete (needed both to revert and check operation)
          params: {italic: true}  # Params of deleted text (needed both to revert and check operation)
      * param insertion
          p: 5                    # Param will be inserted for text starting with that position
          len: 4                  # Number of symbols that will insert param
          paramsi:                # Added param (one param per operation)
              font: 14
      * param deletion
          p: 5                    # Param will be deleted starting with this position
          len: 4                  # Number of symbols that will delete param
          paramsd:                # Removed param (one param per operation)
              bold: true
  
  Params insertion and params deletion are both params change operations.
  Transformations of text inseration and text deletion are obvious, their behavior
  is copied from text ShareJS type.
  Text insertion is not changed when transformed against params change - it does
  not insert or remove any params. Thus, simultaneous text insertion and params
  insertion can lead to a following situation:
  client1 and client2 have doc [{t: "discssion", params: {}}]
  client1 inserts u: {p: 4, t: "u"}
  client2 inserts bold param: {p: 0, len: 9, paramsi: {bold: true}}
  After transformations & application of operations they will both have:
  [
      {
          t: "disc"
          params: {bold: true}
      }
      {
          t: "u"
          params: {}
      }
      {
          t: "ssion"
          params: {bold: true}
      }
  ]
  Simple idea to transfrom text insertion against params change does not work in all
  possible cases.
  Params change when transformed against text insertion gets split into two operations
  if needed.
  Text deletion might be split in up to three operations when tranformed against params
  change. Text and positions stay unchanged, only params field gets changed.
  Params change when transformed against text deletion might change its pos and length.
  Params change isn't transformed against another params change if they operate on
  different params. If two operations do same action (set equal value or remove param)
  then one of them might be cut down, but the overall effect will remain unchanged.
  If operations set param to different values than one of the operations will be cut
  down if needed. Server cuts down already applied operation if favour of new. Client
  cuts down new operation if favour of applied one.
  
  Next variable names are fixed throughout the code:
      p, pos: position calculated from the start of document
      offset: position calculated from the start of fragment
      index: index of fragment in document
  Next notations is used for operations:
      t: text, opposed to original s - string
      params: parameters of fragment of text
      i: insertion
      d: deletion
      p: position calculated from the start of document
      len: lenght, only set for those operation in which it cannot be calculated from other fields
  */

  clone = function(o) {
    return JSON.parse(JSON.stringify(o));
  };

  FormattedText = (function() {

    function FormattedText() {
      this.transformOp = __bind(this.transformOp, this);
      this._transformParamsdAgainstParamsd = __bind(this._transformParamsdAgainstParamsd, this);
      this._transformParamsiAgainstParamsi = __bind(this._transformParamsiAgainstParamsi, this);
      this._transformParamsChangeAgainstParamsChange = __bind(this._transformParamsChangeAgainstParamsChange, this);
      this._revertParamsChange = __bind(this._revertParamsChange, this);
      this._transformParamsdAgainstParamsi = __bind(this._transformParamsdAgainstParamsi, this);
      this._transformParamsiAgainstParamsd = __bind(this._transformParamsiAgainstParamsd, this);
      this._transformParamsdAgainstTd = __bind(this._transformParamsdAgainstTd, this);
      this._transformParamsiAgainstTd = __bind(this._transformParamsiAgainstTd, this);
      this._transformTdAgainstParamsd = __bind(this._transformTdAgainstParamsd, this);
      this._transformTdAgainstParamsi = __bind(this._transformTdAgainstParamsi, this);
      this._transformParamsdAgainstTi = __bind(this._transformParamsdAgainstTi, this);
      this._transformParamsiAgainstTi = __bind(this._transformParamsiAgainstTi, this);
      this._transformTiAgainstParamsd = __bind(this._transformTiAgainstParamsd, this);
      this._transformTiAgainstParamsi = __bind(this._transformTiAgainstParamsi, this);
      this._transformParamsChangeAgainstTd = __bind(this._transformParamsChangeAgainstTd, this);
      this._transformTdAgainstParamsChange = __bind(this._transformTdAgainstParamsChange, this);
      this._transformParamsChangeAgainstTi = __bind(this._transformParamsChangeAgainstTi, this);
      this._transformTiAgainstParamsChange = __bind(this._transformTiAgainstParamsChange, this);
      this._transformTdAgainstTd = __bind(this._transformTdAgainstTd, this);
      this._transformTdAgainstTi = __bind(this._transformTdAgainstTi, this);
      this._transformTiAgainstTd = __bind(this._transformTiAgainstTd, this);
      this._transformTiAgainstTi = __bind(this._transformTiAgainstTi, this);
      this._changeParams = __bind(this._changeParams, this);
      this._applyParamsInsert = __bind(this._applyParamsInsert, this);
      this._applyParamsDelete = __bind(this._applyParamsDelete, this);
      this._applyTextDelete = __bind(this._applyTextDelete, this);
      this._applyTextInsert = __bind(this._applyTextInsert, this);
    }

    FormattedText.prototype._getBlockAndOffset = function(snapshot, p) {
      /*
              Возвращает индекс блока, содержащего символ с номером p, и смещение
              искомого символа внутри этого блока 
              @param snapshot: formatted text snapshot
              @param p: int
              @return: [int, int] - индекс блока и смещение внутри блока
      */
      var block, index, totalLen, _len;
      totalLen = 0;
      for (index = 0, _len = snapshot.length; index < _len; index++) {
        block = snapshot[index];
        if (totalLen + block.t.length > p) return [index, p - totalLen];
        totalLen += block.t.length;
      }
      if (p > totalLen) {
        throw new Error("Specified position (" + p + ") is more then text length (" + totalLen + ")");
      }
      return [snapshot.length, p - totalLen];
    };

    FormattedText.prototype._paramsAreEqual = function(first, second) {
      /*
              Возвращает true, если переданный объекты форматирования совпадают
              @param first: object
              @param second: object
              @return: boolean
      */
      var _secondHasFirst;
      _secondHasFirst = function(first, second) {
        var key;
        for (key in first) {
          if (!(second[key] != null)) return false;
          if (first[key] !== second[key]) return false;
        }
        return true;
      };
      if (!_secondHasFirst(first, second)) return false;
      if (!_secondHasFirst(second, first)) return false;
      return true;
    };

    FormattedText.prototype._splitBlock = function(block, offset) {
      /*
              Разбивает указанный блок
              @param block: Formatted text block
              @param offset: int
              @return: [Formatted text block]
      */
      var newBlock;
      if (offset === 0) return [block];
      newBlock = clone(block);
      block.t = block.t.substr(0, offset);
      newBlock.t = newBlock.t.substr(offset);
      return [block, newBlock];
    };

    FormattedText.prototype._tryMerge = function(snapshot, startIndex, endIndex) {
      /*
              Пробует слить все смежные блоки с одинаковым форматированием между
              startIndex и endIndex включительно.
              Изменяет snapshot.
              startIndex должен быть меньше endIndex.
              Позволяется указывать startIndex < 0 и endIndex > snapshot.length - 1
              @param snapshot: [Formatted text block]
              @param startIndex: int
              @param endIndex: int
      */
      var first, i, second, _ref, _ref2, _results;
      startIndex = Math.max(startIndex, 0);
      endIndex = Math.min(endIndex, snapshot.length - 1);
      i = endIndex - 1;
      _results = [];
      while (i >= startIndex) {
        first = snapshot[i];
        second = snapshot[i + 1];
        if (this._paramsAreEqual(first.params, second.params)) {
          [].splice.apply(snapshot, [(_ref = i + 1), (i + 1) - _ref + 1].concat(_ref2 = [])), _ref2;
          first.t += second.t;
        }
        _results.push(i--);
      }
      return _results;
    };

    FormattedText.prototype._applyTextInsert = function(snapshot, op) {
      var block, blockIndex, blocks, newBlock, offset, _ref, _ref2;
      _ref = this._getBlockAndOffset(snapshot, op.p), blockIndex = _ref[0], offset = _ref[1];
      if (snapshot.length === blockIndex) {
        snapshot.push({
          t: op.ti,
          params: op.params
        });
        this._tryMerge(snapshot, blockIndex - 1, blockIndex);
        return snapshot;
      }
      block = snapshot[blockIndex];
      if (this._paramsAreEqual(block.params, op.params)) {
        block.t = block.t.substr(0, offset) + op.ti + block.t.substr(offset);
      } else {
        blocks = this._splitBlock(block, offset);
        newBlock = {
          t: op.ti,
          params: op.params
        };
        [].splice.apply(blocks, [(_ref2 = blocks.length - 1), (blocks.length - 1) - _ref2].concat(newBlock)), newBlock;
        [].splice.apply(snapshot, [blockIndex, blockIndex - blockIndex + 1].concat(blocks)), blocks;
        this._tryMerge(snapshot, blockIndex - 1, blockIndex);
      }
      return snapshot;
    };

    FormattedText.prototype._applyTextDelete = function(snapshot, op) {
      var block, blockIndex, blockText, offset, _ref, _ref2;
      _ref = this._getBlockAndOffset(snapshot, op.p), blockIndex = _ref[0], offset = _ref[1];
      block = snapshot[blockIndex];
      if (!this._paramsAreEqual(block.params, op.params)) {
        throw new Error("Text block params (" + (JSON.stringify(block.params)) + ") do not equal to op params (" + (JSON.stringify(op.params)) + ")");
      }
      blockText = block.t.substr(offset, op.td.length);
      if (blockText !== op.td) {
        throw new Error("Deleted text (" + blockText + ") is not equal to text in operation (" + op.td + ")");
      }
      block.t = block.t.substr(0, offset) + block.t.substr(offset + op.td.length);
      if (!block.t) {
        [].splice.apply(snapshot, [blockIndex, blockIndex - blockIndex + 1].concat(_ref2 = [])), _ref2;
        this._tryMerge(snapshot, blockIndex - 1, blockIndex);
      }
      return snapshot;
    };

    FormattedText.prototype._getFirstParam = function(params) {
      /*
              Возвращает [key, value] для первого ключа из params
              @param params: object
              @return: [string, any]
      */
      var name, value;
      for (name in params) {
        value = params[name];
        return [name, value];
      }
    };

    FormattedText.prototype._hasOneParam = function(params) {
      /*
              Возвращает true, если у объекта ровно одно свое свойство
              @param params: object
              @return: boolean
      */
      var hasParam, prop;
      hasParam = false;
      for (prop in params) {
        if (!__hasProp.call(params, prop)) continue;
        if (hasParam) return false;
        hasParam = true;
      }
      return hasParam;
    };

    FormattedText.prototype._deleteParams = function(params, toDelete) {
      var name, value, _ref;
      _ref = this._getFirstParam(toDelete), name = _ref[0], value = _ref[1];
      if (params[name] !== value) {
        throw new Error("Params delete tried to remove param " + name + " with value " + value + " from " + (JSON.stringify(params)) + ", but it does not match");
      }
      return delete params[name];
    };

    FormattedText.prototype._applyParamsDelete = function(snapshot, op) {
      var transformBlock,
        _this = this;
      if (!this._hasOneParam(op.paramsd)) {
        throw new Error("Exactly one param should be deleted: " + (JSON.stringify(op)));
      }
      transformBlock = function(block) {
        return _this._deleteParams(block.params, op.paramsd);
      };
      return this._changeParams(snapshot, op.p, op.len, transformBlock);
    };

    FormattedText.prototype._insertParams = function(params, toInsert) {
      var name, value, _ref;
      _ref = this._getFirstParam(toInsert), name = _ref[0], value = _ref[1];
      if (params[name] != null) {
        throw new Error("Params insert tried to set param " + name + " with value " + value + " to block " + (JSON.stringify(params)) + ", but it is already set");
      }
      return params[name] = value;
    };

    FormattedText.prototype._applyParamsInsert = function(snapshot, op) {
      var transformBlock,
        _this = this;
      if (!this._hasOneParam(op.paramsi)) {
        throw new Error("Exactly one param should be inserted: " + (JSON.stringify(op)));
      }
      transformBlock = function(block) {
        return _this._insertParams(block.params, op.paramsi);
      };
      return this._changeParams(snapshot, op.p, op.len, transformBlock);
    };

    FormattedText.prototype._changeParams = function(snapshot, p, len, transformBlock) {
      /*
              Применяет операцию изменения параметров на диапазоне
              Разбивает при необходимости существующие блоки
              Ко всем блокам, попадающим в диапазон, применяет transformBlock
              Сливает блоки после изменения форматирования
              @param snapshot: any data
              @param p: int, позиция начала изменения параметров от начала документа
              @param len: int, длина диапазона изменения параметров
              @param transformBlock: function, функция, изменяющая параметры
      */
      var endBlockIndex, endOffset, i, startBlockIndex, startOffset, _ref, _ref2, _ref3, _ref4;
      _ref = this._getBlockAndOffset(snapshot, p), startBlockIndex = _ref[0], startOffset = _ref[1];
      _ref2 = this._getBlockAndOffset(snapshot, p + len), endBlockIndex = _ref2[0], endOffset = _ref2[1];
      if (endOffset === 0) {
        endBlockIndex--;
      } else {
        [].splice.apply(snapshot, [endBlockIndex, endBlockIndex - endBlockIndex + 1].concat(_ref3 = this._splitBlock(snapshot[endBlockIndex], endOffset))), _ref3;
      }
      if (startOffset > 0) {
        [].splice.apply(snapshot, [startBlockIndex, startBlockIndex - startBlockIndex + 1].concat(_ref4 = this._splitBlock(snapshot[startBlockIndex], startOffset))), _ref4;
        startBlockIndex++;
        endBlockIndex++;
      }
      for (i = startBlockIndex; startBlockIndex <= endBlockIndex ? i <= endBlockIndex : i >= endBlockIndex; startBlockIndex <= endBlockIndex ? i++ : i--) {
        transformBlock(snapshot[i]);
      }
      this._tryMerge(snapshot, startBlockIndex - 1, endBlockIndex + 1);
      return snapshot;
    };

    FormattedText.prototype._transformPosAgainstInsert = function(p, start, len, shiftIfEqual) {
      /*
              Изменяет позицию p с учетом того, что в позицию start была вставлена
              строка длины len
              @param p: int
              @param start: int
              @param len: int
              @param shiftIfEqual: boolean, сдвигать ли p при p == start
              @return: int
      */      if (start > p) return p;
      if (start === p && !shiftIfEqual) return p;
      return p + len;
    };

    FormattedText.prototype._transformPosAgainstDelete = function(p, start, len) {
      /*
              Изменяет позицию p с учетом того, что из позиции start была удалена
              строка длины len
              @param p: int
              @param start: int
              @param len: int
              @return: int
      */      if (p > start + len) return p - len;
      if (p > start) return start;
      return p;
    };

    FormattedText.prototype._transformTiAgainstTi = function(dest, op1, op2, type) {
      op1 = clone(op1);
      op1.p = this._transformPosAgainstInsert(op1.p, op2.p, op2.ti.length, type === 'right');
      dest.push(op1);
      return dest;
    };

    FormattedText.prototype._transformTiAgainstTd = function(dest, op1, op2) {
      op1 = clone(op1);
      op1.p = this._transformPosAgainstDelete(op1.p, op2.p, op2.td.length);
      dest.push(op1);
      return dest;
    };

    FormattedText.prototype._transformTdAgainstTi = function(dest, op1, op2) {
      var stringToDelete;
      stringToDelete = op1.td;
      if (op1.p < op2.p) {
        dest.push({
          p: op1.p,
          td: stringToDelete.slice(0, (op2.p - op1.p)),
          params: clone(op1.params)
        });
        stringToDelete = stringToDelete.slice(op2.p - op1.p);
      }
      if (stringToDelete) {
        dest.push({
          p: op1.p + op2.ti.length,
          td: stringToDelete,
          params: clone(op1.params)
        });
      }
      return dest;
    };

    FormattedText.prototype._transformTdAgainstTd = function(dest, op1, op2) {
      var intersectEnd, intersectStart, newOp, op1Intersect, op2Intersect;
      if (op1.p >= op2.p + op2.td.length) {
        dest.push({
          p: op1.p - op2.td.length,
          td: op1.td,
          params: clone(op1.params)
        });
      } else if (op1.p + op1.td.length <= op2.p) {
        dest.push(clone(op1));
      } else {
        if (!this._paramsAreEqual(op1.params, op2.params)) {
          throw new Error("Two text delete operations overlap but have different params: " + (JSON.stringify(op1)) + ", " + (JSON.stringify(op2)));
        }
        intersectStart = Math.max(op1.p, op2.p);
        intersectEnd = Math.min(op1.p + op1.td.length, op2.p + op2.td.length);
        op1Intersect = op1.td.slice(intersectStart - op1.p, (intersectEnd - op1.p));
        op2Intersect = op2.td.slice(intersectStart - op2.p, (intersectEnd - op2.p));
        if (op1Intersect !== op2Intersect) {
          throw new Error("Delete ops delete different text in the same region of the document: " + (JSON.stringify(op1)) + ", " + (JSON.stringify(op2)));
        }
        newOp = {
          td: '',
          p: op1.p,
          params: clone(op1.params)
        };
        if (op1.p < op2.p) newOp.td = op1.td.slice(0, (op2.p - op1.p));
        if (op1.p + op1.td.length > op2.p + op2.td.length) {
          newOp.td += op1.td.slice(op2.p + op2.td.length - op1.p);
        }
        if (newOp.td) {
          newOp.p = this._transformPosAgainstDelete(newOp.p, op2.p, op2.td.length);
          dest.push(newOp);
        }
      }
      return dest;
    };

    FormattedText.prototype._transformTiAgainstParamsChange = function(dest, op1, op2) {
      dest.push(clone(op1));
      return dest;
    };

    FormattedText.prototype._transformParamsChangeAgainstTi = function(dest, op1, op2) {
      var lenBeforeInsert, lenToChange, newOp;
      lenToChange = op1.len;
      if (op1.p < op2.p) {
        lenBeforeInsert = Math.min(lenToChange, op2.p - op1.p);
        newOp = clone(op1);
        newOp.len = lenBeforeInsert;
        dest.push(newOp);
        lenToChange -= lenBeforeInsert;
      }
      if (lenToChange) {
        newOp = clone(op1);
        newOp.p = Math.max(op2.p, op1.p) + op2.ti.length;
        newOp.len = lenToChange;
        dest.push(newOp);
      }
      return dest;
    };

    FormattedText.prototype._transformTdAgainstParamsChange = function(dest, op1, op2, transformParams) {
      /*
              Трансформирует операцию удаления текста против операции изменения
              параметров
              @param dest: array
              @param op1: text delete OT operation
              @param op2: paramsi or paramsd OT operation
              @param transformParams: function, функция, изменяющая параметры соответственно op2
                  transformParams(params, op2)
              @return: dest
      */
      var commonLen, newOp, strToDelete;
      if ((op1.p >= op2.p + op2.len) || (op1.p + op1.td.length <= op2.p)) {
        dest.push(clone(op1));
        return dest;
      }
      strToDelete = op1.td;
      if (op1.p < op2.p) {
        newOp = clone(op1);
        newOp.td = strToDelete.slice(0, (op2.p - op1.p));
        dest.push(newOp);
        strToDelete = strToDelete.slice(op2.p - op1.p);
      }
      newOp = clone(op1);
      commonLen = op2.p + op2.len - Math.max(op2.p, op1.p);
      newOp.td = strToDelete.slice(0, commonLen);
      transformParams(newOp.params, op2);
      strToDelete = strToDelete.slice(commonLen);
      dest.push(newOp);
      if (strToDelete) {
        newOp = clone(op1);
        newOp.td = strToDelete;
        dest.push(newOp);
      }
      return dest;
    };

    FormattedText.prototype._transformParamsChangeAgainstTd = function(dest, op1, op2) {
      var newOp;
      if (op1.p >= op2.p + op2.td.length) {
        newOp = clone(op1);
        newOp.p -= op2.td.length;
        dest.push(newOp);
      } else if (op1.p + op1.len <= op2.p) {
        dest.push(clone(op1));
      } else {
        newOp = clone(op1);
        newOp.len = 0;
        if (op1.p < op2.p) newOp.len = Math.min(op1.len, op2.p - op1.p);
        if (op1.p + op1.len > op2.p + op2.td.length) {
          newOp.len += (op1.p + op1.len) - (op2.p + op2.td.length);
        }
        if (newOp.len) {
          newOp.p = this._transformPosAgainstDelete(newOp.p, op2.p, op2.td.length);
          dest.push(newOp);
        }
      }
      return dest;
    };

    FormattedText.prototype._transformTiAgainstParamsi = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this._transformTiAgainstParamsChange.apply(this, args);
    };

    FormattedText.prototype._transformTiAgainstParamsd = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this._transformTiAgainstParamsChange.apply(this, args);
    };

    FormattedText.prototype._transformParamsiAgainstTi = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this._transformParamsChangeAgainstTi.apply(this, args);
    };

    FormattedText.prototype._transformParamsdAgainstTi = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this._transformParamsChangeAgainstTi.apply(this, args);
    };

    FormattedText.prototype._transformTdAgainstParamsi = function(dest, op1, op2) {
      var _this = this;
      return this._transformTdAgainstParamsChange(dest, op1, op2, function(params, op) {
        return _this._insertParams(params, op.paramsi);
      });
    };

    FormattedText.prototype._transformTdAgainstParamsd = function(dest, op1, op2) {
      var _this = this;
      return this._transformTdAgainstParamsChange(dest, op1, op2, function(params, op) {
        return _this._deleteParams(params, op.paramsd);
      });
    };

    FormattedText.prototype._transformParamsiAgainstTd = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this._transformParamsChangeAgainstTd.apply(this, args);
    };

    FormattedText.prototype._transformParamsdAgainstTd = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this._transformParamsChangeAgainstTd.apply(this, args);
    };

    FormattedText.prototype._transformParamsiAgainstParamsd = function(dest, op1, op2) {
      dest.push(clone(op1));
      return dest;
    };

    FormattedText.prototype._transformParamsdAgainstParamsi = function(dest, op1, op2) {
      dest.push(clone(op1));
      return dest;
    };

    FormattedText.prototype._revertParamsChange = function(op) {
      /*
              Возвращает операцию, обратную операции форматирования
              @param op: OT operation
              @return: OT operation
      */
      var res;
      res = {
        p: op.p,
        len: op.len
      };
      if (op.paramsi != null) res.paramsd = op.paramsi;
      if (op.paramsd != null) res.paramsi = op.paramsd;
      return res;
    };

    FormattedText.prototype._transformParamsChangeAgainstParamsChange = function(dest, op1, op2, type, firstName, firstValue, secondName, secondValue) {
      /*
              Трансформирует операцию изменения параметров относительно уже
              совершенной операции изменения параметров.
              @param dest: array
              @param op1: text delete OT operation
              @param op2: paramsi or paramsd OT operation
              @param type: 'left' or 'right'
              @param firstName: string, имя параметра, изменяемого первой операцией
              @param secondName: string, имя параметра, изменяемого второй операцией
              @return: dest
      */
      var cancelOp, commonEnd, commonStart, newOp;
      if ((op1.p >= op2.p + op2.len) || (op1.p + op1.len <= op2.p) || (firstName !== secondName)) {
        dest.push(clone(op1));
        return dest;
      }
      if (op1.p < op2.p) {
        newOp = clone(op1);
        newOp.len = op2.p - op1.p;
        dest.push(newOp);
      }
      if (type === 'left' && firstValue !== secondValue) {
        commonEnd = Math.min(op2.p + op2.len, op1.p + op1.len);
        commonStart = Math.max(op1.p, op2.p);
        cancelOp = this._revertParamsChange(op2);
        newOp = clone(op1);
        newOp.p = cancelOp.p = commonStart;
        newOp.len = cancelOp.len = commonEnd - commonStart;
        dest.push(cancelOp);
        dest.push(newOp);
      }
      if (op1.p + op1.len > op2.p + op2.len) {
        newOp = clone(op1);
        newOp.p = op2.p + op2.len;
        newOp.len = (op1.p + op1.len) - (op2.p + op2.len);
        dest.push(newOp);
      }
      return dest;
    };

    FormattedText.prototype._transformParamsiAgainstParamsi = function(dest, op1, op2, type) {
      var firstName, firstValue, secondName, secondValue, _ref, _ref2;
      _ref = this._getFirstParam(op1.paramsi), firstName = _ref[0], firstValue = _ref[1];
      _ref2 = this._getFirstParam(op2.paramsi), secondName = _ref2[0], secondValue = _ref2[1];
      return this._transformParamsChangeAgainstParamsChange(dest, op1, op2, type, firstName, firstValue, secondName, secondValue);
    };

    FormattedText.prototype._transformParamsdAgainstParamsd = function(dest, op1, op2, type) {
      var firstName, firstValue, secondName, secondValue, _ref, _ref2;
      _ref = this._getFirstParam(op1.paramsd), firstName = _ref[0], firstValue = _ref[1];
      _ref2 = this._getFirstParam(op2.paramsd), secondName = _ref2[0], secondValue = _ref2[1];
      return this._transformParamsChangeAgainstParamsChange(dest, op1, op2, type, firstName, firstValue, secondName, secondValue);
    };

    FormattedText.prototype._getOpType = function(op) {
      /*
              Возвращает текстовое представление типа операции
              @param op: OT operation
              @return: string
      */      if (op.ti != null) return "Ti";
      if (op.td != null) return "Td";
      if (op.paramsi != null) return "Paramsi";
      if (op.paramsd != null) return "Paramsd";
    };

    FormattedText.prototype._getTransformFunction = function(op1, op2) {
      var name;
      name = "_transform" + (this._getOpType(op1)) + "Against" + (this._getOpType(op2));
      return this[name];
    };

    FormattedText.prototype.name = "ftext";

    FormattedText.prototype.create = function() {
      /*
              Создает новый документ
              @return: []
      */      return [];
    };

    FormattedText.prototype.apply = function(snapshot, ops) {
      /*
              Применяет массив операций
              @param snapshot: any data
              @param ops: [OT operation]
              @return: any data, new snapshot
      */
      var op, _i, _len;
      snapshot = clone(snapshot);
      for (_i = 0, _len = ops.length; _i < _len; _i++) {
        op = ops[_i];
        snapshot = this.applyOp(snapshot, op);
      }
      return snapshot;
    };

    FormattedText.prototype.applyOp = function(snapshot, op) {
      if (op.ti != null) return this._applyTextInsert(snapshot, op);
      if (op.td != null) return this._applyTextDelete(snapshot, op);
      if (op.paramsi != null) return this._applyParamsInsert(snapshot, op);
      if (op.paramsd != null) return this._applyParamsDelete(snapshot, op);
      throw new Error("Unknown operation applied: " + (JSON.stringify(op)));
    };

    FormattedText.prototype.transformOp = function(dest, op1, op2, type) {
      /*
              Преобразует op1 при условии, что была применена op2
              @param dest: array
              @param op1: OT operation
              @param op2: OT operation
              @param type: string, 'left' или 'right'
              @return: dest
      */
      var func;
      func = this._getTransformFunction(op1, op2);
      return func(dest, op1, op2, type);
    };

    FormattedText.prototype.compose = function(ops1, ops2) {
      /*
              Объединяет несколько операций
              @param ops1: [OT operation]
              @param ops2: [OT operation]
      */
      var res, _ref;
      res = [];
      [].splice.apply(res, [0, 0].concat(ops1)), ops1;
      [].splice.apply(res, [(_ref = res.length), res.length - _ref].concat(ops2)), ops2;
      return res;
    };

    FormattedText.prototype.isFormattedTextOperation = function(op) {
      /*
              Возвращает true, если указанная операция является операцией над текстом
              с форматированием
              @param op: OT operation
              @return: boolean
      */      return (op.td != null) || (op.ti != null) || (op.paramsd != null) || (op.paramsi != null);
    };

    FormattedText.prototype._invertOp = function(op) {
      /*
              Инвертирует операцию
              @param op: OT operation
              @return: OT operation
      */
      var res;
      res = {};
      res.p = op.p;
      if (op.params != null) res.params = clone(op.params);
      if (op.td != null) res.ti = clone(op.td);
      if (op.ti != null) res.td = clone(op.ti);
      if (op.paramsd != null) res.paramsi = clone(op.paramsd);
      if (op.paramsi != null) res.paramsd = clone(op.paramsi);
      if (op.len != null) res.len = clone(op.len);
      return res;
    };

    FormattedText.prototype.invert = function(ops) {
      /*
              Инвертирует операции
              @param ops: [OT operation]
              @return: [OT operation]
      */
      var op, res;
      res = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = ops.length; _i < _len; _i++) {
          op = ops[_i];
          _results.push(this._invertOp(op));
        }
        return _results;
      }).call(this);
      res.reverse();
      return res;
    };

    return FormattedText;

  })();

  formattedText = new FormattedText();

  check = function() {};

  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.types || (exports.types = {});
    exports._bt(formattedText, formattedText.transformOp, check, function(dest, c) {
      return dest.push(c);
    });
    exports.types.ftext = formattedText;
  } else {
    require('./helpers').bootstrapTransform(formattedText, formattedText.transformOp, check, function(dest, c) {
      return dest.push(c);
    });
    module.exports = formattedText;
  }

  if (typeof WEB === "undefined" || WEB === null) types = require('../types');

  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.extendDoc = function(name, fn) {
      return Doc.prototype[name] = fn;
    };
  }

  Doc = (function() {

    function Doc(connection, name, openData) {
      this.connection = connection;
      this.name = name;
      this.shout = __bind(this.shout, this);
      this.flush = __bind(this.flush, this);
      openData || (openData = {});
      this.version = openData.v;
      this.snapshot = openData.snaphot;
      if (openData.type) this._setType(openData.type);
      this.state = 'closed';
      this.autoOpen = false;
      this._create = openData.create;
      this.inflightOp = null;
      this.inflightCallbacks = [];
      this.inflightSubmittedIds = [];
      this.pendingOp = null;
      this.pendingCallbacks = [];
      this.serverOps = {};
    }

    Doc.prototype._xf = function(client, server) {
      var client_, server_;
      if (this.type.transformX) {
        return this.type.transformX(client, server);
      } else {
        client_ = this.type.transform(client, server, 'left');
        server_ = this.type.transform(server, client, 'right');
        return [client_, server_];
      }
    };

    Doc.prototype._otApply = function(docOp, isRemote) {
      var oldSnapshot;
      oldSnapshot = this.snapshot;
      this.snapshot = this.type.apply(this.snapshot, docOp);
      this.emit('change', docOp, oldSnapshot);
      if (isRemote) return this.emit('remoteop', docOp, oldSnapshot);
    };

    Doc.prototype._connectionStateChanged = function(state, data) {
      switch (state) {
        case 'disconnected':
          this.state = 'closed';
          if (this.inflightOp) this.inflightSubmittedIds.push(this.connection.id);
          this.emit('closed');
          break;
        case 'ok':
          if (this.autoOpen) this.open();
          break;
        case 'stopped':
          if (typeof this._openCallback === "function") this._openCallback(data);
      }
      return this.emit(state, data);
    };

    Doc.prototype._setType = function(type) {
      var k, v, _ref;
      if (typeof type === 'string') type = types[type];
      if (!(type && type.compose)) {
        throw new Error('Support for types without compose() is not implemented');
      }
      this.type = type;
      if (type.api) {
        _ref = type.api;
        for (k in _ref) {
          v = _ref[k];
          this[k] = v;
        }
        return typeof this._register === "function" ? this._register() : void 0;
      } else {
        return this.provides = {};
      }
    };

    Doc.prototype._onMessage = function(msg) {
      var callback, docOp, error, oldInflightOp, op, path, response, undo, value, _i, _j, _len, _len2, _ref, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
      if (msg.open === true) {
        this.state = 'open';
        this._create = false;
        if (this.created == null) this.created = !!msg.create;
        if (msg.type) this._setType(msg.type);
        if (msg.create) {
          this.created = true;
          this.snapshot = this.type.create();
        } else {
          if (this.created !== true) this.created = false;
          if (msg.snapshot !== void 0) this.snapshot = msg.snapshot;
        }
        if (msg.v != null) this.version = msg.v;
        if (this.inflightOp) {
          response = {
            doc: this.name,
            op: this.inflightOp,
            v: this.version
          };
          if (this.inflightSubmittedIds.length) {
            response.dupIfSource = this.inflightSubmittedIds;
          }
          this.connection.send(response);
        } else {
          this.flush();
        }
        this.emit('open');
        return typeof this._openCallback === "function" ? this._openCallback(null) : void 0;
      } else if (msg.open === false) {
        if (msg.error) {
          if (typeof console !== "undefined" && console !== null) {
            console.error("Could not open document: " + msg.error);
          }
          this.emit('error', msg.error);
          if (typeof this._openCallback === "function") {
            this._openCallback(msg.error);
          }
        }
        this.state = 'closed';
        this.emit('closed');
        if (typeof this._closeCallback === "function") this._closeCallback();
        return this._closeCallback = null;
      } else if (msg.op === null && error === 'Op already submitted') {} else if ((msg.op === void 0 && msg.v !== void 0) || (msg.op && (_ref = msg.meta.source, __indexOf.call(this.inflightSubmittedIds, _ref) >= 0))) {
        oldInflightOp = this.inflightOp;
        this.inflightOp = null;
        this.inflightSubmittedIds.length = 0;
        error = msg.error;
        if (error) {
          if (this.type.invert) {
            undo = this.type.invert(oldInflightOp);
            if (this.pendingOp) {
              _ref2 = this._xf(this.pendingOp, undo), this.pendingOp = _ref2[0], undo = _ref2[1];
            }
            this._otApply(undo, true);
          } else {
            this.emit('error', "Op apply failed (" + error + ") and the op could not be reverted");
          }
          _ref3 = this.inflightCallbacks;
          for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
            callback = _ref3[_i];
            callback(error);
          }
        } else {
          if (msg.v !== this.version) {
            throw new Error('Invalid version from server');
          }
          this.serverOps[this.version] = oldInflightOp;
          this.version++;
          _ref4 = this.inflightCallbacks;
          for (_j = 0, _len2 = _ref4.length; _j < _len2; _j++) {
            callback = _ref4[_j];
            callback(null, oldInflightOp);
          }
        }
        return this.flush();
      } else if (msg.op) {
        if (msg.v < this.version) return;
        if (msg.doc !== this.name) {
          return this.emit('error', "Expected docName '" + this.name + "' but got " + msg.doc);
        }
        if (msg.v !== this.version) {
          return this.emit('error', "Expected version " + this.version + " but got " + msg.v);
        }
        op = msg.op;
        this.serverOps[this.version] = op;
        docOp = op;
        if (this.inflightOp !== null) {
          _ref5 = this._xf(this.inflightOp, docOp), this.inflightOp = _ref5[0], docOp = _ref5[1];
        }
        if (this.pendingOp !== null) {
          _ref6 = this._xf(this.pendingOp, docOp), this.pendingOp = _ref6[0], docOp = _ref6[1];
        }
        this.version++;
        return this._otApply(docOp, true);
      } else if (msg.meta) {
        _ref7 = msg.meta, path = _ref7.path, value = _ref7.value;
        switch (path != null ? path[0] : void 0) {
          case 'shout':
            return this.emit('shout', value);
          default:
            return typeof console !== "undefined" && console !== null ? console.warn('Unhandled meta op:', msg) : void 0;
        }
      } else {
        return typeof console !== "undefined" && console !== null ? console.warn('Unhandled document message:', msg) : void 0;
      }
    };

    Doc.prototype.flush = function() {
      if (!(this.connection.state === 'ok' && this.inflightOp === null && this.pendingOp !== null)) {
        return;
      }
      this.inflightOp = this.pendingOp;
      this.inflightCallbacks = this.pendingCallbacks;
      this.pendingOp = null;
      this.pendingCallbacks = [];
      return this.connection.send({
        doc: this.name,
        op: this.inflightOp,
        v: this.version
      });
    };

    Doc.prototype.submitOp = function(op, callback) {
      if (this.type.normalize != null) op = this.type.normalize(op);
      this.snapshot = this.type.apply(this.snapshot, op);
      if (this.pendingOp !== null) {
        this.pendingOp = this.type.compose(this.pendingOp, op);
      } else {
        this.pendingOp = op;
      }
      if (callback) this.pendingCallbacks.push(callback);
      this.emit('change', op);
      return setTimeout(this.flush, 0);
    };

    Doc.prototype.shout = function(msg) {
      return this.connection.send({
        doc: this.name,
        meta: {
          path: ['shout'],
          value: msg
        }
      });
    };

    Doc.prototype.open = function(callback) {
      var message,
        _this = this;
      this.autoOpen = true;
      if (this.state !== 'closed') return;
      message = {
        doc: this.name,
        open: true
      };
      if (this.snapshot === void 0) message.snapshot = null;
      if (this.type) message.type = this.type.name;
      if (this.version != null) message.v = this.version;
      if (this._create) message.create = true;
      this.connection.send(message);
      this.state = 'opening';
      return this._openCallback = function(error) {
        _this._openCallback = null;
        return typeof callback === "function" ? callback(error) : void 0;
      };
    };

    Doc.prototype.close = function(callback) {
      this.autoOpen = false;
      if (this.state === 'closed') {
        return typeof callback === "function" ? callback() : void 0;
      }
      this.connection.send({
        doc: this.name,
        open: false
      });
      this.state = 'closed';
      this.emit('closing');
      return this._closeCallback = callback;
    };

    return Doc;

  })();

  if (typeof WEB === "undefined" || WEB === null) {
    MicroEvent = require('./microevent');
  }

  MicroEvent.mixin(Doc);

  exports.Doc = Doc;

  if (typeof WEB !== "undefined" && WEB !== null) {
    if (!types) types = exports.types;
    if (!window.BCSocket) {
      throw new Error('Must load browserchannel before this library');
    }
    BCSocket = window.BCSocket;
  } else {
    types = require('../types');
    BCSocket = require('browserchannel').BCSocket;
    Doc = require('./doc').Doc;
  }

  Connection = (function() {

    function Connection(host) {
      var _this = this;
      this.docs = {};
      this.state = 'connecting';
      this.socket = new BCSocket(host, {
        reconnect: true
      });
      this.socket.onmessage = function(msg) {
        var docName;
        if (msg.auth === null) {
          _this.lastError = msg.error;
          _this.disconnect();
          return _this.emit('connect failed', msg.error);
        } else if (msg.auth) {
          _this.id = msg.auth;
          _this.setState('ok');
          return;
        }
        docName = msg.doc;
        if (docName !== void 0) {
          _this.lastReceivedDoc = docName;
        } else {
          msg.doc = docName = _this.lastReceivedDoc;
        }
        if (_this.docs[docName]) {
          return _this.docs[docName]._onMessage(msg);
        } else {
          return typeof console !== "undefined" && console !== null ? console.error('Unhandled message', msg) : void 0;
        }
      };
      this.connected = false;
      this.socket.onclose = function(reason) {
        _this.setState('disconnected', reason);
        if (reason === 'Closed' || reason === 'Stopped by server') {
          return _this.setState('stopped', _this.lastError || reason);
        }
      };
      this.socket.onerror = function(e) {
        return _this.emit('error', e);
      };
      this.socket.onopen = function() {
        _this.lastError = _this.lastReceivedDoc = _this.lastSentDoc = null;
        return _this.setState('handshaking');
      };
      this.socket.onconnecting = function() {
        return _this.setState('connecting');
      };
    }

    Connection.prototype.setState = function(state, data) {
      var doc, docName, _ref, _results;
      if (this.state === state) return;
      this.state = state;
      if (state === 'disconnected') delete this.id;
      this.emit(state, data);
      _ref = this.docs;
      _results = [];
      for (docName in _ref) {
        doc = _ref[docName];
        _results.push(doc._connectionStateChanged(state, data));
      }
      return _results;
    };

    Connection.prototype.send = function(data) {
      var docName;
      docName = data.doc;
      if (docName === this.lastSentDoc) {
        delete data.doc;
      } else {
        this.lastSentDoc = docName;
      }
      return this.socket.send(data);
    };

    Connection.prototype.disconnect = function() {
      return this.socket.close();
    };

    Connection.prototype.makeDoc = function(name, data, callback) {
      var doc,
        _this = this;
      if (this.docs[name]) throw new Error("Doc " + name + " already open");
      doc = new Doc(this, name, data);
      this.docs[name] = doc;
      return doc.open(function(error) {
        if (error) delete _this.docs[name];
        return callback(error, (!error ? doc : void 0));
      });
    };

    Connection.prototype.openExisting = function(docName, callback) {
      var doc;
      if (this.state === 'stopped') return callback('connection closed');
      if (this.docs[docName]) return callback(null, this.docs[docName]);
      return doc = this.makeDoc(docName, {}, callback);
    };

    Connection.prototype.open = function(docName, type, callback) {
      var doc;
      if (this.state === 'stopped') return callback('connection closed');
      if (typeof type === 'function') {
        callback = type;
        type = 'text';
      }
      callback || (callback = function() {});
      if (typeof type === 'string') type = types[type];
      if (!type) throw new Error("OT code for document type missing");
      if (docName == null) {
        throw new Error('Server-generated random doc names are not currently supported');
      }
      if (this.docs[docName]) {
        doc = this.docs[docName];
        if (doc.type === type) {
          callback(null, doc);
        } else {
          callback('Type mismatch', doc);
        }
        return;
      }
      return this.makeDoc(docName, {
        create: true,
        type: type.name
      }, callback);
    };

    return Connection;

  })();

  if (typeof WEB === "undefined" || WEB === null) {
    MicroEvent = require('./microevent');
  }

  MicroEvent.mixin(Connection);

  exports.Connection = Connection;

  if (typeof WEB === "undefined" || WEB === null) {
    Connection = require('./connection').Connection;
  }

  exports.open = (function() {
    var connections, getConnection, maybeClose;
    connections = {};
    getConnection = function(origin) {
      var c, del, location;
      if (typeof WEB !== "undefined" && WEB !== null) {
        location = window.location;
        if (origin == null) {
          origin = "" + location.protocol + "//" + location.host + "/channel";
        }
      }
      if (!connections[origin]) {
        c = new Connection(origin);
        del = function() {
          return delete connections[origin];
        };
        c.on('disconnecting', del);
        c.on('connect failed', del);
        connections[origin] = c;
      }
      return connections[origin];
    };
    maybeClose = function(c) {
      var doc, name, numDocs, _ref;
      numDocs = 0;
      _ref = c.docs;
      for (name in _ref) {
        doc = _ref[name];
        if (doc.state !== 'closed' || doc.autoOpen) numDocs++;
      }
      if (numDocs === 0) return c.disconnect();
    };
    return function(docName, type, origin, callback) {
      var c;
      if (typeof origin === 'function') {
        callback = origin;
        origin = null;
      }
      c = getConnection(origin);
      c.numDocs++;
      c.open(docName, type, function(error, doc) {
        if (error) {
          callback(error);
          return maybeClose(c);
        } else {
          doc.on('closed', function() {
            return maybeClose(c);
          });
          return callback(null, doc);
        }
      });
      c.on('connect failed');
      return c;
    };
  })();

  if (typeof WEB === "undefined" || WEB === null) {
    exports.Doc = require('./doc').Doc;
    exports.Connection = require('./connection').Connection;
  }

}).call(this);
