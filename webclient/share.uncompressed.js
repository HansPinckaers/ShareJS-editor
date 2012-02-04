(function() {
  var Connection, Doc, FormattedText, MicroEvent, append, bootstrapTransform, checkValidComponent, checkValidOp, clone, exports, invertComponent, io, nextTick, strInject, text, transformComponent, transformPosition, types,
    __slice = Array.prototype.slice,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

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

  text.create = text.create = function() {
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

  text['api'] = {
    'provides': {
      'text': true
    },
    'getLength': function() {
      return this.snapshot.length;
    },
    'getText': function() {
      return this.snapshot;
    },
    'insert': function(pos, text, callback) {
      var op;
      op = [
        {
          'p': pos,
          'i': text
        }
      ];
      this.submitOp(op, callback);
      return op;
    },
    'del': function(pos, length, callback) {
      var op;
      op = [
        {
          'p': pos,
          'd': this.snapshot.slice(pos, (pos + length))
        }
      ];
      this.submitOp(op, callback);
      return op;
    },
    '_register': function() {
      return this.on('remoteop', function(op) {
        var component, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = op.length; _i < _len; _i++) {
          component = op[_i];
          if (component['i'] !== void 0) {
            _results.push(this.emit('insert', component['p'], component['i']));
          } else {
            _results.push(this.emit('delete', component['p'], component['d']));
          }
        }
        return _results;
      });
    }
  };

  /*
  Текстовые операции с форматированием.
  Документ представляется в виде:
  [
      {
          t: "Фрагмент жирный"
          params:
              bold: true
              font-size: 14
      }
      {
          t: "Фрагмент наклонный"
          params: {italic: true}
      }
  ]
  
  Параметры представляется парами ключ-значение и могут только заменяться.
  
  Доступные операции:
      * вставка текста
          p: 9                    # Позиция, в которую будет вставляться текст
          t: "жирный"             # Вставляемый текст
          params:                 # Параметры вставляемого текста
              bold: true
              font-size: 14    
      * удаление текста
          p: 8                    # Позиция, с которой начинается удаляемый текст
          t: "Фрагмент"           # Удаляемый текст (нужен для инвертирования операции)
          params: {italic: true}  # Параметры удаляемого текста (нужны для инвертирования операции
      * вставка форматирования
          p: 5                    # Позиция, с которой начинается изменение форматирования
          fc: 4                   # Количество символов, для которых изменяется форматирование
          paramsi:                # Добавляемый параметр (не более одного за операцию)
              font: 14
      * удаление форматирования
          p: 5                    # Позиция, с которой начинается изменение форматирования
          fc: 4                   # Количество символов, для которых изменяется форматирование
          paramsd:                # Удаляемые параметры (не более одного за операцию)
              bold: true
  
  Трансформации вставки текста и удаления текста между собой очевидны, их
  поведение скопировано со строковых операций из ShareJS.
  Операция вставки текста при трансформации против совершенной операции изменения
  параметров не меняется, то есть она не получает новых параметров.
  Следовательно, операция изменения параметров при трансформации против
  совершенной операции вставки не меняется либо разбивается на две операции.
  Операция удаления текста при трансформации против совершенной операции
  изменения параметров изменяет свои параметры, чтобы иметь возможность быть
  примененной.
  Операция изменения параметров при трансформации против совершенной операции
  удаления изменяет свои позицию и длину.
  Наконец, взаимная трансформации двух операций изменения параметров не меняет
  ничего, если они оперируют разными параметрами. Если они выполняют одно и
  то же изменение, то одна из операций будет уменьшена либо убрана совсем. Если
  обе операции изменяют один и тот же параметр, но в разные значения, то одна из
  операций будет уменьшена (на серверной стороне решение принимается в пользу
  приходящей операции, на клиентской - в пользу уже совершенной).
  
  По всему коду приняты следующие обозначения:
      p, pos: позиция, отсчитываемая от начала документа
      offset: позиция, отсчитываемая от начала блока форматирования
      index: индекс блока с форматированием
  В операциях приняты обозначения:
      t: текст, противопоставляется оригинальному s - string 
      params: параметры, привязанные к тексту
      i: insert, вставка
      d: delete, удаление
      p: позиция, отсчитываемая от начала документа
      len: длина, указывается только для операций, в которых не может быть вычислена
  */

  clone = function(o) {
    return JSON.parse(JSON.stringify(o));
  };

  FormattedText = (function() {

    function FormattedText() {
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
      snapshot = clone(snapshot);
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
      snapshot = clone(snapshot);
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
      if (Object.keys(op.paramsd).length !== 1) {
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
      if (Object.keys(op.paramsi).length !== 1) {
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
      snapshot = clone(snapshot);
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
        op1.p -= op2.td.length;
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

    FormattedText.prototype.name = "text-formatted";

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

    FormattedText.prototype.transform = function(ops1, ops2, type) {
      /*
              Преобразует операции ops1 при условии, что были применены ops2.
              Возвращает преобразованные ops1.
              @param ops1: [object], array of OT operations
              @param ops2: [object], array of OT operations
              @param type: string, 'left' или 'right'
              @return: [object], array of OT operations
      */
      var op1, op2, res, tmpDest, _i, _j, _len, _len2;
      res = clone(ops1);
      for (_i = 0, _len = ops2.length; _i < _len; _i++) {
        op2 = ops2[_i];
        tmpDest = [];
        for (_j = 0, _len2 = res.length; _j < _len2; _j++) {
          op1 = res[_j];
          this.transformOp(tmpDest, op1, op2, type);
        }
        res = tmpDest;
      }
      return res;
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

  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.types || (exports.types = {});
    exports.types.ftext = new FormattedText();
  } else {
    module.exports = new FormattedText();
  }

  Doc = function(connection, name, version, type, snapshot) {
    var inflightCallbacks, inflightOp, k, otApply, pendingCallbacks, pendingOp, serverOps, v, xf, _ref,
      _this = this;
    this.name = name;
    this.version = version;
    this.type = type;
    this.snapshot = snapshot;
    if (this.type.compose == null) {
      throw new Error('Handling types without compose() defined is not currently implemented');
    }
    inflightOp = null;
    inflightCallbacks = [];
    pendingOp = null;
    pendingCallbacks = [];
    serverOps = {};
    xf = this.type.transformX || function(client, server) {
      var client_, server_;
      client_ = _this.type.transform(client, server, 'left');
      server_ = _this.type.transform(server, client, 'right');
      return [client_, server_];
    };
    otApply = function(docOp, isRemote) {
      var oldSnapshot;
      oldSnapshot = _this.snapshot;
      _this.snapshot = _this.type.apply(_this.snapshot, docOp);
      _this.emit('change', docOp, oldSnapshot);
      if (isRemote) return _this.emit('remoteop', docOp, oldSnapshot);
    };
    this.flush = function() {
      if (inflightOp === null && pendingOp !== null) {
        inflightOp = pendingOp;
        inflightCallbacks = pendingCallbacks;
        pendingOp = null;
        pendingCallbacks = [];
        return connection.send({
          'doc': _this.name,
          'op': inflightOp,
          'v': _this.version
        }, function(error, response) {
          var callback, oldInflightOp, undo, _i, _j, _len, _len2, _ref;
          oldInflightOp = inflightOp;
          inflightOp = null;
          if (error) {
            if (type.invert) {
              undo = _this.type.invert(oldInflightOp);
              if (pendingOp) {
                _ref = xf(pendingOp, undo), pendingOp = _ref[0], undo = _ref[1];
              }
              otApply(undo, true);
            } else {
              throw new Error("Op apply failed (" + response.error + ") and the OT type does not define an invert function.");
            }
            for (_i = 0, _len = inflightCallbacks.length; _i < _len; _i++) {
              callback = inflightCallbacks[_i];
              callback(error);
            }
          } else {
            if (response.v !== _this.version) {
              throw new Error('Invalid version from server');
            }
            serverOps[_this.version] = oldInflightOp;
            _this.version++;
            for (_j = 0, _len2 = inflightCallbacks.length; _j < _len2; _j++) {
              callback = inflightCallbacks[_j];
              callback(null, oldInflightOp);
            }
          }
          return _this.flush();
        });
      }
    };
    this._onOpReceived = function(msg) {
      var docOp, op, _ref, _ref2;
      if (msg.v < this.version) return;
      if (msg.doc !== this.name) {
        throw new Error("Expected docName '" + this.name + "' but got " + msg.doc);
      }
      if (msg.v !== this.version) {
        throw new Error("Expected version " + this.version + " but got " + msg.v);
      }
      op = msg.op;
      serverOps[this.version] = op;
      docOp = op;
      if (inflightOp !== null) {
        _ref = xf(inflightOp, docOp), inflightOp = _ref[0], docOp = _ref[1];
      }
      if (pendingOp !== null) {
        _ref2 = xf(pendingOp, docOp), pendingOp = _ref2[0], docOp = _ref2[1];
      }
      this.version++;
      return otApply(docOp, true);
    };
    this.submitOp = function(op, callback) {
      if (this.type.normalize != null) op = this.type.normalize(op);
      this.snapshot = this.type.apply(this.snapshot, op);
      if (pendingOp !== null) {
        pendingOp = this.type.compose(pendingOp, op);
      } else {
        pendingOp = op;
      }
      if (callback) pendingCallbacks.push(callback);
      this.emit('change', op);
      return setTimeout(this.flush, 0);
    };
    this.close = function(callback) {
      var _this = this;
      if (connection.socket === null) {
        return typeof callback === "function" ? callback() : void 0;
      }
      connection.send({
        'doc': this.name,
        open: false
      }, function() {
        if (typeof callback === "function") callback();
        _this.emit('closed');
      });
      return this.emit('closing');
    };
    if (this.type.api) {
      _ref = this.type.api;
      for (k in _ref) {
        v = _ref[k];
        this[k] = v;
      }
      if (typeof this._register === "function") this._register();
    } else {
      this.provides = {};
    }
    return this;
  };

  if (typeof WEB === "undefined" || WEB === null) {
    MicroEvent = require('./microevent');
  }

  MicroEvent.mixin(Doc);

  exports.Doc = Doc;

  if (typeof WEB !== "undefined" && WEB !== null) {
    types || (types = exports.types);
    if (!window.io) throw new Error('Must load socket.io before this library');
    io = window.io;
  } else {
    types = require('../types');
    io = require('socket.io-client');
    Doc = require('./doc').Doc;
  }

  Connection = (function() {

    function Connection(origin) {
      this.onMessage = __bind(this.onMessage, this);
      this.connected = __bind(this.connected, this);
      this.disconnected = __bind(this.disconnected, this);
      var _this = this;
      this.docs = {};
      this.handlers = {};
      this.state = 'connecting';
      this.socket = io.connect(origin, {
        'force new connection': true
      });
      this.socket.on('connect', this.connected);
      this.socket.on('disconnect', this.disconnected);
      this.socket.on('message', this.onMessage);
      this.socket.on('connect_failed', function(error) {
        var callback, callbacks, docName, h, t, _ref, _results;
        if (error === 'unauthorized') error = 'forbidden';
        _this.socket = null;
        _this.emit('connect failed', error);
        _ref = _this.handlers;
        _results = [];
        for (docName in _ref) {
          h = _ref[docName];
          _results.push((function() {
            var _results2;
            _results2 = [];
            for (t in h) {
              callbacks = h[t];
              _results2.push((function() {
                var _i, _len, _results3;
                _results3 = [];
                for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
                  callback = callbacks[_i];
                  _results3.push(callback(error));
                }
                return _results3;
              })());
            }
            return _results2;
          })());
        }
        return _results;
      });
    }

    Connection.prototype.disconnected = function() {
      this.emit('disconnect');
      return this.socket = null;
    };

    Connection.prototype.connected = function() {
      return this.emit('connect');
    };

    Connection.prototype.send = function(msg, callback) {
      var callbacks, docHandlers, docName, type, _base;
      if (this.socket === null) {
        throw new Error("Cannot send message " + (JSON.stringify(msg)) + " to a closed connection");
      }
      docName = msg.doc;
      if (docName === this.lastSentDoc) {
        delete msg.doc;
      } else {
        this.lastSentDoc = docName;
      }
      this.socket.json.send(msg);
      if (callback) {
        type = msg.open === true ? 'open' : msg.open === false ? 'close' : msg.create ? 'create' : msg.snapshot === null ? 'snapshot' : msg.op ? 'op response' : void 0;
        docHandlers = ((_base = this.handlers)[docName] || (_base[docName] = {}));
        callbacks = (docHandlers[type] || (docHandlers[type] = []));
        return callbacks.push(callback);
      }
    };

    Connection.prototype.onMessage = function(msg) {
      var c, callbacks, doc, docName, type, _i, _len, _ref;
      docName = msg.doc;
      if (docName !== void 0) {
        this.lastReceivedDoc = docName;
      } else {
        msg.doc = docName = this.lastReceivedDoc;
      }
      this.emit('message', msg);
      type = msg.open === true || (msg.open === false && msg.error) ? 'open' : msg.open === false ? 'close' : msg.snapshot !== void 0 ? 'snapshot' : msg.create ? 'create' : msg.op ? 'op' : msg.v !== void 0 ? 'op response' : void 0;
      callbacks = (_ref = this.handlers[docName]) != null ? _ref[type] : void 0;
      if (callbacks) {
        delete this.handlers[docName][type];
        for (_i = 0, _len = callbacks.length; _i < _len; _i++) {
          c = callbacks[_i];
          c(msg.error, msg);
        }
      }
      if (type === 'op') {
        doc = this.docs[docName];
        if (doc) return doc._onOpReceived(msg);
      }
    };

    Connection.prototype.makeDoc = function(params) {
      var doc, name, type,
        _this = this;
      name = params.doc;
      if (this.docs[name]) throw new Error("Doc " + name + " already open");
      type = params.type;
      if (typeof type === 'string') type = types[type];
      doc = new Doc(this, name, params.v, type, params.snapshot);
      doc.created = !!params.create;
      this.docs[name] = doc;
      doc.on('closing', function() {
        return delete _this.docs[name];
      });
      return doc;
    };

    Connection.prototype.openExisting = function(docName, callback) {
      var _this = this;
      if (this.socket === null) {
        callback('connection closed');
        return;
      }
      if (this.docs[docName] != null) return this.docs[docName];
      return this.send({
        'doc': docName,
        'open': true,
        'snapshot': null
      }, function(error, response) {
        if (error) {
          return callback(error);
        } else {
          return callback(null, _this.makeDoc(response));
        }
      });
    };

    Connection.prototype.open = function(docName, type, callback) {
      var doc,
        _this = this;
      if (this.socket === null) {
        callback('connection closed');
        return;
      }
      if (typeof type === 'function') {
        callback = type;
        type = 'text';
      }
      callback || (callback = function() {});
      if (typeof type === 'string') type = types[type];
      if (!type) throw new Error("OT code for document type missing");
      if ((docName != null) && (this.docs[docName] != null)) {
        doc = this.docs[docName];
        if (doc.type === type) {
          callback(null, doc);
        } else {
          callback('Type mismatch', doc);
        }
        return;
      }
      return this.send({
        'doc': docName,
        'open': true,
        'create': true,
        'snapshot': null,
        'type': type.name
      }, function(error, response) {
        if (error) {
          return callback(error);
        } else {
          if (response.snapshot === void 0) response.snapshot = type.create();
          response.type = type;
          return callback(null, _this.makeDoc(response));
        }
      });
    };

    Connection.prototype.create = function(type, callback) {
      return open(null, type, callback);
    };

    Connection.prototype.disconnect = function() {
      if (this.socket) {
        this.emit('disconnecting');
        this.socket.disconnect();
        return this.socket = null;
      }
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
    var connections, getConnection;
    connections = {};
    getConnection = function(origin) {
      var c, del, location;
      if (typeof WEB !== "undefined" && WEB !== null) {
        location = window.location;
        if (origin == null) {
          origin = "" + location.protocol + "//" + location.hostname + "/sjs";
        }
      }
      if (!connections[origin]) {
        c = new Connection(origin);
        c.numDocs = 0;
        del = function() {
          return delete connections[origin];
        };
        c.on('disconnecting', del);
        c.on('connect failed', del);
        connections[origin] = c;
      }
      return connections[origin];
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
          c.numDocs--;
          if (c.numDocs === 0) c.disconnect();
          return callback(error);
        } else {
          doc.on('closed', function() {
            c.numDocs--;
            if (c.numDocs === 0) return c.disconnect();
          });
          return callback(null, doc);
        }
      });
      return c.on('connect failed');
    };
  })();

  if (typeof WEB === "undefined" || WEB === null) {
    exports.Doc = require('./doc').Doc;
    exports.Connection = require('./connection').Connection;
  }

}).call(this);
