###
Вспомогательные функции для работы с DOM
###

jQuery.fn.center = ->
    @css("position","absolute");
    @css("top", (($(window).height() - this.outerHeight()) / 2) + $(window).scrollTop() + "px")
    @css("left", (($(window).width() - this.outerWidth()) / 2) + $(window).scrollLeft() + "px")
    @

# Список поддерживаемых блочных тегов
blockTags = module.exports.blockTags =
    div: null
    p: null
    h1: null
    h2: null
    h3: null
    h4: null
    table: null

# Список поддерживаемых inline-тегов
inlineTags = module.exports.inlineTags = {a: null}

BLOCK_TAG = module.exports.BLOCK_TAG = 'div'
NEW_LINE_TAG = module.exports.NEW_LINE_TAG = 'br'
TEXT_NODE = module.exports.TEXT_NODE = '#text'
TEXT_STATE = module.exports.TEXT_STATE = 'text'
CHILD_STATES = module.exports.CHILD_STATES = 'childStates'
ANCHOR_TAG = exports.ANCHOR_TAG = 'a'
ANCHOR_ATTRIBUTES = exports.ANCHOR_ATTRIBUTES =
    'href': null
    'target': null

isTextNode = module.exports.isTextNode = (node) ->
    ###
    Возвращает true, если указанный узел является текстовой
    @param node: HTMLNode
    @return: boolean
    ###
    node.nodeName.toLowerCase() is TEXT_NODE

isBlockNode = module.exports.isBlockNode = (node) ->
    ###
    Возвращает true, если указанный узел является блочным
    @param node: HTMLNode
    @return: boolean
    ###
    node.nodeName.toLowerCase() of blockTags

isDefaultBlockNode = module.exports.isDefaultBlockNode = (node) ->
    ###
    Возвращает true, если указанный узел является блочным "по умолчанию" (div)
    @param node: HTMLNode
    @return: boolean
    ###
    node.tagName?.toLowerCase() is BLOCK_TAG

isNewLine = module.exports.isNewLine = (node) ->
    ###
    Возвращает true, если указанный узел является переносом строки
    @param node: HTMLNode
    @return: boolean
    ###
    node.nodeName.toLowerCase() is NEW_LINE_TAG

isInlineNode = module.exports.isInlineNode = (node) ->
    ###
    Возвращает true, если указанный узел является inline
    @param node: HTMLNode
    @return: boolean
    ###
    node.nodeName.toLowerCase() of inlineTags

isAnchorNode = exports.isAnchorNode = (node) ->
    ###
    Возвращает true, если указанный узел является anchor
    @param node: HTMLNode
    @return: boolean
    ###
    node.nodeName?.toLowerCase() is ANCHOR_TAG

nodeIs = module.exports.nodeIs = (node, name) ->
    ###
    Возвращает true, если указанный узел является name
    @param node: HTMLNode
    @param name: string, имя ноды в маленьком регистре
    ###
    node.nodeName.toLowerCase() is name

insertNextTo = module.exports.insertNextTo = (node, nextTo) ->
    ###
    Вставляет узел после указанного
    Возвращает вставленный узел
    @param node: HTMLNode
    @param nextTo: HTMLNode
    @return: HTMLNode
    ###
    parentNode = nextTo.parentNode
    siblingNode = nextTo?.nextSibling
    if siblingNode
        parentNode.insertBefore(node, siblingNode)
    else
        parentNode.appendChild(node)
    return node

insertInlineNodeByRange = module.exports.insertInlineNode = (range, inlineNode, topNode) ->
    return if not range
    container = range.endContainer
    return if not container
    if not isTextNode(container)
        # Курсор не указывает на текст, вставим элемент в конец 
        container ||= topNode
        container.removeChild container.lastChild if container.lastChild? and isNewLine(container.lastChild)
        container.appendChild inlineNode
    else
        # Курсор указывает на текст, будем отталкиваться от его родительской ноды
        curNode = range.startContainer
        parentNode = curNode.parentNode
        if range.startOffset is 0    
            if isBlockNode parentNode
                # Текст в параграфе
                parentNode.insertBefore inlineNode, curNode
            else
                # Текст в контейнере, надо вставить перед контейнером
                parentNode.parentNode.insertBefore inlineNode, parentNode
            return
        if range.startOffset is curNode.textContent.length
            if isBlockNode parentNode
                # Текст в параграфе
                insertNextTo inlineNode, curNode
            else
                # Текст в контейнере, надо вставить после контейнера
                insertNextTo inlineNode, parentNode
            return
        container.splitText range.endOffset
        rightNode = curNode.nextSibling
        unless isBlockNode parentNode
            # Разбили родительскую ноду, которая не является параграфом (например, ссылку)
            clonedNode = parentNode.cloneNode no
            while rightNode
                nextNode = rightNode.nextSibling
                clonedNode.appendChild rightNode
                rightNode = nextNode
            insertNextTo clonedNode, parentNode
            clonedNode.parentNode.insertBefore inlineNode, clonedNode
        else
            # Курсор указывает на текст в параграфе
            insertNextTo inlineNode, curNode

wrapInBlockNode = module.exports.wrapInBlockNode = (nodes) ->
    ###
    Оборачивает указанную ноду или массив нод в блочный контейнер
    @param nodes: [HTMLNode]
    @param nodes: HTMLNode
    @return: HTMLNode
    ###
    nodes = [nodes] unless nodes instanceof Array
    container = document.createElement BLOCK_TAG
    for node in nodes
        container.appendChild node
    return container

moveNodesNextTo = module.exports.moveNodesNextTo = (nodes, nextTo) ->
    ###
    Переносит указанные узлы вслед за nextTo
    @param nodes: HTMLNode
    @param nodes: [HTMLNode]
    @param nextTo: HTMLNode
    ###
    nodes = [nodes] unless nodes instanceof Array
    for node in nodes
        insertNextTo(node, nextTo)
        nextTo = node

moveChildNodesToEnd = module.exports.moveChildNodesToEnd = (toNode, fromNode) ->
    ###
    Переносит узлы из одной вершины в конец другой
    @param toNode: HTMLNode, узел-приемник
    @param fromNode: [HTMLNode], узел-источник
    ###
    childNode = fromNode.firstChild
    while childNode
        nextChild = childNode.nextSibling
        toNode.appendChild childNode
        childNode = nextChild

moveNodesToEnd = module.exports.moveNodesToEnd = (toNode, nodes) ->
    ###
    Переносит указанные узлы в конец указанной вершины
    @param toNode: HTMLNode, узел-приемник
    @param nodes: [HTMLNode], переносимые узлы
    ###
    for node in nodes
        toNode.appendChild(node)

moveNodesToStart = module.exports.moveNodesToStart = (toNode, nodes) ->
    ###
    Переносит указанные узлы в начало указанной вершины
    @param toNode: HTMLNode, узел-приемни
    @param nodes: [HTMLNode], переносимые узлы
    ###
    firstChild = toNode.firstChild
    if not firstChild
        moveNodesToEnd(toNode, nodes)
        return
    for node in nodes
        toNode.insertBefore(node, firstChild)

moveChildNodesNextTo = module.exports.moveChildNodesNextTo = (nextToNode, fromNode) ->
    ###
    Вставляет узлы из одной вершины после другой
    @param nextToNode: HTMLNode, узел, после которого вставлять
    @param fromNode: HTMLNode, узел, детей которого переносить
    ###
    while fromNode.firstChild
        curNode = fromNode.firstChild
        insertNextTo fromNode.firstChild, nextToNode
        nextToNode = curNode

moveNodesBefore = module.exports.moveNodesBefore = (nodes, beforeNode) ->
    for node in nodes
        beforeNode.parentNode.insertBefore(node, beforeNode)

replaceContainer = module.exports.replaceContainer = (oldNode, newNode) ->
    ###
    Заменяет узел на другой, сохраняя все дочерние узлы
    @param oldNode: HTMLNode
    @param newNode: HTMLNode
    ###
    moveChildNodesToEnd(newNode, oldNode)
    insertNextTo(newNode, oldNode)
    if oldNode.parentNode
        oldNode.parentNode.removeChild(oldNode)

getNonBlockNodes = module.exports.getNonBlockNodes = (startNode) ->
    ###
    Возвращает все неблочные ноды, начиная с указанной и заканчивая первой
    блочной нодой
    @param startNode: HTMLNode
    @return [HTMLNode]
    ###
    res = []
    curNode = startNode
    while curNode
        break if isBlockNode(curNode)
        res.push(curNode)
        curNode = curNode.nextSibling
    return res

getNodeAndNextSiblings = module.exports.getNodeAndNextSiblings = (node) ->
    ###
    Возвращает всех "правых" соседей ноды (nextSibling)
    @param node: HTMLNode
    @return [HTMLNode]
    ###
    res = []
    while node
      res.push(node)
      node = node.nextSibling
    return res

getNearestPreviousNode = module.exports.getNearestPreviousNode = (node, nodeToStop) ->
    ###
    Возвращает соседа слева. Если такового нет, возвращает соседа слева от родителя,
    и так далее вплоть до nodeToStop
    @param node: HTMLNode
    @param nodeToStop: HTMLNode
    @return: HTMLNode|null
    ###
    return null if node is nodeToStop
    return node.previousSibling if node.previousSibling
    getNearestPreviousNode node.parentNode, nodeToStop

getNearestNextNode = module.exports.getNearestNextNode = (node, nodeToStop) ->
    ###
    Возвращает соседа справа. Если такового нет, возвращает соседа справа от родителя,
    и так далее вплоть до nodeToStop
    @param node: HTMLNode
    @param nodeToStop: HTMLNode
    @return: HTMLNode|null
    ###
    return null if node is nodeToStop
    return node.nextSibling if node.nextSibling
    getNearestNextNode node.parentNode, nodeToStop

getCursorAtTheEndOf = module.exports.getCursorAtTheEndOf = (node) ->
    ###
    Возвращает положение курсора в конце указанной ноды
    @param node: HTMLNode
    @return: [HTMLNode, int]
    ###
    return [node, node.textContent.length] if isTextNode(node)
    return getDeepestCursorPos [node, node.childNodes.length]

getNodeIndex = exports.getNodeIndex = (node) ->
    parent = node.parentNode
    offset = 0
    for child in parent.childNodes
        break if child is node
        offset++
    offset

getCursorToTheLeftOf = module.exports.getCursorToTheLeftOf = (node) ->
    ###
    Возвращает положение курсора слева от указанной ноды (указанная нода
    в положении будет отстутсвовать)
    @param node: HTMLNode
    @return: [HTMLNode, int]
    ###
    prev = node.previousSibling
    return [node.parentNode, 0] if not prev
    return getCursorAtTheEndOf(prev) if prev.contentEditable isnt 'false'
    # Нельзя ставить курсор внутрь нередактируемой ноды
    parent = node.parentNode
    offset = 0
    for child in parent.childNodes
        break if child is node
        offset++
    return [parent, offset]

getDeepestFirstNode = module.exports.getDeepestFirstNode = (node) ->
    ###
    Возвращает самого вложенного из первых наследников указнной ноды
    Возвращает саму ноду, если у нее нет наследников
    Не заходит внутрь нод, у которых contentEditable == false
    ###
    return node if node.contentEditable is 'false'
    return node if not node.firstChild
    return getDeepestFirstNode node.firstChild

getDeepestLastNode = module.exports.getDeepestLastNode = (node) ->
    ###
    Возвращает самого вложенного из последних наследников указнной ноды
    Возвращает саму ноду, если у нее нет наследников
    Не заходит внутрь нод, у которых contentEditable == false
    @param node: HTMLNode
    @return: HTMLNode
    ###
    return node if node.contentEditable is 'false'
    return node if not node.lastChild
    return getDeepestLastNode node.lastChild

contains = module.exports.contains = (container, selectedNode) ->
    ###
    Возврващает true, если selectedNode содержится внутри container
    @param container: HTMLElement
    @param selectedNode: HTMLElement
    @return: boolean
    ###
    not not (container.compareDocumentPosition(selectedNode) & Node.DOCUMENT_POSITION_CONTAINED_BY)

getDeepestCursorPos = module.exports.getDeepestCursorPos = (cursor) ->
    ###
    Возвращает положение курсора, указывающее на самую вложенную ноду в переданном положении
    Не возвращает курсор, указывающий на нередактируемый элемент
    @param cursor: [HTMLNode, int]
    @return: [HTMLNode, int]
    ###
    [node, offset] = cursor
    return [node, offset] if isTextNode(node)
    if offset == node.childNodes.length
        # Указывает на конец
        node = getDeepestLastNode(node)
        if node.contentEditable is 'false'
            parent = node.parentNode
            return [parent, parent.childNodes.length]
        return [node, node.childNodes.length]
    node = getDeepestFirstNode(node.childNodes[offset])
    if node.contentEditable is 'false'
        parent = node.parentNode
        if parent is cursor[0]
            return [parent, offset]
        else
            return [parent, 0]
    return [node, 0]

cursorIsAtTheEndOfNode = module.exports.cursorIsAtTheEndOfNode = (cursor) ->
    ###
    Возвращает true, если курсор указывает на конец ноды
    @param cursor: [HTMLNode, int]
    @return: boolean
    ###
    if isTextNode cursor[0]   
        return false if not (cursor[1] is cursor[0].textContent.length)
    else
        return false if not (cursor[1] is cursor[0].childNodes.length)
    return true

cursorIsAtTheEndOfBlockNode = module.exports.cursorIsAtTheEndOfBlockNode = (cursor) ->
    ###
    Возвращает true, если курсор указывает на конец блочной ноды
    Вернет true, если курсор находится перед тегом br в конце параграфа 
    @param cursor: [HTMLNode, int]
    @return: boolean
    ###
    [node, offset] = cursor
    if isTextNode node
        return false if offset < node.length
    else
        return false if offset < node.childNodes.length - 1
        if node.childNodes[offset - 1]
            node = node.childNodes[offset - 1]
    while node and not isBlockNode node
        next = node.nextSibling
        node = next if next and isNewLine next
        return false if node.nextSibling
        node = node.parentNode
    return node isnt null

cursorIsAtTheStartOfNode = module.exports.cursorIsAtTheStartOfNode = (cursor) ->
    ###
    Возвращает true, если курсор указывает на начало ноды
    @param cursor: [HTMLNode, int]
    @return: boolean
    ###
    cursor[1] is 0

cursorIsAtTheStartOfBlockNode = module.exports.cursorIsAtTheStartOfBlockNode = (cursor) ->
    ###
    Возвращает true, если курсор указывает на начало блочной ноды
    @param cursor: [HTMLNode, int]
    @return: boolean
    ###
    [curNode, offset] = cursor
    return false if not cursorIsAtTheStartOfNode cursor
    while curNode and not isBlockNode curNode
        return false if curNode.previousSibling
        curNode = curNode.parentNode
    return curNode isnt null

getCursor = module.exports.getCursor = ->  
    ###
    Возвращает текущее положение курсора
    @return: [HTMLNode, int]|null
    ###
    range = getRange()
    return null if range is null
    return [range.startContainer, range.startOffset]

setCursor = module.exports.setCursor = (cursor) ->
    ###
    Устанавливает положение курсора
    @param cursor: [HTMLNode, int]
    ###
    range = document.createRange()
    range.setStart(cursor[0], cursor[1])
    range.setEnd(cursor[0], cursor[1])
    setRange(range)

changeCursorAfterDeletion = module.exports.changeCursorAfterDeletion = (node, cursor) ->
    ###
    Изменяет положение курсора таким образом, чтобы после удаления node для
    пользователя оно осталось таким же
    Если курсор указывает на удаляемую ноду, смещают его влево
    @param node: HTMLNode
    @param cursor: [HTMLNode, int]|null
    ###
    return if not cursor
    return if cursor[0] isnt node
    [cursor[0], cursor[1]] = getCursorToTheLeftOf(node)

getEmptyBlock = module.exports.getEmptyBlock = ->
    ###
    Возвращает пустой параграф
    Чтобы параграф был виден в редакторе, в конце вставлен <br>
    @return: HTMLNode
    ###
    block = document.createElement BLOCK_TAG
    block.appendChild document.createElement NEW_LINE_TAG
    return block

isEmptyBlock = module.exports.isEmptyBlock = (node) ->
    ###
    Возвращает true, если указанная нода является пустым параграфом
    @param node: HTMLNode
    @return: boolean
    ###
    return false if not isDefaultBlockNode(node)
    return false if node.childNodes.length isnt 1
    return isNewLine(node.childNodes[0])

setRange = module.exports.setRange = (range) ->
    ###
    Устанавливает выбранную часть элементов
    @param range: HTMLRange
    ###
    selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

getRange = module.exports.getRange = ->
    ###
    Возвращает текущую выбранную часть элементов
    Если ничего не выбрано, возвращает null
    @return HTMLRange|null
    ###
    selection = window.getSelection()
    if selection.rangeCount
        return selection.getRangeAt(0)
    else
        return null

getParentBlockNode = module.exports.getParentBlockNode = (node) ->
    ###
    Возвращает ближайшего блочного родителя
    @param node: HTMLNode
    @return: HTMLNode|null
    ###
    while node and not isBlockNode node
        node = node.parentNode
    return node

mergeParagraphs = module.exports.mergeParagraphs = (first, second, cursor) ->
    ###
    Переносит содержимое параграфа second в first, изменяет положение курсора
    @param first: HTMLNode
    @param second: HTMLNode
    @param cursor: [HTMLNode, int]
    ###
    [cursor[0], cursor[1]] = getDeepestCursorPos cursor
    if isNewLine(first.lastChild)
        changeCursorAfterDeletion first.lastChild, cursor
        first.removeChild first.lastChild
    moveChildNodesToEnd first, second
    second.parentNode.removeChild second

splitParagraph = module.exports.splitParagraph = (para, start) ->
    ###
    Разбивает параграф: создает новый, вставляет его сразу после para.
    Все ноды, начиная с node, переносит в созданный.
    Возвращает созданный параграф
    @param para: HTMLNode
    @param start: HTMLNode
    @return: HTMLNode
    ###
    leftNodes = getNodeAndNextSiblings(start)
    container = wrapInBlockNode(leftNodes)
    insertNextTo(container, para)
    return container

getDeepestNodeBeforeCursor = module.exports.getDeepestNodeBeforeCursor = (cursor) ->
    ###
    Возвращает самую вложенную ноду перед курсором
    Если курсор находится внутри текста в текстовой ноде, возвращает ее саму
    Пропускает пустые текстовые ноды
    @param cursor: [HTMLNode, int]
    @return: HTMLNode|null
    ###
    [node, offset] = cursor
    if cursorIsAtTheStartOfNode cursor
        res = getDeepestLastNode getNearestPreviousNode node
    else
        return node if isTextNode node
        res = getDeepestLastNode node.childNodes[offset - 1]
    if (isTextNode res) and (res.length is 0)
        res = getDeepestNodeBeforeCursor [res, 0]
    return res

getDeepestNodeAfterCursor = module.exports.getDeepestNodeAfterCursor = (cursor) ->
    ###
    Возвращает самую вложенную ноду после курсора
    Если курсор находится внутри текста в текстовой ноде, возвращает ее саму
    Пропускает пустые текстовые ноды
    @param cursor: [HTMLNode, int]
    @return: HTMLNode|null
    ###
    [node, offset] = cursor
    if cursorIsAtTheEndOfNode cursor
        res = getDeepestLastNode getNearestNextNode node
    else
        if isTextNode node
            res = node
        else
            res = node.childNodes[offset]
    if (isTextNode res) and (res.length is 0)
        res = getDeepestNodeAfterCursor [res, 0]
    return res

getDeepestFirstChild = exports.getDeepestFirstChild = (node) ->
    while node.firstChild
        node = node.firstChild
    node

getDeepestLastChild = exports.getDeepestLastChild = (node) ->
    while node.lastChild
        node = node.lastChild
    node

exports.getParentOffset = getParentOffset = (node) ->
    ###
    Возвращает индекс переданной ноды в родильской ноде
    @param node: HTMLNode
    @returns: int
    ###
    offset = 0
    child = node.parentNode.firstChild
    while child isnt node
        child = child.nextSibling
        offset++
    offset

exports.setFullRange = setFullRange = (startContainer, startOffset, endContainer, endOffset) ->
    range = document.createRange()
    range.setStart(startContainer, startOffset)
    range.setEnd(endContainer, endOffset)
    setRange(range)

exports.getPosition = getPosition = (node, offsetParent) ->
    top = 0
    left = 0
    while node
        top += node.offsetTop
        left += node.offsetLeft
        return [top, left] if node.offsetParent is offsetParent
        node = node.offsetParent
    [null, null]

exports.removeClass = removeClass = (node, value) ->
    className = (' ' + node.className + ' ').replace(/[\n\t\r]/g, ' ').replace(' ' + value + ' ', ' ').trim()
    return no if className is node.className
    node.className = className
    yes

exports.addClass = addClass = (node, value) ->
    value = ' ' + value + ' '
    className = (' ' + node.className + ' ')
    return no if className.indexOf(value) isnt -1
    node.className = (className + value).trim()
    yes
