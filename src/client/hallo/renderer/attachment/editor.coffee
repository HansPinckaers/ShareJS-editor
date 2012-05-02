renderAttachmentEditor = require('./template').renderAttachmentEditor
KeyCodes = require('../utils/key_codes').KeyCodes
DomUtils = require('../utils/dom')

class AttachmentEditor
    ###
    Редактор для добавления вложений
    ###
    constructor: ->
        @_init()

    @get: -> @instance ?= new @
    
    _init: ->
        @_createDom()
        @_hide()
        c = $(@_container)
        c.find('.js-attachment-editor-submit-btn').click @_submit
        c.find('.js-attachment-editor-close-btn').click @_close
        @_$urlInput = c.find('.js-attachment-editor-url-input')
        @_$urlInput.bind 'keydown keypress', @_processUrlInputKeyPress

    _createDom: ->
        $(document.body).append(renderAttachmentEditor())
        @_container = $(document.body).find('.js-attachment-editor')[0]

    _clickHandler: (event) =>
        @_close() if not $.contains @_container, event.target

    _close: =>
        ###
        Закрывает окно без подтверждения ввода url
        ###
        DomUtils.setRange(@_currentRange)
        @_hide()

    _submit: =>
        ###
        Закрывает окно, подтверждая ввод url
        ###
        url = @_$urlInput.val()
        DomUtils.setRange(@_currentRange)
        @_editor.insertAttachment(url)
        @_hide()

    _processUrlInputKeyPress: (event) =>
        if event.keyCode is KeyCodes.KEY_ENTER
            @_submit()
            return event.preventDefault()
        if event.keyCode is KeyCodes.KEY_ESCAPE
            @_close()
            return event.preventDefault()
    
    _hide: ->
        $(@_container).removeClass('shown')
        $(window).unbind 'mousedown', @_clickHandler
    
    show: (@_editor) ->
        ###
        Показывает окно вставки вложения
        @param _editor: Editor, редактор, в который предполагается вставить вложение
        ###
        @_currentRange = @_editor.getRange()
        return if not @_currentRange
        $(@_container).center().addClass('shown')
        @_$urlInput.val ''
        @_$urlInput.focus()
        $(window).bind 'mousedown', @_clickHandler


exports.AttachmentEditor = AttachmentEditor