
exports.escapeHTML = (str) ->
    str.replace(/&/g,'&amp;')
        .replace(/>/g,'&gt;')
        .replace(/</g,'&lt;')
        .replace(/"/g,'&quot;')

class Utf16Util
    @REPLACEMENT_CHARACTER = String.fromCharCode(0xFFFD)
    @CHAR_TYPE =
        BIDI: 'BIDI'
        # basic control char set
        CONTROL: 'CONTROL'
        DEPRECATED: 'DEPRECATED'
        NONCHARACTER: 'NONCHARACTER'
        OK: 'OK'
        SUPPLEMENTARY: 'SUPPLEMENTARY'
        SURROGATE: 'SURROGATE'
        TAG: 'TAG'

    @isControl: (cp) ->
        ###
        Проверяет является ли codepoint упраляющим символом
        ###
        0 <= cp <= 0x1F or 0x7F <= cp <= 0x9F

    @isSurrogate: (cp) ->
        ###
        Проверяет является ли codepoint суррогатным символом (обязательно состоящим из пары)
        @param c: int - строка из одного символа
        @returns: boolean
        ###
        0xD800 <= cp <= 0xDFFF

    @isLowSurrogate: (cp) ->
        0xDC00 <= cp <= 0xDFFF

    @isHighSurrogate: (cp) ->
        0xD800 <= cp < 0xDC00

    @isSupplementary: (cp) ->
        ###
        Проверяет является ли codepoint символом в дополнительной таблице
        ###
        cp >= 0x10000

    @isCodePoint: (cp) ->
        ###
        Проверяет является ли аргумент codepoint'ом
        ###
        0 <= cp <= 0x10FFFF

    @isBidi: (cp) ->
        ###
        Проверяет является ли codepoint символом bidi формата
        ###
        # bidi neutral formatting
        return yes if cp is 0x200E or cp is 0x200F
        # bidi general formatting
        0x202A <= cp <= 0x202E

    @isDeprecated: (cp) ->
        0x206A <= cp <= 0x206F

    @isValid: (cp) ->
        ###
        Проверяет валидность символа
        @param cp: int - строка из одного символа
        @returns: boolean - true, если символ валидный, false, если это non-character символ
        ###
        return no if not @isCodePoint(cp)
        d = cp & 0xFFFF
        # never to change noncharacters
        return no if d is 0xFFFE or d is 0xFFFF
        return no if 0xFDD0 <= cp <= 0xFDEF
        yes

    @getCharType: (c) ->
        cp = c.charCodeAt(0)
        return @CHAR_TYPE.NONCHARACTER if not @isValid(cp)
        return @CHAR_TYPE.CONTROL if @isControl(cp)
        return @CHAR_TYPE.SURROGATE if @isSurrogate(cp)

#        // private use
#        // we permit these, they can be used for things like emoji
#        //if (0xE000 <= c && c <= 0xF8FF) { return false; }
#        //if (0xF0000 <= c && c <= 0xFFFFD) { return false; }
#        //if (0x100000 <= c && c <= 0x10FFFD) { return false; }
#        (BOM) U+FEFF
#        The UTF-8 sequence corresponding to U+FEFF is 0xEF, 0xBB, 0xBF

#        The zero-width joiner (U+200D) and zero-width non-joiner (U+200C) control the joining and ligation of glyphs. The joiner does not cause characters that would not otherwise join or ligate to do so, but when paired with the non-joiner these characters can be used to control the joining and ligating properties of the surrounding two joining or ligating characters. The Combining Grapheme Joiner (U+034F) is used to distinguish two base characters as one common base or digraph, mostly for underlying text processing, collation of strings, case folding and so on.

#        The most common word separator is a space (U+0020). However, there are other word joiners and separators that also indicate a break between words and participate in line-breaking algorithms. The No-Break Space (U+00A0) also produces a baseline advance without a glyph but inhibits rather than enabling a line-break. The Zero Width Space (U+200B) allows a line-break but provides no space: in a sense joining, rather than separating, two words. Finally, the Word Joiner (U+2060) inhibits line breaks and also involves none of the white space produced by a baseline advance.

#        interlinear annotation chars
#        script-specific

        return @CHAR_TYPE.DEPRECATED if @isDeprecated(cp)
#        // TODO: investigate whether we can lift some of these restrictions
#        // bidi markers
        return @CHAR_TYPE.BIDI if @isBidi(cp)
#        // tag characters, strongly discouraged
#        if (0xE0000 <= c && c <= 0xE007F) { return BlipCodePointResult.TAG; }
        return @CHAR_TYPE.SUPPLEMENTARY if @isSupplementary(cp)
        @CHAR_TYPE.OK;

    @unpairedSurrogate: (c) ->
        Utf16Util.REPLACEMENT_CHARACTER

    @traverseString: (str) ->
        ###
        Traverse UTF16 string
        ###
        res = ''
        for c, i in str
            switch @getCharType(c)
                when @CHAR_TYPE.OK
                    res += c
                when @CHAR_TYPE.CONTROL, @CHAR_TYPE.BIDI, @CHAR_TYPE.DEPRECATED
                    continue
                else
                    res += @REPLACEMENT_CHARACTER
        res

exports.Utf16Util = Utf16Util