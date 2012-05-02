ck = window.CoffeeKup

attachmentTmpl = ->
    div '.attachment-content', ->
        a {href: h(@src), rel: h(@rel)}, ->
            img '.attachment-preview', {src: h(@src), alt: ''}

attachmentEditorTmpl = ->
    ###
    Шаблон формы добавления вложений
    ###
    div 'js-attachment-editor.attachment-editor.window', ->
        div '.attachment-editor-name', ->
            span 'Insert attachment'
            span '.close-icon.js-attachment-editor-close-btn', ''
        table '.attachment-editor-content', ->
            tr '', ->
                td '', 'URL'
                td '', ->
                    div '.attachment-url', ->
                        label ->
                            input '.js-attachment-editor-url-input', {type: 'text'}
            tr '', ->
                td '', ''
                td '', ->
                    button '.js-attachment-editor-submit-btn.button', title: 'Accept changes', 'Submit'

exports.renderAttachmentEditor = ->
    ck.render attachmentEditorTmpl

exports.renderAttachment = (params) ->
    ck.render attachmentTmpl, params