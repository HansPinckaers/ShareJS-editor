BrowserEvents = require('./utils/browser_events')
ModelField = require('./model').ModelField
ParamsField = require('./model').ParamsField
ModelType = require('./model').ModelType
TextLevelParams = require('./model').TextLevelParams
LineLevelParams = require('./model').LineLevelParams
DomUtils = require('./utils/dom')
Attachment = require('./attachment').Attachment

BULLETED_LIST_LEVEL_PADDING = 15 # Дополнительные отступы для уровней bulleted list

DATA_KEY = '__rizzoma_data_key'

#
# The renderer is used to make HTML in put it in the editor for editing
# It can apply and handle Ops 
#

class Renderer
    constructor: (args...) ->
        @_init(args...)

    _init: (@_id, @_container, @_doc) ->
        # recipient nodes cache
        @_recipients = []
        # render first snapshot
        @renderContent @_doc.snapshot
        # register for remote op
        self = this
        @_doc.on 'remoteop', (ops) -> 
            console.log ops
            self.applyOps(ops, yes)

    _paramsEqual: (p1, p2) ->
        for i of p1
            return no unless p1[i] is p2[i]
        for i of p2
            return no unless p1[i] is p2[i]
        yes

    _data: (element, key, value) ->
        element[DATA_KEY] ?= {}
        if not key?
            return element[DATA_KEY]
        if typeof key is 'object'
            return element[DATA_KEY] = key
        if not value?
            return element[DATA_KEY][key]
        return element[DATA_KEY][key] = value

    _getDeepestLastNode: (node) ->
        ###
        Возвращает самого вложенного из последних наследников указнной ноды
        Возвращает саму ноду, если у нее нет наследников
        Не заходит внутрь нод, у которых contentEditable == false
        @param node: HTMLNode
        @return: HTMLNode
        ###
        return node if node.contentEditable is 'false' and node isnt @_container
        return node if not node.lastChild
        return @_getDeepestLastNode(node.lastChild)

    renderContent: (content) ->
        ###
        Отрисовка содержимого редактора по снимку его содержимого
        @param _container: HTMLElement - элемент редактора, в который будет вставляться содержимое
        @param content: [Object] - снимок содержимого
        ###
        $container = $(@_container)
        $container.empty()
        $curPar = null
        for element, index in content
            $node = $(@_renderElement(element, index))
            if element[ModelField.PARAMS][ParamsField.TYPE] is ModelType.LINE
                $curPar = $node
                $container.append($node)
            else
                $curPar.children().last().before($node)

    preventEventsPropagation: (node) ->
        $(node).bind "#{BrowserEvents.KEY_EVENTS.join(' ')} #{BrowserEvents.DRAGDROP_EVENTS.join(' ')} #{BrowserEvents.CLIPBOARD_EVENTS.join(' ')} #{BrowserEvents.INPUT_EVENTS.join(' ')}", (e) ->
            e.stopPropagation()

    _renderElement: (element, index) ->
        switch element[ModelField.PARAMS][ParamsField.TYPE]
            when ModelType.TEXT
                return @_createTextElement(element[ModelField.TEXT], element[ModelField.PARAMS])
            when ModelType.LINE
                return @_createLineElement(element[ModelField.PARAMS])
            else
                return @_createInlineElement(element[ModelField.PARAMS])

    _setParamsToElement: (node, params) ->
        data = @_data(node)
        data[ModelField.PARAMS] = params
        @_data(node, data)

    _setRangeProps: (startContainer, startOffset, endContainer, endOffset) ->
        try
            DomUtils.setFullRange(startContainer, startOffset, endContainer, endOffset)
        catch e
            console.warn 'Failed to set range', e, e.stack

    _getRangeProps: (range) ->
        [range.startContainer, range.startOffset, range.endContainer, range.endOffset]

    _createTextElement: (text, params) ->
        ###
        Создает тексторый элемент и назначает ему параметры
        @param text: string - текст элемента
        @param params: Object - параметры объекта
        @returns: HTMLNode
        ###
        if params[TextLevelParams.URL]
            res = document.createElement('a')
            res.href = params[TextLevelParams.URL]
        else
            res = document.createElement('span')
        $(res).css('font-weight', 'bold') if params[TextLevelParams.BOLD]
        $(res).css('font-style', 'italic') if params[TextLevelParams.ITALIC]
        decs = []
        decs.push('underline') if params[TextLevelParams.UNDERLINED] or params[TextLevelParams.URL]
        decs.push('line-through') if params[TextLevelParams.STRUCKTHROUGH]
        $(res).css('text-decoration', decs.join(' ')) if decs.length
        textNode = document.createTextNode(text)
        res.appendChild(textNode)
        @_setParamsToElement(res, params)
        res

    _createLineElement: (params) ->
        ###
        Создает элемент типа Line и назначает ему параметры
        @param params: Object - параметры элемента
        @returns: HTMLNode
        ###
        res = document.createElement 'p'
        res.appendChild document.createElement 'br'
        if params[LineLevelParams.BULLETED]?
            $(res).addClass('bulleted')
            bulletedType = params[LineLevelParams.BULLETED] % 5
            $(res).addClass("bulleted-type#{bulletedType}")
            margin = params[LineLevelParams.BULLETED] * BULLETED_LIST_LEVEL_PADDING
            $(res).css('margin-left', margin)
        @_setParamsToElement(res, params)
        res

    _createInlineElement: (params) ->
        ###
        Создает инлайн элемент и назначает ему параметры
        @param params: Object - параметры элемента
        @returns: HTMLNode
        ###
        switch params[ParamsField.TYPE]
            when ModelType.BLIP
                res = @_addInline(ModelType.BLIP, {id: params[ParamsField.ID]})
            when ModelType.ATTACHMENT
                url = params[ParamsField.URL]
                attachment = new Attachment(@_id, url)
                res = attachment.getContainer()
                @preventEventsPropagation(res)
            when ModelType.RECIPIENT
                recipient = @_getRecipient(params[ParamsField.ID])
                res = recipient.getContainer()
                $(res).data('recipient', recipient)
                @_recipients.push(res)
                @preventEventsPropagation(res)
            else
                res = document.createElement('span')
                res.contentEditable = false
        @_setParamsToElement(res, params)
        res

    _setCursorAfter: (element) ->
        ###
        Устанавливает курсор после текущего элемента или в конец текущего элемента, если текущий элемент - текстовый
        @param node: HTMLElement
        ###
        [container, offset] = @_getContainerOffsetAfter(element)
        @_setRangeProps(container, offset, container, offset)

    _getContainerOffsetAfter: (element) ->
        switch @getElementType(element)
            when ModelType.TEXT
                return [element.firstChild, element.firstChild.length]
            when ModelType.LINE
                nextElement = @getNextElement(element)
                if not nextElement or (type = @getElementType(nextElement)) is ModelType.LINE
                    return [element, 0]
                if type is ModelType.TEXT
                    return [nextElement.firstChild, 0]
                else
                    return [nextElement.parentNode, DomUtils.getParentOffset(nextElement)]
            else
                nextElement = @getNextElement(element)
                if not nextElement or @getElementType(nextElement) isnt ModelType.TEXT
                    return [element.parentNode, DomUtils.getParentOffset(element) + 1]
                else
                    return [nextElement.firstChild, 0]

    _getElementAndOffset: (index, node = @_container) ->
        curNode = node = @getNextElement(node)
        offset = @getElementLength(curNode)
        while curNode
            if offset >= index
                return [node, offset]
            curNode = @getNextElement(curNode)
            if curNode
                offset += @getElementLength(curNode)
                node = curNode
        [node, offset]

    getParagraphNode: (node) ->
        while node isnt @_container and @getElementType(node) isnt ModelType.LINE
            node = node.parentNode
        node

    _splitTextElement: (element, index) ->
        ###
        Разбиваем текстовый элемент на два элемента по указанному индексу, если индекс указывает не на края элемента
        @param element: HTMLElement - разбиваемый элемент
        @param index: int - индекс, по которому произойдет разбиение
        @returns: [HTMLElement, HTMLElement]
        ###
        elLength = element.firstChild.length
        return [element, null] if elLength is index
        return [null, element] if index is 0
        newElement = @_createTextElement(element.firstChild.data.substr(index), @getElementParams(element))
        if range = DomUtils.getRange()
            [startContainer, startOffset, endContainer, endOffset] = @_getRangeProps(range)
        DomUtils.insertNextTo(newElement, element)
        if range
            elementOffset = DomUtils.getParentOffset(element)
            getContainerAndOffset = (container, offset) ->
                if container is element.firstChild
                    if index < offset
                        return [newElement.firstChild, offset - index]
                    else
                        return [container, offset]
                return [container, offset] if container isnt element.parentNode
                return [container, offset + 1] if elementOffset > offset
                [container, offset]
            [startContainer, startOffset] = getContainerAndOffset(startContainer, startOffset)
            [endContainer, endOffset] = getContainerAndOffset(endContainer, endOffset)
        element.firstChild.deleteData(index, elLength - index)
        @_setRangeProps(startContainer, startOffset, endContainer, endOffset) if range
        [element, newElement]

    _insertText: (text, params, element, offset, shiftCursor) ->
        elementParams = @getElementParams(element)
        if @_paramsEqual(params, elementParams)
            textNode = element.firstChild
            if not shiftCursor
                if range = DomUtils.getRange()
                    getOffset = (container, index, isStart) ->
                        return index if container isnt textNode
                        if isStart
                            return index if index < offset
                        else
                            return index if index <= offset
                        index + text.length
                    startContainer = range.startContainer
                    startOffset = getOffset(startContainer, range.startOffset, yes)
                    endContainer = range.endContainer
                    endOffset = getOffset(endContainer, range.endOffset, no)
            textNode.insertData(offset, text)
            if shiftCursor
                DomUtils.setCursor([textNode, offset+text.length])
            else if range
                @_setRangeProps(startContainer, startOffset, endContainer, endOffset)
        else
            newElement = @_createTextElement(text, params)
            [leftElement, rightElement] = @_splitTextElement(element, offset)
            if not shiftCursor
                if range = DomUtils.getRange()
                    rightNode = if leftElement then leftElement.nextSibling else rightElement
                    parNode = @getParagraphNode(rightNode)
                    getOffset = (container, index) ->
                        return index if container isnt parNode
                        offsetNode = parNode.childNodes[index]
                        return index + 1 unless offsetNode
                        while rightNode
                            return index + 1 if rightNode is offsetNode
                            rightNode = rightNode.nextSibling
                        index
                    startContainer = range.startContainer
                    startOffset = getOffset(startContainer, range.startOffset)
                    endContainer = range.endContainer
                    endOffset = getOffset(endContainer, range.endOffset)
            if leftElement
                DomUtils.insertNextTo(newElement, leftElement)
            else
                rightElement.parentNode.insertBefore(newElement, rightElement)
            if shiftCursor
                @_setCursorAfter(newElement)
            else if range
                @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleTiOp: (op, shiftCursor) ->
        index = op.p
        text = op.ti
        params = op.params
        [element, offset] = @_getElementAndOffset(index)
        type = @getElementType(element)
        switch type
            when ModelType.TEXT
                offsetBefore = offset - @getElementLength(element)
                realOffset = index - offsetBefore
                @_insertText(text, params, element, realOffset, shiftCursor)
            else
                nextElement = @getNextElement(element)
                nextElementType = @getElementType(nextElement)
                if nextElementType is ModelType.TEXT
                    @_insertText(text, params, nextElement, 0, shiftCursor)
                else
                    newElement = @_createTextElement(text, params)
                    if not shiftCursor
                        if range = DomUtils.getRange()
                            [startContainer, startOffset, endContainer, endOffset] = @_getRangeProps(range)
                    if type is ModelType.LINE
                        if not shiftCursor and range
                            startOffset++ if startContainer is element
                            endOffset++ if endContainer is element and endOffset
                        element.insertBefore(newElement, element.firstChild)
                    else
                        if not shiftCursor and range
                            elementOffset = DomUtils.getParentOffset(element) + 1
                            startOffset++ if startContainer is element.parentNode and startOffset > elementOffset
                            endOffset++ if endContainer is element.parentNode and endOffset > elementOffset
                        DomUtils.insertNextTo(newElement, element)
                    if shiftCursor
                        @_setCursorAfter(newElement)
                    else if range
                        @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleLineInsertOp: (params, node, offset, shiftCursor) ->
        newNode = @_createLineElement(params)
        if not offset
            @_container.insertBefore(newNode, @_container.firstChild)
            return
        type = @getElementType(node)
        parNode = @getParagraphNode(node)
        DomUtils.insertNextTo(newNode, parNode)
        switch type
            when ModelType.TEXT
                [node, startNode] = @_splitTextElement(node, offset)
                startNode = node.nextSibling unless startNode
            when ModelType.LINE
                startNode = node.firstChild
            when ModelType.BLIP, ModelType.ATTACHMENT, ModelType.RECIPIENT
                startNode = node.nextSibling
        nodes = DomUtils.getNodeAndNextSiblings(startNode)
        nodes.pop()
        if not shiftCursor and nodes.length
            if range = DomUtils.getRange()
                getNodeAndOffset = (container, offset) ->
                    return [container, offset] if container isnt parNode
                    offsetNode = parNode.childNodes[offset]
                    return [parNode, offset] if not offsetNode
                    return [newNode, nodes.length] if offsetNode is parNode.lastChild
                    nodeIndex = nodes.indexOf(offsetNode)
                    return [parNode, offset] if nodeIndex < 1
                    [newNode, nodeIndex]
                [startContainer, startOffset] = getNodeAndOffset(range.startContainer, range.startOffset)
                [endContainer, endOffset] = getNodeAndOffset(range.endContainer, range.endOffset)
        DomUtils.moveNodesToStart(newNode, nodes)
        if shiftCursor
            DomUtils.setCursor([newNode, 0])
        else if range
            @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleLineDeleteOp: (element, shiftCursor) ->
        nextElement = @getNextElement(element)
        nodes = DomUtils.getNodeAndNextSiblings(nextElement.firstChild)
        nodes.pop()
        parNode = @getParagraphNode(element)
        if not shiftCursor
            if range = DomUtils.getRange()
                getNodeAndOffset = (container, offset) ->
                    return [container, offset] if container isnt nextElement
                    parNodeLength = parNode.childNodes.length
                    offsetNode = nextElement.childNodes[offset]
                    return [parNode, nodes.length + parNodeLength - 1] if not nodes.length or not offsetNode or offsetNode is nextElement.lastChild
                    nodeIndex = nodes.indexOf(offsetNode)
                    [parNode, nodeIndex + parNodeLength - 1]
                [startContainer, startOffset] = getNodeAndOffset(range.startContainer, range.startOffset)
                [endContainer, endOffset] = getNodeAndOffset(range.endContainer, range.endOffset)
        DomUtils.moveNodesBefore(nodes, parNode.lastChild)
        $(nextElement).remove()
        if shiftCursor
            @_setCursorAfter(element)
        else if range
            @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleInlineInsertOp: (params, node, offset, shiftCursor) ->
        type = @getElementType(node)
        newElement = @_createInlineElement(params)
        parNode = @getParagraphNode(node)
        getContainerAndOffset = (container, index) ->
            return [container, index] if container isnt parNode
            newElementIndex = DomUtils.getParentOffset(newElement)
            return [container, index] if index <= newElementIndex
            [container, index + 1]
        switch type
            when ModelType.TEXT
                [node, startNode] = @_splitTextElement(node, offset)
                if node
                    insert = DomUtils.insertNextTo
                else
                    node = startNode
                    insert = parNode.insertBefore
                until node.parentNode is parNode
                    node = node.parentNode
                if not shiftCursor and (range = DomUtils.getRange())
                    [startContainer, startOffset, endContainer, endOffset] = @_getRangeProps(range)
                insert(newElement, node)
            else
                if not shiftCursor and (range = DomUtils.getRange())
                    [startContainer, startOffset, endContainer, endOffset] = @_getRangeProps(range)
                if type is ModelType.LINE
                    parNode.insertBefore(newElement, parNode.firstChild)
                else
                    DomUtils.insertNextTo(newElement, node)
        if(params[ParamsField.TYPE] is ModelType.ATTACHMENT)
            $(@_container).find('a[rel="' + @_id + '"]').lightBox()
        if shiftCursor
            @_setCursorAfter(newElement)
        else if range
            [startContainer, startOffset] = getContainerAndOffset(startContainer, startOffset)
            [endContainer, endOffset] = getContainerAndOffset(endContainer, endOffset)
            @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleInlineDeleteOp: (element, shiftCursor) ->
        nextElement = @getNextElement(element)
        type = @getElementType(nextElement)
        if type is ModelType.RECIPIENT and (index = @_recipients.indexOf(nextElement)) isnt -1
            $(@_recipients[index]).data('recipient')?.destroy()
            @_recipients = @_recipients[...index].concat(@_recipients[index + 1..])
        if not shiftCursor and (range = DomUtils.getRange())
            getContainerAndOffset = (container, index) ->
                return [container, index] if container isnt nextElement.parentNode
                nextElementIndex = DomUtils.getParentOffset(nextElement)
                return [container, index - 1] if index > nextElementIndex
                [container, index]
            [startContainer, startOffset, endContainer, endOffset] = @_getRangeProps(range)
            [startContainer, startOffset] = getContainerAndOffset(startContainer, startOffset)
            [endContainer, endOffset] = getContainerAndOffset(endContainer, endOffset)
        $(nextElement).remove()
        if(type is ModelType.ATTACHMENT)
            $(@_container).find('a[rel="' + @_id + '"]').lightBox()
        if shiftCursor
            @_setCursorAfter(element)
        else if range
            @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleOiOp: (op, shiftCursor) ->
        index = op.p
        params = op.params
        [node, offset] = @_getElementAndOffset(index)
        realOffset = index - offset + @getElementLength(node)
        switch params[ParamsField.TYPE]
            when ModelType.LINE
                @_handleLineInsertOp(params, node, realOffset, shiftCursor)
            else
                @_handleInlineInsertOp(params, node, realOffset, shiftCursor)

    _handleTdOp: (op, shiftCursor) ->
        index = op.p
        textLength = op.td.length
        throw new Error('trying to delete 0 element') if not index
        [element, offset] = @_getElementAndOffset(index)
        if @getElementType(element) isnt ModelType.TEXT or offset - index is 0
            [element, offset] = @_getElementAndOffset(index + 1)
        [_, startElement] = @_splitTextElement(element, index - offset + @getElementLength(element))
        endIndex = index + textLength
        [element, offset] = @_getElementAndOffset(endIndex)
        [endElement, _] = @_splitTextElement(element, endIndex - offset + @getElementLength(element))
        endElement = @getNextElement(endElement)
        cursorElement = @getPreviousElement(startElement)
        if not shiftCursor
            if range = DomUtils.getRange()
                [startContainer, startOffset, endContainer, endOffset] = @_getRangeProps(range)
        while startElement isnt endElement
            nextNode = @getNextElement(startElement)
            if @getElementType(startElement) isnt ModelType.TEXT
                throw new Error('trying to delete non-text element in text operation')
            $(startElement).remove()
            if not shiftCursor
                if startContainer is startElement or startContainer is startElement.firstChild
                    [startContainer, startOffset] = @_getContainerOffsetAfter(cursorElement)
                if endContainer is startElement or endContainer is startElement.firstChild
                    [endContainer, endOffset] = @_getContainerOffsetAfter(cursorElement)
            startElement = nextNode
        if shiftCursor
            @_setCursorAfter(cursorElement)
        else if range
            @_setRangeProps(startContainer, startOffset, endContainer, endOffset)

    _handleOdOp: (op, shiftCursor) ->
        index = op.p
        throw new Error('trying to delete 0 element') if not index
        params = op.params
        [element, offset] = @_getElementAndOffset(index)
        switch params[ParamsField.TYPE]
            when ModelType.LINE
                @_handleLineDeleteOp(element, shiftCursor)
            else
                @_handleInlineDeleteOp(element, shiftCursor)

    _getParamValue: (params) ->
        for param, value of params
            return [param, value]

    _handleParamsOp: (op, shiftCursor, insert) ->
        index = op.p
        length = op.len
        params = if insert then op.paramsi else op.paramsd
        [element, offset] = @_getElementAndOffset(index)
        if @getElementType(element) isnt ModelType.TEXT or offset - index is 0
            [element, offset] = @_getElementAndOffset(index+1)
        type = @getElementType(element)
        [param, value] = @_getParamValue(params)
        switch type
            when ModelType.TEXT
                throw "unexpected text param: #{param}" unless TextLevelParams.isValid(param)
                elLength = @getElementLength(element)
                realOffset = index - offset + elLength
                [_, startElement] = @_splitTextElement(element, realOffset)
                endIndex = index + length
                [element, offset] = @_getElementAndOffset(endIndex)
                [endElement, _] = @_splitTextElement(element, endIndex - offset + @getElementLength(element))
                while true
                    type = @getElementType(startElement)
                    throw "text param could not be applied to #{type} type" unless type is ModelType.TEXT
                    if range = DomUtils.getRange()
                        startContainer = range.startContainer
                        startOffset = range.startOffset
                        endContainer = range.endContainer
                        endOffset = range.endOffset
                    params = @getElementParams(startElement)
                    if insert
                        params[param] = value
                    else
                        delete params[param]
                    newElement = @_createTextElement(startElement.firstChild.data, params)
                    DomUtils.insertNextTo(newElement, startElement)
                    $(startElement).remove()
                    if range
                        if endContainer is startElement.firstChild
                            range.setEnd(newElement.firstChild, endOffset)
                        else if endContainer is startElement
                            range.setEnd(newElement, endOffset)
                        else
                            range.setEnd(endContainer, endOffset)
                        if startContainer is startElement.firstChild
                            range.setStart(newElement.firstChild, startOffset)
                        else if startContainer is startElement
                            range.setStart(newElement, startOffset)
                        DomUtils.setRange(range)
                    break if startElement is endElement
                    startElement = @getNextElement(newElement)
            when ModelType.LINE
                throw "unexpected text param: #{param}" unless LineLevelParams.isValid(param)
                if range = DomUtils.getRange()
                    startContainer = range.startContainer
                    startOffset = range.startOffset
                    endContainer = range.endContainer
                    endOffset = range.endOffset
                params = @getElementParams(element)
                if insert
                    params[param] = value
                else
                    delete params[param]
                newElement = @_createLineElement(params)
                nodes = DomUtils.getNodeAndNextSiblings(element.firstChild)
                nodes.pop()
                DomUtils.moveNodesToStart(newElement, nodes)
                DomUtils.insertNextTo(newElement, element)
                $(element).remove()
                if range
                    if endContainer is element
                        range.setEnd(newElement, endOffset)
                    else
                        range.setEnd(endContainer, endOffset)
                    if startContainer is element
                        range.setStart(newElement, startOffset)
                    else
                        range.setStart(startContainer, startOffset)
                    DomUtils.setRange(range)
            else
                throw 'not implemented yet'

    getNextElement: (node = @_container) ->
        type = @getElementType(node)
        if not type or type is ModelType.LINE
            child = node.firstChild
            while child
                return child if @getElementType(child)?
                firstNode = @getNextElement(child)
                return firstNode if firstNode
                child = child.nextSibling
        until node is @_container
            nextNode = node.nextSibling
            while nextNode
                return nextNode if @getElementType(nextNode)?
                nextNode = nextNode.nextSibling
            node = node.parentNode
        null

    getPreviousElement: (node = @_container) ->
        type = @getElementType(node)
        if type is ModelType.LINE
            prevChild = node.previousSibling?.lastChild
            if prevChild
                prevElement = @getPreviousElement(prevChild)
                return prevElement if prevElement
        if not type
            if child = @_getDeepestLastNode(node)
                unless child is node
                    prevElement = @getPreviousElement(child)
                    return prevElement if prevElement
        until node is @_container
            prevNode = node.previousSibling
            while prevNode
                return prevNode if @getElementType(prevNode)?
                prevNode = prevNode.previousSibling
            node = node.parentNode
            return node if @getElementType(node)?
        null

    getElementType: (element) ->
        ###
        Возвращает тип указанного элемента
        @param element: HTMLElement - элемент, тип которого требуется получить
        @returns: null, если элемент не имеет типа, иначе string - одно из значений параметров класса ModelType
        ###
        return null unless element
        @_data(element, ModelField.PARAMS)?[ParamsField.TYPE] || null

    getElementParams: (element) ->
        ###
        Возвращает копию параметров указанного элемента
        @param element: HTMLElement - элемент, параметры которого требуется получить
        @returns: Object - параметры данного элемента
        ###
        return null unless element
        res = {}
        $.extend res, @_data(element, ModelField.PARAMS)
        res

    getElementLength: (element) ->
        ###
        Возвращает длину элемента - смещение, которое задает элемент в снимке содержимого редактора
        @param: element - HTMLElement - элемент, длину которого требуется получить
        @returns: int - длина элемента
        ###
        type = @getElementType(element)
        return 0 unless type?
        return 1 unless type is ModelType.TEXT
        element.firstChild.data.length

    insertNodeAt: (node, index) ->
        ###
        Вставляет указанную ноду по индексу в снимке содержимого, не проверяя параметры и не устанавливая параметры
        Нода будет вставлена после ноды, на которую попадает индекс
        @param node: HTMLNode - нода для вставки
        @param index: int - индекс, по котороуму следует вставить ноду
        ###
        [element, offset] = @_getElementAndOffset(index)
        elType = @getElementType(element)
        switch elType
            when ModelType.TEXT
                parNode = @getParagraphNode(element)
                [navElement, right] = @_splitTextElement(element, index - offset + @getElementLength(element))
                if navElement
                    insert = DomUtils.insertNextTo
                else
                    navElement = right
                    insert = parNode.insertBefore
                insert(node, navElement)
            when ModelType.LINE
                element.insertBefore(node, element.firstChild)
            else
                DomUtils.insertNextTo(node, element)

    getRecipientNodes: -> @_recipients

    applyOps: (ops, shiftCursor=no) ->
        lastOp = ops.pop()
        @applyOp(op, no) for op in ops
        @applyOp(lastOp, shiftCursor)
        ops.push(lastOp)

    applyOp: (op, shiftCursor=no) ->
        return @_handleOiOp(op, shiftCursor) if op.ti? and op[ModelField.PARAMS][ParamsField.TYPE] isnt ModelType.TEXT
        return @_handleOdOp(op, shiftCursor) if op.td? and op[ModelField.PARAMS][ParamsField.TYPE] isnt ModelType.TEXT
        return @_handleTiOp(op, shiftCursor) if op.ti
        return @_handleTdOp(op, shiftCursor) if op.td
        return @_handleParamsOp(op, shiftCursor, yes) if op.paramsi
        return @_handleParamsOp(op, shiftCursor, no) if op.paramsd
        return console.error('not implemented') if op.oparamsi
        return console.error('not implemented') if op.oparamsd

    destroy: ->
        for recipientNode in @_recipients
            $(recipientNode).data('recipient')?.destroy()

exports.Renderer = Renderer


# sharejs.open 'hello', 'ftext', (error, doc) =>
    # renderer = new Renderer doc.name, $("#editable")[0], doc
