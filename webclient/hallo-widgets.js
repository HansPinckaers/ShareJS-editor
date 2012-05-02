(function() {

  (function(jQuery) {
    return jQuery.widget('IKS.hallobutton', {
      button: null,
      options: {
        uuid: '',
        label: null,
        icon: null,
        editable: null,
        command: null,
        queryState: true,
        cssClass: null
      },
      _create: function() {
        var id, _base;
        if ((_base = this.options).icon == null) {
          _base.icon = "icon-" + (this.options.label.toLowerCase());
        }
        id = "" + this.options.uuid + "-" + this.options.label;
        this.element.append(this._createButton(id, this.options.command));
        this.element.append(this._createLabel(id, this.options.command, this.options.label, this.options.icon));
        if (this.options.cssClass) {
          this.element.find('label').addClass(this.options.cssClass);
        }
        this.button = this.element.find('input');
        this.button.button();
        if (this.options.cssClass) this.button.addClass(this.options.cssClass);
        return this.button.data('hallo-command', this.options.command);
      },
      _init: function() {
        var editableElement, queryState,
          _this = this;
        if (!this.button) this.button = this._prepareButton();
        this.element.append(this.button);
        if (this.options.command) {
          this.button.bind('change', function(event) {
            return _this.options.editable.execute(_this.options.command);
          });
        }
        if (!this.options.queryState) return;
        editableElement = this.options.editable.element;
        queryState = function(event) {
          if (!_this.options.command) return;
          try {
            return _this.checked(document.queryCommandState(_this.options.command));
          } catch (e) {

          }
        };
        editableElement.bind('halloenabled', function() {
          return editableElement.bind('keyup paste change mouseup hallomodified', queryState);
        });
        return editableElement.bind('hallodisabled', function() {
          return editableElement.unbind('keyup paste change mouseup hallomodified', queryState);
        });
      },
      enable: function() {
        return this.button.button('enable');
      },
      disable: function() {
        return this.button.button('disable');
      },
      refresh: function() {
        return this.button.button('refresh');
      },
      checked: function(checked) {
        this.button.attr('checked', checked);
        return this.refresh();
      },
      _createButton: function(id) {
        return jQuery("<input id=\"" + id + "\" type=\"checkbox\" />");
      },
      _createLabel: function(id, command, label, icon) {
        return jQuery("<label for=\"" + id + "\" class=\"" + command + "_button\" title=\"" + label + "\"><i class=\"" + icon + "\"></i></label>");
      }
    });
  })(jQuery);

  (function(jQuery) {
    return jQuery.widget('IKS.hallodropdownbutton', {
      button: null,
      options: {
        uuid: '',
        label: null,
        icon: null,
        editable: null,
        target: '',
        cssClass: null
      },
      _create: function() {
        var _base, _ref;
        return (_ref = (_base = this.options).icon) != null ? _ref : _base.icon = "icon-" + (this.options.label.toLowerCase());
      },
      _init: function() {
        var target,
          _this = this;
        target = jQuery(this.options.target);
        target.css('position', 'absolute');
        target.addClass('dropdown-menu');
        target.hide();
        if (!this.button) this.button = this._prepareButton();
        this.button.bind('click', function() {
          if (target.hasClass('open')) {
            _this._hideTarget();
            return;
          }
          return _this._showTarget();
        });
        target.bind('click', function() {
          return _this._hideTarget();
        });
        this.options.editable.element.bind('hallodeactivated', function() {
          return _this._hideTarget();
        });
        return this.element.append(this.button);
      },
      _showTarget: function() {
        var target;
        target = jQuery(this.options.target);
        this._updateTargetPosition();
        target.addClass('open');
        return target.show();
      },
      _hideTarget: function() {
        var target;
        target = jQuery(this.options.target);
        target.removeClass('open');
        return target.hide();
      },
      _updateTargetPosition: function() {
        var bottom, left, target, _ref;
        target = jQuery(this.options.target);
        _ref = this.element.position(), bottom = _ref.bottom, left = _ref.left;
        target.css('top', bottom);
        return target.css('left', left - 20);
      },
      _prepareButton: function() {
        var button, buttonEl, id;
        id = "" + this.options.uuid + "-" + this.options.label;
        buttonEl = jQuery("<button id=\"" + id + "\" data-toggle=\"dropdown\" data-target=\"#" + (this.options.target.attr('id')) + "\" title=\"" + this.options.label + "\">\n  <span class=\"ui-button-text\"><i class=\"" + this.options.icon + "\"></i></span>\n</button>");
        if (this.options.cssClass) buttonEl.addClass(this.options.cssClass);
        button = buttonEl.button();
        return button;
      }
    });
  })(jQuery);

}).call(this);
