# Category: mouse
exports.MOUSE_EVENTS = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'mouseover',
    'mousemove',
    'mouseout',
    'mousewheel',
    'contextmenu',
    'selectstart'
]

# Category: key
exports.KEYDOWN_EVENT = KEY_DOWN_EVENT = 'keydown'
exports.KEYPRESS_EVENT = KEY_PRESS_EVENT = 'keypress'
exports.KEYUP_EVENT = KEY_UP_EVENT = 'keyup'
exports.KEY_EVENTS = [
    KEY_DOWN_EVENT,
    KEY_PRESS_EVENT,
    KEY_UP_EVENT
]

# Category: dragdrop
exports.DRAGDROP_EVENTS = [
    'drag',
    'dragstart',
    'dragenter',
    'dragover',
    'dragleave',
    'dragend',
    'drop'
]

# Category: clipboard
exports.COPY_EVENT = COPY_EVENT = 'copy'
exports.CUT_EVENT = CUT_EVENT = 'cut'
exports.PASTE_EVENT = PASTE_EVENT = 'paste'
exports.BEFORE_CUT_EVENT = BEFORE_CUT_EVENT = 'beforecut'
exports.BEFORE_COPY_EVENT = BEFORE_COPY_EVENT = 'beforecopy'
exports.BEFORE_PASTE_EVENT = BEFORE_PASTE_EVENT = 'beforepaste'
exports.CLIPBOARD_EVENTS = [
    CUT_EVENT,
    COPY_EVENT,
    PASTE_EVENT,
]

# Category: focus
exports.BLUR_EVENT = BLUR_EVENT = 'blur'
exports.FOCUS_EVENTS = [
    'focus',
    BLUR_EVENT,
    'beforeeditfocus'
]

# Category: mutation
exports.MUTATION_EVENTS = [
    'DOMActivate',
    'DOMAttributeNameChanged',
    'DOMAttrModified',
    'DOMCharacterDataModified',
    'DOMElementNameChanged',
    'DOMFocusIn',
    'DOMFocusOut',
    'DOMMouseScroll',
    'DOMNodeInserted',
    'DOMNodeInsertedIntoDocument',
    'DOMNodeRemoved',
    'DOMNodeRemovedFromDocument',
    'DOMSubtreeModified'
]

#/** IME composition commencement event */
COMPOSITIONSTART = "compositionstart";

#/** IME composition completion event */
COMPOSITIONEND = "compositionend";

#/** DOM level 3 composition update event */
COMPOSITIONUPDATE = "compositionupdate";

#/** Firefox composition update event */
exports.TEXT_EVENT = TEXT_EVENT = "text";

#/** Poorly supported DOM3 event */
exports.TEXT_INPUT_EVENT = TEXT_INPUT_EVENT = 'textInput';
exports.INPUT_EVENTS = [
    ## Category: input
    COMPOSITIONSTART,  # IME events
    COMPOSITIONEND,    # IME events
    COMPOSITIONUPDATE, # IME events
    TEXT_EVENT,        # IME events
    TEXT_INPUT_EVENT,  # In supported browsers, fired both for IME and non-IME input
]
#/**
#* Array of events the editor listens for
#*/
exports.OTHER_EVENTS = [

## Category: frame/object",
  "load",
  "unload",
  "abort",
  "error",
  "resize",
  "scroll",
  "beforeunload",
  "stop",

## Category: form",
  "select",
  "change",
  "submit",
  "reset",

## Category: ui",
  "domfocusin",
  "domfocusout",
  "domactivate",

## Category: data binding",
  "afterupdate",
  "beforeupdate",
  "cellchange",
  "dataavailable",
  "datasetchanged",
  "datasetcomplete",
  "errorupdate",
  "rowenter",
  "rowexit",
  "rowsdelete",
  "rowinserted",

## Category: misc",
  "help",

  "start",  #marquee
  "finish", #marquee
  "bounce", #marquee

  "beforeprint",
  "afterprint",

  "propertychange",
  "filterchange",
  "readystatechange",
  "losecapture"
]