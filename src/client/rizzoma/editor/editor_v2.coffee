BrowserEvents = require('../utils/browser_events')
KeyCodes = require('../utils/key_codes').KeyCodes
TextLevelParams = require('./model').TextLevelParams
LineLevelParams = require('./model').LineLevelParams
ModelField = require('./model').ModelField
ParamsField = require('./model').ParamsField
ModelType = require('./model').ModelType
renderEditor = require('./template').renderEditor
Renderer = require('./renderer').Renderer
HtmlSelectionHelper = require('./selection/html_selection_helper').HtmlSelectionHelper
DomUtils = require('../utils/dom')
MicroEvent = require('../utils/microevent')
Utf16Util = require('../utils/string').Utf16Util
LinkPopup = require('./link_editor/link_popup').LinkPopup
LinkEditor = require('./link_editor').LinkEditor
#TODO: clean unused code
class EventType
    # Ввод содержимого
    @INPUT = 'INPUT'
    # Перемещения курсора
    @NAVIGATION = 'NAVIGATION'
    # Удаление содержимого
    @DELETE = 'DELETE'
    # Новый параграф
    @LINE = 'LINE'
    # Увеличение уровня списка
    @TAB = 'TAB'
    # Опасные, которые могут внести изменения
    @DANGEROUS = 'DANGEROUS'
    # Остальные, не вносящие изменений
    @NOEFFECT = 'NOEFFECT'

class SelectionAction
    @DELETE = 'DELETE'
    @TEXT = 'TEXT'
    @LINE = 'LINE'
    @GETTEXTPARAMS = 'GETTEXTPARAMS'
    @GETLINEPARAMS = 'GETLINEPARAMS'
    @CLEARTEXTPARAMS = 'CLEARTEXTPARAMS'

INITIAL_LINE = {}
INITIAL_LINE[ModelField.TEXT] = ' '
INITIAL_LINE[ModelField.PARAMS] = {}
INITIAL_LINE[ModelField.PARAMS][ParamsField.TYPE] = ModelType.LINE
INITIAL_CONTENT = [INITIAL_LINE]
LINK_POPUP_TIMEOUT = 50

class Editor
    constructor: (args...) ->
        @_init(args...)

    _init: (id, @_getSnapshot, addInline, @_getRecipient, @_alwaysShowPopupAtBottom) ->
        @_editable = (!!$.browser.webkit || !!$.browser.mozilla)
        @_createDom()
        @_renderer = new Renderer id, addInline, (id) =>
            @_getRecipient(id, @_removeRecipient)
        @_htmlSelectionHelper = new HtmlSelectionHelper(@_container)
        @_modifiers = {}

    _createDom: ->
        tmpContainer = document.createElement 'span'
        $(tmpContainer).append(renderEditor(isEditable: @_editable))
        @_container = tmpContainer.firstChild

    initContent: ->
        # set content to the editor
        try
            content = @_getSnapshot()
            if not content.length
                content = INITIAL_CONTENT
                ops = []
                for i in [content.length-1..0]
                    ops.push
                        p: 0
                        ti: content[i].t
                        params: content[i].params
            @_registerDomEventHandling()
            @_renderer.renderContent(@_container, content)
            @emit('ops', ops) if ops?
        catch e
            @emit('error', e)

    _registerDomEventHandling: ->
        $container = $(@_container)
        # TODO: check if we need keyup event
        @_container.addEventListener(BrowserEvents.KEYDOWN_EVENT, @_processKeyEvent, false)
        @_container.addEventListener(BrowserEvents.KEYPRESS_EVENT, @_processKeyEvent, false)
        $container.bind(BrowserEvents.DRAGDROP_EVENTS.join(' '), @_processDragDropEvent)
        $container.bind(BrowserEvents.CLIPBOARD_EVENTS.join(' '), @_processClipboardEvent)
        $container.bind("#{BrowserEvents.TEXT_INPUT_EVENT} #{BrowserEvents.TEXT_EVENT}", @_processTextInputEvent)

    _unregisterDomEventHandling: ->
        @_container.removeEventListener(BrowserEvents.KEYDOWN_EVENT, @_processKeyEvent, false)
        @_container.removeEventListener(BrowserEvents.KEYPRESS_EVENT, @_processKeyEvent, false)
        $(@_container).unbind()

    _processTextInputEvent: (event) ->
#        console.log event
#        event.preventDefault()
#        event.stopPropagation()

    _processKeyEvent: (event) =>
        cancel = @_handleKeyEvent(event)
        if cancel
            event.stopPropagation()
            event.preventDefault()

    _handleKeyEvent: (event) ->
        eventType = @_getKeyEventType(event)
        switch eventType
            when EventType.INPUT
                return @_handleTyping(event)
            when EventType.LINE
                return @_handleNewLine(event)
            when EventType.TAB
                return @_handleTab(event)
            when EventType.DELETE
                return @_handleDelete(event)
            when EventType.NAVIGATION
                return no
            when EventType.NOEFFECT
                event.stopPropagation()
                return no
            when EventType.DANGEROUS
                return yes
            else
                console.log 'unknown type'
                return yes

    _getKeyEventType: (event) ->
        computedKeyCode = if event.which != 0 then event.which else event.keyCode

        type = null
        # wiab webkit key logic
        if not computedKeyCode
            type = EventType.DANGEROUS
        else if KeyCodes.NAVIGATION_KEYS.indexOf(computedKeyCode) isnt -1
            type = EventType.NAVIGATION
        else if event.type is BrowserEvents.KEYPRESS_EVENT
            if computedKeyCode is KeyCodes.KEY_ESCAPE
                type = EventType.NOEFFECT
            else if computedKeyCode is KeyCodes.KEY_TAB
                type = EventType.TAB
            else
                type = EventType.INPUT
        else if computedKeyCode is KeyCodes.KEY_DELETE or computedKeyCode is KeyCodes.KEY_BACKSPACE
            type = EventType.DELETE
        # KeyboardEvent "keyup" "U+001B" 27 27 escape
        #  "keyup" "U+002A" 42 42 print scr
        #  "keyup" "U+007F" 46 46 delete1
        # "keyup" "U+0090" 144 144 numlck
        # U+0000" 0 0 del num
        # "keyup" "U+0008" 8 8 bckspc
        # "keyup" "U+0009" 9 9 tab
        # KeyboardEvent "keyup" "U+005D" 93 93 PREF
        else if computedKeyCode is KeyCodes.KEY_ESCAPE or event.keyIdentifier is 'U+0010' or
                event.type is BrowserEvents.KEYUP_EVENT
            type = EventType.NOEFFECT
        else if computedKeyCode is KeyCodes.KEY_ENTER
            type = EventType.LINE
        else if computedKeyCode is KeyCodes.KEY_TAB
            type = EventType.TAB
        else
            type = EventType.NOEFFECT
        type

    _getCurrentElement: (node, offset) ->
        # Возвращает элемент, содержащий параметры и смещение этого элемента
        return [@_renderer.getPreviousElement(node), offset] if DomUtils.isTextNode(node)
        rightNode = node.childNodes[offset]
        if rightNode
            element = @_renderer.getPreviousElement(rightNode)
            return [element, 0] if DomUtils.isTextNode(rightNode)
            return [element, @_renderer.getElementLength(element)]
        leftNode = node.childNodes[offset - 1] || node
        if leftNode
            element = if (@_renderer.getElementType(leftNode))? then leftNode else @_renderer.getPreviousElement(leftNode)
            return [element, @_renderer.getElementLength(element)]
        console.error node, offset
        throw 'could not determine real node'

    _getOffsetBefore: (node) ->
        # Возращает смедение в снепшоте до текущей ноды
        offset = 0
        while node = @_renderer.getPreviousElement(node)
            offset += @_renderer.getElementLength(node)
        offset

    _getStartElementAndOffset: (range) ->
        [curNode, offset] = @_getCurrentElement(range.startContainer, range.startOffset)
        prevOffset = @_getOffsetBefore(curNode) + offset
        [curNode, prevOffset]

    _getEndElementAndOffset: (range) ->
        [curElement, offset] = @_getCurrentElement(range.endContainer, range.endOffset)
        prevOffset = @_getOffsetBefore(curElement) + offset
        [curElement, prevOffset]

    _getElementTextParams: (element) ->
        ###
        Возвращает текстовые параметры указанного элемента (для нетекстовых
        элементов возвращает пустые параметры текстового объекта)
        @param element: DOM node
        @return: object
        ###
        if @_renderer.getElementType(element) is ModelType.TEXT
            return @_renderer.getElementParams(element)
        params = {}
        params[ParamsField.TYPE] = ModelType.TEXT
        return params

    _handleTyping: (event) ->
        # processing model changes
        c = Utf16Util.traverseString(String.fromCharCode(event.charCode))
        return yes if not c.length
        range = @getRange()
        return yes if not range
        if c is '@'
            @insertRecipient()
            return yes
        ops = []
        [startElement, startOffset] = @_getStartElementAndOffset(range)
        if not range.collapsed
            try
                [endElement, endOffset] = @_getEndElementAndOffset(range)
                ops = @_processSelection(startOffset, endOffset, endElement, SelectionAction.DELETE)
            catch e
                console.warn e
                return yes
        endElement ?= startElement
        endOffset ?= startOffset
        params = @_getElementTextParams(startElement)
        for key, value of @_modifiers
            if value is null
                delete params[key]
            else
                params[key] = value
        if params[TextLevelParams.URL]?
            realStartOffset = startOffset - @_getOffsetBefore(startElement)
            if not realStartOffset
                if (prevElement = @_renderer.getPreviousElement(startElement))
                    if @_renderer.getElementParams(prevElement)[TextLevelParams.URL] isnt params[TextLevelParams.URL]
                        delete params[TextLevelParams.URL]
                else
                    delete params[TextLevelParams.URL]
        if params[TextLevelParams.URL]?
            endElementParams = @_renderer.getElementParams(endElement)
            endElementUrl = endElementParams[TextLevelParams.URL]
            if endElementUrl isnt params[TextLevelParams.URL]
                delete params[TextLevelParams.URL]
            else
                realEndOffset = endOffset - @_getOffsetBefore(endElement)
                if realEndOffset is @_renderer.getElementLength(endElement)
                    if (nextElement = @_renderer.getNextElement(endElement))
                        nextElementParams = @_renderer.getElementParams(nextElement)
                        if nextElementParams[TextLevelParams.URL] isnt params[TextLevelParams.URL]
                            delete params[TextLevelParams.URL]
                    else
                        delete params[TextLevelParams.URL]
        op = {p: startOffset, ti: c, params: params}
        ops.push(op)
        @_submitOps(ops)
        yes

    _lineIsEmpty: (line) ->
        ###
        Возвращает true, если переданный параграф является пустым
        @param line: HTMLElement
        @return: boolean
        ###
        next = @_renderer.getNextElement(line)
        return true unless next?
        return @_renderer.getElementType(next) is ModelType.LINE

    _handleNewLine: (event) ->
        range = @getRange()
        return yes if not range
        [elem, prevOffset] = @_getStartElementAndOffset(range)
        prevLine = @_renderer.getParagraphNode(elem)
        prevParams = @_renderer.getElementParams(prevLine)
        params = {}
        if prevParams[LineLevelParams.BULLETED]?
            params[LineLevelParams.BULLETED] = prevParams[LineLevelParams.BULLETED]
        if @_lineIsEmpty(prevLine) and prevParams[LineLevelParams.BULLETED]?
            # Просто снимем bulleted list
            op = {p: prevOffset-1, len: 1, paramsd: params}
        else
            # Создадим новый параграф
            params[ParamsField.TYPE] = ModelType.LINE
            params[ParamsField.RANDOM] = Math.random()
            op = {p: prevOffset, ti: ' ', params: params}
        @_submitOp(op)
        yes

    _handleTab: (event) ->
        ###
        Обрабатывает нажатие на tab
        ###
        range = @getRange()
        return yes if not range
        [elem] = @_getStartElementAndOffset(range)
        line = @_renderer.getParagraphNode(elem)
        offset = @_getOffsetBefore(line)
        prevParams = @_renderer.getElementParams(line)
        return yes unless prevParams[LineLevelParams.BULLETED]?
        diff = if event.shiftKey then -1 else 1
        oldLevel = prevParams[LineLevelParams.BULLETED]
        newLevel = Math.max(0, oldLevel + diff)
        return yes if oldLevel is newLevel
        paramsd = {}
        paramsd[LineLevelParams.BULLETED] = oldLevel
        opd = {p: offset, len: 1, paramsd: paramsd}
        paramsi = {}
        paramsi[LineLevelParams.BULLETED] = newLevel
        opi = {p: offset, len: 1, paramsi: paramsi}
        @_submitOps([opd, opi])
        return yes

    _getDeleteOp: (element, index, length) ->
        ###
        Генерирует операцию удаления
        @param element: HTMLNode - элемент, в котором будет происходить удаление
        @param index: int - индекс, по которому будет происходить удаление
        @param length: int - обязательный параметр для удаления текста, при удалении элементов остальных
                типов не будет использован
        ###
        type = @_renderer.getElementType(element)
        op = {p: index, params: @_renderer.getElementParams(element)}
        switch type
            when ModelType.TEXT
                beforeOffset = @_getOffsetBefore(element)
                textOffset = index - beforeOffset
                op.td = element.firstChild.data.substr(textOffset, length)
            else
                op.td = ' '
        op

    _deleteNext: (element, offset, moveToNextElement = true) ->
        return null if not offset
        nextElement = @_renderer.getNextElement(element)
        type = @_renderer.getElementType(element)
        switch type
            when ModelType.TEXT
                realOffset = offset - @_getOffsetBefore(element)
                if @_renderer.getElementLength(element) > realOffset
                    # delete char insite current element
                    return @_getDeleteOp(element, offset, 1)
                else
                    return @_deleteNext(nextElement, offset, false) if moveToNextElement and nextElement
                    # there is no element to delete
                    return null
            else
                if moveToNextElement
                    return @_deleteNext(nextElement, offset, false) if nextElement
                    # there is no element to delete
                    return null
                else
                    # do not allow to delete blip
                    return null if @_renderer.getElementType(element) is ModelType.BLIP
                    return @_getDeleteOp(element, offset)

    _deletePrev: (element, offset) ->
        return null if not offset
        prevElement = @_renderer.getPreviousElement(element)
        type = @_renderer.getElementType(element)
        switch type
            when ModelType.TEXT
                realOffset = offset - @_getOffsetBefore(element)
                if realOffset < 0
                    return @_deletePrev(prevElement, offset) if prevElement
                    # there is no element to delete
                    return null
                else
                    # delete char insite current element
                    return @_getDeleteOp(element, offset, 1)
            else
                # do not allow to delete blip
                return null if @_renderer.getElementType(element) is ModelType.BLIP
                return @_getDeleteOp(element, offset)

    _getTextMarkupOps: (element, index, length, param, value) ->
        ops = []
        if not TextLevelParams.isValid(param)
            throw new Error "Bad text param is set: #{param}, #{value}"
        type = @_renderer.getElementType(element)
        return ops unless type is ModelType.TEXT
        params = @_renderer.getElementParams(element)
        if params[param]?
            op = {p: index, len: length, paramsd: {}}
            op.paramsd[param] = params[param]
            ops.push(op)
        if value?
            op = {p: index, len: length, paramsi: {}}
            op.paramsi[param] = value
            ops.push(op)
        ops

    _getClearTextMarkupOps: (element, index, length) ->
        ops = []
        type = @_renderer.getElementType(element)
        return ops unless type is ModelType.TEXT
        params = @_renderer.getElementParams(element)
        for param of params
            continue if param is ParamsField.TYPE
            continue if param is TextLevelParams.URL
            op = {p: index, len: length, paramsd: {}}
            op.paramsd[param] = params[param]
            ops.push(op)
        ops

    _getLineMarkupOps: (element, index, param, value) ->
        ops = []
        if not LineLevelParams.isValid(param)
            throw new Error "Bad line param is set: #{param}, #{value}"
        type = @_renderer.getElementType(element)
        return ops unless type is ModelType.LINE
        params = @_renderer.getElementParams(element)
        if params[param]?
            op = {p: index, len: 1, paramsd: {}}
            op.paramsd[param] = params[param]
            ops.push(op)
        if value?
            op = {p: index, len: 1, paramsi: {}}
            op.paramsi[param] = value
            ops.push(op)
        ops

    _processSelection: (startOffset, endOffset, lastElement, action, param, value) ->
        ###
        Для указанного выделения возвращает результаты, полученные одним из действий:
        SelectionAction.DELETE: удаление, возвращает ShareJS-операции удаления
        SelectionAction.TEXT: изменение параметров текста, возввращает ShareJS-операции
            маркировки текста
        SelectionAction.LINE: изменение парметров абзацев, возвращает ShareJS-операции
            маркировки абзацев
        SelectionAction.GETTEXTPARAMS: текстовые параметры, возвращает массив объектов параметров
            для всех текстовых блоков внутри выделения
        SelectionAction.GETLINEPARAMS: абзацевые параметры. возвращает массив объектов параметров
            для всех абзацев, содержащих выделение
        SelectionAction.CLEARTEXTPARAMS: удаление параметров текста, возвращает ShareJS-операции
            удаления маркировки текста (кроме ссылок)
        @param startOffset: int - начальное смещение
        @param endOffset: int - конечное смещение (не включая элемент по смещению)
        @param lastElement: HTMLElement - элемент, на который попадает конец выделения (включен в выделение)
        @param action: SelectionAction - действие, которое будет совершаться над выделением
        @param param: имя параметра для маркировки (только для действий по маркировке выделения)
        @param value: значение параметра для маркировки (только для действий по маркировке веделения)
        @returns: [object]
        ###
        res = []
        selectionLength = endOffset - startOffset
        while selectionLength
            params = @_renderer.getElementParams(lastElement)
            type = @_renderer.getElementType(lastElement)
            beforeOffset = @_getOffsetBefore(lastElement)
            # element length which will be processed
            workingLength = Math.min(selectionLength, endOffset - beforeOffset)

            index = endOffset - workingLength
            switch action
                when SelectionAction.DELETE
                    ops = [@_getDeleteOp(lastElement, index, workingLength)]
                when SelectionAction.TEXT
                    ops = @_getTextMarkupOps(lastElement, index, workingLength, param, value)
                when SelectionAction.LINE
                    ops = @_getLineMarkupOps(lastElement, index, param, value)
                when SelectionAction.CLEARTEXTPARAMS
                    ops = @_getClearTextMarkupOps(lastElement, index, workingLength)
                when SelectionAction.GETTEXTPARAMS
                    type = @_renderer.getElementType(lastElement)
                    if type is ModelType.TEXT
                        ops = [@_renderer.getElementParams(lastElement)]
                    else
                        ops = null
                when SelectionAction.GETLINEPARAMS
                    type = @_renderer.getElementType(lastElement)
                    if type is ModelType.LINE
                        ops = [@_renderer.getElementParams(lastElement)]
                    else
                        ops = null
            while ops and ops.length
                if action is SelectionAction.TEXT
                    res.unshift(ops.pop())
                else
                    res.push(ops.shift())
            endOffset -= workingLength
            selectionLength -= workingLength
            lastElement = @_renderer.getPreviousElement(lastElement)
        res

    _handleDelete: (event) ->
        range = @getRange()
        return yes if not range
        [element, prevOffset] = @_getStartElementAndOffset(range)
        if not range.collapsed
            try
                [endElement, endOffset] = @_getEndElementAndOffset(range)
                ops = @_processSelection(prevOffset, endOffset, endElement, SelectionAction.DELETE)
                @_submitOps(ops) if ops.length
            catch e
                console.warn e
                console.warn e.stack
            return yes
        [element, prevOffset] = @_getStartElementAndOffset(range)
        if event.keyCode is KeyCodes.KEY_DELETE
            try
                op = @_deleteNext(element, prevOffset)
            catch e
                console.warn 'Error while handle delete', element, prevOffset, e
                console.warn e.stack
                return yes
        else
            try
                op = @_deletePrev(element, prevOffset - 1)
            catch e
                console.warn 'Error while handle bcksp', element, prevOffset, e
                console.warn e.stack
                return yes
        @_submitOp(op) if op
        yes

    _processDragDropEvent: (event) =>
        # TODO: handle
        console.warn('block dnd event')
        event.preventDefault()
        event.stopPropagation()

    _processClipboardEvent: ($event) =>
        event = $event.originalEvent
        cancel = @_handleClipboardEvent(event)
        if cancel
            event.stopPropagation()
            event.preventDefault()

    _handleClipboardEvent: (event) ->
        # TODO: handle
        return no if event.type is BrowserEvents.COPY_EVENT
        return @_handlePasteEvent(event) if event.type is BrowserEvents.PASTE_EVENT
        return yes if event.type is BrowserEvents.CUT_EVENT
        console.warn('block clipboardevent event', event.type)
        event.stopPropagation()
        event.preventDefault()
        yes

    _handlePasteEvent: (event) ->
        return yes if not (event.clipboardData && event.clipboardData.getData)
        range = @getRange()
        return if not range
        if (///text/plain///.test(event.clipboardData.types))
            ops = []
            [startElement, offset] = @_getStartElementAndOffset(range)
            if not range.collapsed
                [endElement, endOffset] = @_getEndElementAndOffset(range)
                try
                    ops = @_processSelection(offset, endOffset, endElement, SelectionAction.DELETE)
                catch e
                    @emit('error', e)
                    return yes
            data = event.clipboardData.getData('text/plain')
            data = data.replace(/\t/g, '    ')
            lines = data.split(/[\n\r]/g)
            for line in lines
                line = Utf16Util.traverseString(line)
                if line.length
                    params = {}
                    params[ParamsField.TYPE] = ModelType.TEXT
                    textOp =
                        p: offset
                        ti: line
                        params: params
                    offset += line.length
                    ops.push(textOp)
                params = {}
                params[ParamsField.TYPE] = ModelType.LINE
                params[ParamsField.RANDOM] = Math.random()
                lineOp =
                    p: offset
                    ti: ' '
                    params: params
                ops.push(lineOp)
                offset++
            return yes if ops.length < 2
            ops.pop()
            try
                @_submitOps(ops)
            catch e
                @emit('error', e)
        yes

    _submitOp: (op) ->
        @_renderer.applyOp(op, yes)
        if @_cursor
            setTimeout =>
                @_processCursor()
            , 0
        @emit('ops', [op])

    _submitOps: (ops) ->
        @_renderer.applyOps(ops, yes)
        if @_cursor
            setTimeout =>
                @_processCursor()
            , 0
        @emit('ops', ops)

    getRange: ->
        @_htmlSelectionHelper.getRange()

    insertBlip: (id) ->
        try
            range = @getRange()
            return if not range
            [startElement, startOffset] = @_getEndElementAndOffset(range)
            params = {}
            params[ParamsField.TYPE] = ModelType.BLIP
            params[ParamsField.ID] = id
            params[ParamsField.RANDOM] = Math.random()
            op = {p: startOffset, ti: ' ', params: params}
            @_submitOp(op)
        catch e
            @emit('error', e)

    insertBlipToEnd: (id) ->
        offset = 0
        while element = @_renderer.getNextElement(element)
            offset += @_renderer.getElementLength(element)
        params = {}
        params[ParamsField.TYPE] = ModelType.BLIP
        params[ParamsField.ID] = id
        params[ParamsField.RANDOM] = Math.random()
        op = {p: offset, ti: ' ', params: params}
        try
            @_submitOp(op)
        catch e
            @emit('error', e)

    removeBlip: (id) ->
        try
            element = null
            while element = @_renderer.getNextElement(element)
                continue unless @_renderer.getElementType(element) is ModelType.BLIP
                params = @_renderer.getElementParams(element)
                continue unless params[ParamsField.ID] is id
                offset = @_getOffsetBefore(element)
                op = {p: offset, td: ' ', params: params}
                @_submitOp(op)
                break
        catch e
            @emit('error', e)

    insertAttachment: (url) ->
        try
            range = @getRange()
            return if not range
            [startElement, startOffset] = @_getEndElementAndOffset(range)
            params = {}
            params[ParamsField.TYPE] = ModelType.ATTACHMENT
            params[ParamsField.URL] = url
            params[ParamsField.RANDOM] = Math.random()
            op = {p: startOffset, ti: ' ', params: params}
            @_submitOp(op)
        catch e
            @emit('error', e)

    insertRecipient: ->
        ###
        Вставляет поле ввода для получателя сообщения
        Создает обработчики потери фокуса и нажатия клавиш.
        При выборе участника удаляет поле ввода и генерирует операцию для вставки получателя
        ###
        try
            range = @getRange()
            return if not range
            recipient = @_getRecipient(null)
            recipientContainer = recipient.getContainer()
            @_renderer.preventEventsPropagation(recipientContainer)
            [startElement, offset] = @_getEndElementAndOffset(range)
            @_renderer.insertNodeAt(recipientContainer, offset)
            params = @_renderer.getElementParams(startElement)
            recipient.focus()
            $(recipientContainer).bind 'itemSelected', (event, userId) =>
                return unless userId?
                offset = @_getOffsetBefore(recipientContainer)
                $(recipientContainer).remove()
                params = {}
                params[ParamsField.TYPE] = ModelType.RECIPIENT
                params[ParamsField.ID] = userId
                params[ParamsField.RANDOM] = Math.random()
                op = {p: offset, ti: ' ', params: params}
                @_submitOp(op)
            $(recipientContainer).bind "blur #{BrowserEvents.KEY_EVENTS.join(' ')}", (event) =>
                return if event.keyCode? and event.keyCode isnt KeyCodes.KEY_ESCAPE
                offset = @_getOffsetBefore(recipientContainer)
                $(recipientContainer).remove()
                if params[ParamsField.TYPE] isnt ModelType.TEXT
                    params = {}
                    params[ParamsField.TYPE] = ModelType.TEXT
                op = {p: offset, ti: '@', params: params}
                @_submitOp(op)
        catch e
            @emit('error', e)

    _removeRecipient: (recipient) =>
        ###
        Удаляет получателя сообщения из редактора
        @param recipient: Recipient - получатель, которого надо удалить
        ###
        recipientNode = recipient.getContainer()
        recipientParams = @_renderer.getElementParams(recipientNode)
        offset = @_getOffsetBefore(recipientNode)
        op = {p: offset, td: ' ', params: recipientParams}
        try
            @_submitOp(op)
        catch e
            @emit('error', e)

    hasRecipients: ->
        ###
        Проверяет наличия хотя бы одного получателя сообщения в редакторе
        @returns: boolean - true, если в редакторе присутствует хотя бы один получатель, иначе false
        ###
        @_renderer.getRecipientNodes().length > 0

    getRecipients: ->
        ###
        Возвращает массив, содержащий объекты получателей данного сообщения
        @returns: [Recipient]
        ###
        recipientNodes = @_renderer.getRecipientNodes()
        recipients = []
        for recipientNode in recipientNodes
            recipients.push($(recipientNode).data('recipient'))
        recipients

    getNextBlip: (element = null) ->
        ###
        Возвращает идентификатор блипа, следующего за указанной нодой, или null, если следующего блипа нет
        @param element: HTMLNode - нода, после которой надо начать поиск
        @returns: [string, HTMLElement]
        ###
        while element = @_renderer.getNextElement(element)
            continue unless @_renderer.getElementType(element) is ModelType.BLIP
            return [@_renderer.getElementParams(element)[ParamsField.ID], element]
        [null, null]

    markLink: (value) ->
        try
            range = @getRange()
            return yes if not range or range.collapsed
            [element, prevOffset] = @_getStartElementAndOffset(range)
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            ops = @_processSelection(prevOffset, endOffset, endElement, SelectionAction.TEXT, TextLevelParams.URL, value)
            @_submitOps(ops) if ops?.length
            return yes
        catch e
            @emit('error', e)

    getContainer: ->
        @_container

    applyOps: (ops, shiftCursor) ->
        try
            @_renderer.applyOps(ops, shiftCursor)
            if @_cursor
                setTimeout =>
                    @_processCursor()
                , 0
        catch e
            @emit('error', e)

    setEditable: (editable) ->
        return if not ($.browser.webkit or $.browser.mozilla)
        return if editable is @_editable
        @_editable = editable
        @_container.contentEditable = @_editable.toString()
        if @_editable
            @_registerDomEventHandling()
        else
            @_unregisterDomEventHandling()

    containsNode: (node) ->
        ###
        Возвращает true, если указанный элемент находиться в этом редакторе
        @param node: HTMLElement
        @return: boolean
        ###
        DomUtils.contains(@_container, node)

    setEditingModifiers: (@_modifiers) ->
        ###
        Устанавливает модификаторы стиля текста, которые будут применены к
        вводимому тексту
        @param _modifiers: object
        ###

    setRangeTextParam: (name, value) ->
        ###
        Устанавливает указанный текстовый параметр на текущем выбранном
        диапазоне в указанное значение.
        Если value=null, удаляет указанный параметр.
        @param name: string
        @param value: any
        ###
        try
            range = @getRange()
            return if not range or range.collapsed
            [element, prevOffset] = @_getStartElementAndOffset(range)
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            ops = @_processSelection(prevOffset, endOffset, endElement, SelectionAction.TEXT, name, value)
            @_submitOps(ops) if ops?.length
        catch e
            @emit('error', e)

    _filterSameParams: (blocks) ->
        ###
        Возвращает объект, содержащий все пары ключ-значение, совпадающие
        у всех объектов переданного массива.
        @param blocks: [object]
        @return: object
        ###
        return {} if not blocks.length
        params = blocks.pop()
        for blockParams in blocks
            for key in Object.keys(params)
                delete params[key] if params[key] isnt blockParams[key]
        params

    _hasTextParams: (block, neededParams) ->
        ###
        Возвращает true, если для указанного блока есть текстовый параметр
        @param block: object
        @param neededParams: {paramName: anything}
        @return: boolean
        ###
        for param of block
            continue if param is ParamsField.TYPE
            continue if param not of neededParams
            return true
        return false

    hasTextParams: (neededParams) ->
        ###
        Возврващает true, если в выделенном тексте установлен хотя бы один из
        переданных параметров.
        @param neededParams: {paramName: anything}
        @return: boolean
        ###
        try
            range = @getRange()
            return false if not range
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            if range.collapsed
                params = @_getElementTextParams(endElement)
                return @_hasTextParams(params, neededParams)
            else
                [startElement, startOffset] = @_getStartElementAndOffset(range)
                blocks = @_processSelection(startOffset, endOffset, endElement, SelectionAction.GETTEXTPARAMS)
                for params in blocks
                    return true if @_hasTextParams(params, neededParams)
            return false
        catch e
            @emit('error', e)

    getTextParams: ->
        ###
        Возвращает общие для выделенного текста параметры.
        @return: object
        ###
        try
            range = @getRange()
            return {} if not range
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            if range.collapsed
                params = @_getElementTextParams(endElement)
            else
                [startElement, startOffset] = @_getStartElementAndOffset(range)
                blocks = @_processSelection(startOffset, endOffset, endElement, SelectionAction.GETTEXTPARAMS)
                params = @_filterSameParams(blocks)
            delete params[ParamsField.TYPE]
            return params
        catch e
            @emit('error', e)

    setRangeLineParam: (name, value) ->
        ###
        Устанавливает указанный параметр параграфа для всех параграфов, которые
        содержат текущий выбранный диапазон.
        Если value=null, удаляет указанный параметр.
        @param name: string
        @param value: any
        ###
        try
            range = @getRange()
            return if not range
            [startElement] = @_getStartElementAndOffset(range)
            startElement = @_renderer.getParagraphNode(startElement)
            startOffset = @_getOffsetBefore(startElement)
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            ops = @_processSelection(startOffset, endOffset, endElement, SelectionAction.LINE, name, value)
            @_submitOps(ops) if ops?.length
        catch e
            @emit('error', e)

    getLineParams: ->
        ###
        Возвращает параметры
        ###
        try
            range = @getRange()
            return {} if not range
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            [startElement] = @_getStartElementAndOffset(range)
            startElement = @_renderer.getParagraphNode(startElement)
            startOffset = @_getOffsetBefore(startElement)
            blocks = @_processSelection(startOffset, endOffset, endElement, SelectionAction.GETLINEPARAMS)
            params = @_filterSameParams(blocks)
            delete params[ParamsField.TYPE]
            return params
        catch e
            @emit('error', e)

    clearSelectedTextFormatting: ->
        ###
        Очищает текстовое форматирование выбранного участка
        ###
        try
            range = @getRange()
            return if not range or range.collapsed
            [element, prevOffset] = @_getStartElementAndOffset(range)
            [endElement, endOffset] = @_getEndElementAndOffset(range)
            ops = @_processSelection(prevOffset, endOffset, endElement, SelectionAction.CLEARTEXTPARAMS)
            @_submitOps(ops) if ops?.length
        catch e
            @emit('error', e)

    selectAll: ->
        ###
        Выделяет все содержимое редактора
        range.selectNodeContents(@_container)
        ###
        range = document.createRange()
        range.selectNodeContents(@_container)
        DomUtils.setRange(range)

    setCursorToStart: ->
        ###
        Устанавливает курсор в начало редактора
        ###
        range = document.createRange()
        range.setStart(@_container, 0)
        range.setEnd(@_container, 0)
        DomUtils.setRange(range)

    _processLinkPopup: =>
        @_linkPopupTimer = null
        range = @getRange()
        linkPopup = LinkPopup.get()
        return linkPopup.hide() if not range
        [startElement, offset] = @_getStartElementAndOffset(range)
        url = @_renderer.getElementParams(startElement)?[TextLevelParams.URL]
        return linkPopup.hide() unless url?
        offset -= @_getOffsetBefore(startElement)
        if offset is 0
            prevElement = @_renderer.getPreviousElement(startElement)
            if not prevElement or url isnt @_renderer.getElementParams(prevElement)[TextLevelParams.URL]
                return linkPopup.hide()
        if offset is @_renderer.getElementLength(startElement)
            nextElement = @_renderer.getNextElement(startElement)
            if not nextElement or url isnt @_renderer.getElementParams(nextElement)[TextLevelParams.URL]
                return linkPopup.hide()
        if linkPopup.getContainer().parentNode isnt @_container.parentNode
            DomUtils.insertNextTo(linkPopup.getContainer(), @_container)
        openLinkEditor = =>
            LinkEditor.get().open(@)
        relativeNode = document.createElement 'span'
        range.insertNode(relativeNode)
        linkPopup.show(url, relativeNode, openLinkEditor,  @_alwaysShowPopupAtBottom)
        relativeParent = relativeNode.parentNode
        relativeParent.removeChild(relativeNode)
        relativeParent.normalize()

    _processCursor: ->
        if @_linkPopupTimer?
            clearTimeout(@_linkPopupTimer)
        @_linkPopupTimer = setTimeout(@_processLinkPopup, LINK_POPUP_TIMEOUT)

    setCursor: ->
        @_cursor = true
        @_processCursor()

    updateCursor: ->
        @_processCursor()

    clearCursor: ->
        @_cursor = false
        LinkPopup.get().hide()

    setCursorToEnd: ->
        ###
        Устанавливает курсор в конец редактора
        ###
        range = document.createRange()
        range.setStartAfter(@_container.lastChild)
        range.setEndAfter(@_container.lastChild)
        DomUtils.setRange(range)

    hasCollapsedCursor: ->
        ###
        Возвращает true, если в редакторе содержится курсор без выделения
        @return: boolean
        ###
        range = @getRange()
        return false if not range
        return range.collapsed

    isLastElementNotShiftedBlip: ->
        element = @_renderer.getPreviousElement(null)
        return no if @_renderer.getElementType(element) isnt ModelType.BLIP
        parNode = @_renderer.getParagraphNode(element)
        return yes unless @_renderer.getElementParams(parNode)[LineLevelParams.BULLETED]?
        no

    destroy: ->
        @_unregisterDomEventHandling()
        @_renderer.destroy()

MicroEvent.mixin Editor
exports.Editor = Editor