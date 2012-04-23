renderContainer = require('./template').renderContainer
Editor = require('./editor/editor_v2').Editor
TextLevelParams = require('./editor/model').TextLevelParams
LineLevelParams = require('./editor/model').LineLevelParams
ModelField = require('./editor/model').ModelField
ModelType = require('./editor/model').ModelType
ParamsField = require('./editor/model').ParamsField
LinkEditor = require('./editor/link_editor').LinkEditor
AttachmentEditor = require('./editor/attachment/editor').AttachmentEditor
MicroEvent = require('./utils/microevent')
DOM = require('./utils/dom')
FText = sharejs.types.ftext

SCROLL_INTO_VIEW_TIMER = 50
clone = (o) -> JSON.parse(JSON.stringify o)
# Количество миллисекунд, после которого закрывается старая группа undo-операций
# и открывается новая
UNDO_GROUP_TIMEOUT = 3000

class Rizzoma
    constructor: (@_doc) ->
        @_editable = (!!$.browser.webkit || !!$.browser.mozilla)
        @_container = $('#rizzoma')[0]
        @_createDom()
        @_undoOps = []
        @_redoOps = []
        @_editor = new Editor(@_doc.name, @_getSnapshot)
        @_editorNode = @_editor.getContainer()
        @_initEditingMenu()
        @_initRangeChangeEvent()
        @on 'range-change', (range) =>
            @_editor.updateCursor()
        @_editor.on 'ops', @_processEditorChanges
        @_editor.on 'error', (err) -> console.log err
        @_editor.initContent()
        $('#editor').append(@_editorNode)
        @_doc.on('remoteop', @_applyOps)

    _createDom: ->
        ###
        Создает DOM для отображения документа
        ###
        c = $(@_container)
        c.empty().append renderContainer({editable: @_editable})

    _getSnapshot: =>
        @_doc.snapshot

    _initEditingMenu: ->
        ###
        Инициализирует меню редактирования волны
        ###
        return if not @_editable
        @_initEditingMenuKeyHandlers()
        @_initEditingMenuButtons()
        @_initEditingModifiers()

    _initEditingMenuButtons: ->
        ###
        Инициализирует кнопки меню
        ###
        c = $(@_container)
        @_buttons = [
            ['_manageLinkButton', '.js-manage-link', @_manageLink]
            ['_insertAttachmentButton', '.js-insert-attachment', @_insertAttachment]
            ['_makeBoldButton', '.js-make-bold', @_makeBold]
            ['_makeItalicButton', '.js-make-italic', @_makeItalic]
            ['_makeUnderlinedButton', '.js-make-underlined', @_makeUnderlined]
            ['_makeBulletedButton', '.js-make-bulleted-list', @_makeBulletedList]
            ['_makeStruckthroughButton', '.js-make-struckthrough', @_makeStruckthrough]
            ['_clearFormattingButton', '.js-clear-formatting', @_clearFormatting]
            ['_undoButton', '.js-undo', @_undo]
            ['_redoButton', '.js-redo', @_redo]
        ]
        for button in @_buttons
            [name, filter, action] = button
            @[name] = c.find(filter)[0] if not @[name]
            $(@[name]).bind 'mousedown', @_eventHandler(action)
        @updateUndoRedoState()

        @_editorButtons = [
            @_manageLinkButton
            @_insertAttachmentButton
            @_clearFormattingButton
        ]
        for button in @_editorButtons
            do (button) =>
                $(button).bind 'mousedown', =>
                    @_setPressed(button, true)
        $(window).bind 'mouseup', @_setEditorButtonsUnpressed

    _initEditingMenuKeyHandlers: ->
        ###
        Инициализирует обработчики нажатий на клавиши в волне
        ###
        @_ctrlHandlers =
            65: @_selectAll         # A
            66: @_makeBold          # B
            73: @_makeItalic        # I
            76: @_manageLink        # L
            85: @_makeUnderlined    # U
            89: @_redo              # Y
            90: @_undo              # Z

        @_ctrlShiftHandlers =
            90: @_redo              # Z

        @_editorNode.addEventListener 'keydown', @_preProcessKeyDownEvent, true

    _initEditingModifiers: ->
        ###
        Инициализирует модификаторы вводимого текста для волны
        ###
        @_availableEditingModifiers = {}
        @_availableEditingModifiers[TextLevelParams.BOLD] = @_makeBoldButton
        @_availableEditingModifiers[TextLevelParams.ITALIC] = @_makeItalicButton
        @_availableEditingModifiers[TextLevelParams.UNDERLINED] = @_makeUnderlinedButton
        @_availableEditingModifiers[TextLevelParams.STRUCKTHROUGH] = @_makeStruckthroughButton
        @_availableLineParams = {}
        @_availableLineParams[LineLevelParams.BULLETED] = @_makeBulletedButton

        @_editingModifiers = {}
        @on 'range-change', (range) =>
            @_editingModifiers = {}
            @_editor.setEditingModifiers({})
            if range
                textParams = @_editor.getTextParams()
                @_hasTextParams = @_editor.hasTextParams(@_availableEditingModifiers)
            else
                textParams = {}
                @_hasTextParams = false
            @_copyEditingModifiers(textParams)
            @_updateEditingButtonsState()
            @_updateLineParamsButtonsState()

    _initRangeChangeEvent: ->
        ###
        Инициализирует событие "изменение курсора"
        ###
        @_lastRange = null
        window.addEventListener('keydown', @runCheckRange, false)
        $(@_editorNode).bind 'mousedown mouseup', (e) =>
            window.setTimeout =>
                @_checkChangedRange(@_getRange())
            , 0

    _setEditorButtonsUnpressed: =>
        for button in @_editorButtons
            @_setPressed(button, false)

    _copyEditingModifiers: (textParams) ->
        ###
        Копирует в @_editingModifiers параметры текста, которые доступны в меню
        @param textParams: obect
        ###
        for key of @_availableEditingModifiers
            if textParams[key]?
                @_editingModifiers[key] = textParams[key]
            else
                @_editingModifiers[key] = null

    _checkChangedRange: (range) =>
        return if range is @_lastRange
        return if range and @_lastRange and
            range.compareBoundaryPoints(Range.START_TO_START, @_lastRange) is 0 and
            range.compareBoundaryPoints(Range.END_TO_END, @_lastRange) is 0
        @_lastRange = range
        @_lastRange = @_lastRange.cloneRange() if @_lastRange
        @emit('range-change', @_lastRange)

    _checkRange: =>
        ###
        Проверяет положение курсора и генерирует событие изменения положения
        курсора при необходимости
        ###
        @_checkChangedRange(@_getRange())

    runCheckRange: =>
        window.setTimeout =>
            @_checkRange()
        , 0

    _eventHandler: (func) ->
        ###
        Возвращает функцию, которая остановит событие и вызовет переданную
        @param func: function
        @return: function
            function(event)
        ###
        (event) ->
            event.preventDefault()
            event.stopPropagation()
            func()

    _switchBooleanModifier: (name) ->
        ###
        Изменяет значение boolean-параметра текста
        @param name: string
        ###
        if @_editingModifiers[name]
            @_editingModifiers[name] = null
        else
            @_editingModifiers[name] = true

    _clearFormatting: =>
        ###
        Обрабатывает нажатие на кнопку "Clear formatting"
        ###
        if @_editor.hasCollapsedCursor()
            @_clearEditingModifiers()
            @_editor.setEditingModifiers(@_editingModifiers)
        else
            @_editor.clearSelectedTextFormatting()

    _makeBulletedList: =>
        ###
        Обрабатывает нажатие на кнопку "Bulleted list"
        ###
        r = @_getRange()
        return if not r
        params = @_editor.getLineParams()
        key = LineLevelParams.BULLETED
        if params[key]?
            params[key] = null
        else
            params[key] = 0
        @_editor.setRangeLineParam(key, params[key])
        @_updateLineParamsButtonsState()

    _clearEditingModifiers: ->
        ###
        Сбрасывает модификаторы редактирования текста
        ###
        @_copyEditingModifiers({})
        @_hasTextParams = false
        @_updateEditingButtonsState()

    _updateEditingButtonsState: ->
        ###
        Обновляет состояние кнопок в панели редактирования
        ###
        for key, button of @_availableEditingModifiers
            @_setPressed(button, !!@_editingModifiers[key])
        @_setEnabled(@_clearFormattingButton, @_hasTextParams)

    _setPressed: (button, isPressed) ->
        $(button).removeClass('pressed') if not isPressed
        $(button).addClass('pressed') if isPressed

    _setEnabled: (button, isEnabled) ->
        if isEnabled
            $(button).removeAttr('disabled')
        else
            $(button).attr('disabled', 'disabled')

    _getRange: ->
        ###
        Возвращает текущее выделение и блип, в котором оно сделано
        @return: DOMRange | null
        ###
        @_editor.getRange()

    _processBooleanModifierClick: (name, button) ->
        ###
        Обрабатывает нажатие на кнопку boolean-свойства текста
        @param name: string, название свойства в @_editingModifiers
        @param button: HTMLElement, кнопка в интерфейсе
        ###
        range = @_getRange()
        return if not range
        @_switchBooleanModifier(name)
        @_setPressed(button, !!@_editingModifiers[name])
        if range.collapsed
            @_editor.setEditingModifiers(@_editingModifiers)
        else
            @_editor.setRangeTextParam(name, @_editingModifiers[name])

    _makeBold: =>
        ###
        Обрабатывает нажатие на кнопку "Bold"
        ###
        @_processBooleanModifierClick(TextLevelParams.BOLD, @_makeBoldButton)

    _makeItalic: =>
        ###
        Обрабатывает нажатие на кнопку "Italic"
        ###
        @_processBooleanModifierClick(TextLevelParams.ITALIC, @_makeItalicButton)

    _makeUnderlined: =>
        ###
        Обрабатывает нажатие на кнопку "Underline"
        ###
        @_processBooleanModifierClick(TextLevelParams.UNDERLINED, @_makeUnderlinedButton)

    _makeStruckthrough: =>
        ###
        Обрабатывает нажатие на кнопку "Strikethrough"
        ###
        @_processBooleanModifierClick(TextLevelParams.STRUCKTHROUGH, @_makeStruckthroughButton)

    _updateLineParamsButtonsState: ->
        ###
        Обновляет состояние всех кнопок, отвечающих за параметры параграфов
        ###
        r = @_getRange()
        if r
            params = @_editor.getLineParams()
        else
            params = {}
        for key, button of @_availableLineParams
            @_setPressed(button, params[key]?)

    _insertAttachment: =>
        ###
        Обрабатывает нажатие на кнопку вставки вложения
        ###
        return if not @_getRange()
        AttachmentEditor.get().show(@_editor)

    _manageLink: =>
        ###
        Обрабатывает нажатие на кнопку редактирования ссылки
        ###
        LinkEditor.get().open @_editor

    _redo: =>
        ###
        Повторяет последнее отмененное пользователем действие
        ###
        @redo()
        @updateUndoRedoState()

    _undo: =>
        ###
        Отменяет последнее сделанное пользователем действие
        ###
        @undo()
        @updateUndoRedoState()

    _updateButtonState: (button, state) ->
        return if not button
        if state
            if button.disabled
                button.disabled = false
                button.removeAttribute('disabled')
        else
            unless button.disabled
                button.disabled = true
                button.setAttribute('disabled', 'disabled')

    updateUndoRedoState: =>
        ###
        Обновляет состояния кнопок undo и redo
        ###
        @_updateButtonState(@_undoButton, @hasUndoOps())
        @_updateButtonState(@_redoButton, @hasRedoOps())

    _preProcessKeyDownEvent: (e) =>
        handlers = if e.shiftKey then @_ctrlShiftHandlers else @_ctrlHandlers
        @_processKeyDownEvent(handlers, e)

    _processKeyDownEvent: (handlers, e) =>
        ###
        Обрабатывает нажатия клавиш внутри блипов
        @param e: DOM event
        ###
        return if (not e.ctrlKey) or e.altKey
        return if not (e.keyCode of handlers)
        handlers[e.keyCode]()
        e.preventDefault()
        e.stopPropagation()

    _processEditorChanges: (ops) =>
        @_submitOps(ops)
        @scrollIntoView()
        @_redoOps = []
        @_addAndMergeUndoOps(@_doc.name, ops)
        @updateUndoRedoState()

    _applyOps: (ops) =>
        @_editor.applyOps(ops)
        @_transformUndoRedoOps(@_doc.name, ops)

    _submitOps: (ops) ->
        @_doc.submitOp(ops)

    _selectAll: =>
        @_editor.selectAll()

    _scrollIntoCursor: =>
        @_scrollTimer = null
        range = DOM.getRange()
        return if not range
        return if not range.collapsed
        container = range.startContainer
        container = container.parentNode if DOM.isTextNode(container)
        waveViewTop = @_container.getBoundingClientRect().top
        waveViewBottom = waveViewTop + @_container.offsetHeight
        elementTop = container.getBoundingClientRect().top
        elementBottom = elementTop + container.offsetHeight
        return container.scrollIntoView() if waveViewTop > elementTop
        return container.scrollIntoView(no) if waveViewBottom < elementBottom

    scrollIntoView: ->
        ###
        Скролирует элемент с текущим курсором в видимую область
        ###
        if @_scrollTimer?
            clearTimeout(@_scrollTimer)
        @_scrollTimer = setTimeout(@_scrollIntoCursor, SCROLL_INTO_VIEW_TIMER)

    _isTextOp: (op) ->
        op[ModelField.PARAMS][ParamsField.TYPE] is ModelType.TEXT

    _getOpType: (op) ->
        return 'text insert' if op.ti? and @_isTextOp(op)
        return 'text delete' if op.td? and @_isTextOp(op)
        return 'other'

    _getOpsType: (ops) ->
        ###
        Возвращает 'text insert', если все указанные операции являются операциями
        вставки текста.
        Возвращает 'text delete', если все указанные операции являются операциями
        вставки текста.
        Возвращает 'other' иначе
        ###
        return 'other' if not ops.length
        firstOpType = @_getOpType(ops[0])
        return 'other' if firstOpType is 'other'
        for op in ops[1..]
            opType = @_getOpType(op)
            return 'other' if opType is 'other'
            return 'other' if opType isnt firstOpType
        return firstOpType

    _shouldMergeOps: (id, ops) ->
        ###
        Возвращает true, если указанные операции стоит объединить с последними
        сделанными для отмены
        @param id: string
        @param ops: [ShareJS operations]
        @return: boolean
        ###
        return false if @_undoOps.length is 0
        return false if @_undoOps[@_undoOps.length-1].id isnt id
        curTime = (new Date()).getTime()
        return false if curTime > @_lastUndoGroupStartTime + UNDO_GROUP_TIMEOUT
        type = @_getOpsType(ops)
        return false if type isnt 'text insert' and type isnt 'text delete'
        return false if type isnt @_lastUndoGroupType
        lastOps = @_undoOps[@_undoOps.length - 1].ops
        lastOp = lastOps[0]
        if type is 'text insert'
            delta = lastOp.td.length
        else
            delta = -lastOp.ti.length
        return false if ops[0].p != lastOp.p + delta
        return true

    _addAndMergeUndoOps: (id, ops) =>
        if @_shouldMergeOps(id, ops)
            @_mergeUndoOps(ops)
        else
            @_addUndoOps(id, ops)
            @_lastUndoGroupType = @_getOpsType(ops)
            @_lastUndoGroupStartTime = (new Date()).getTime()

    _addUndoOps: (id, ops) =>
        ###
        Добавляет новую группу undo-операций
        @param id: string
        @param ops: [ShareJS operations]
        ###
        @_undoOps.push {id: id, ops: FText.invert(ops)}

    _mergeUndoOps: (ops) =>
        ###
        Сливает указанные операции с последней группой undo-операций
        @param id: string
        @param ops: [ShareJS operations]
        ###
        lastOps = @_undoOps[@_undoOps.length-1].ops
        lastOps[0...0] = FText.invert(ops)

    _transformUndoRedoOps: (id, ops) ->
        @_transformOps(id, ops, @_undoOps)
        @_transformOps(id, ops, @_redoOps)

    _transformOps: (id, ops, blocks) ->
        ops = clone ops
        blocks.reverse()
        for block in blocks
            continue if id isnt block.id
            blockOps = block.ops
            block.ops = FText.transform(blockOps, ops, 'right')
            ops = FText.transform(ops, blockOps, 'left')
        blocks.reverse()

    _addRedoOps: (id, ops) =>
        @_redoOps.push {id: id, ops: FText.invert(ops)}

    _applyUndoRedo: (ops, invertAction) ->
        ###
        Применяет операцию undo или redo, содержит общую логику по ожиданию
        загрузки блипов
        ###
        o = ops.pop()
        return if not o
        return @_applyUndoRedo(ops, invertAction) if not o.ops.length
        id = o.id

        # Блип был удален
        @_editor.applyOps(o.ops, yes)
        @scrollIntoView()
        @_submitOps(o.ops)
        invertAction(id, o.ops)

    undo: ->
        ###
        Отменяет последнюю совершенную пользователем операцию, которую
        еще можно отменить
        ###
        @_applyUndoRedo(@_undoOps, @_addRedoOps)
        @_lastUndoGroupStartTime = 0

    redo: ->
        ###
        Повторяет последнюю отмененную операцию, если после нее не было простого
        ввода текста.
        ###
        @_applyUndoRedo(@_redoOps, @_addUndoOps)

    hasUndoOps: ->
        ###
        Возвращает true, если есть undo-операции
        ###
        @_undoOps.length > 0

    hasRedoOps: ->
        ###
        Возвращает true, если есть redo-операции
        ###
        @_redoOps.length > 0

Rizzoma = MicroEvent.mixin(Rizzoma)

sharejs.open 'hello', 'ftext', (error, doc) =>
    rizzoma = new Rizzoma(doc)
