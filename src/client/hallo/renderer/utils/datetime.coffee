###
Функции для работы с датой и временем
###

init = exports.init = (culture) ->
    Globalize.culture(culture);

_TIME_SHORT = exports._TIME_SHORT = "t"
_DATE_SHORT = exports._DATE_SHORT = "d MMM"
_DATE = exports._DATE = "MMM yyyy"
LONG_DATE_SHORT_TIME = "f"

_getFormat = exports._getFormat = (serverDate, clientToday) ->
    ###
    @param serverDate: Date - дата пришедшая с сревера;
    @param clientToday: Date - текущая дата на клиенте;
    Приватная функция, экспортируется для тестов
    ###
    return _TIME_SHORT if serverDate > clientToday
    if serverDate.getDate() == clientToday.getDate() and serverDate.getMonth() == clientToday.getMonth() and serverDate.getYear() == clientToday.getYear()
        return _TIME_SHORT
    if (clientToday - serverDate) < 2*60*60*1000
        return _TIME_SHORT
    if (clientToday - serverDate) < 60*24*60*60*1000
        return _DATE_SHORT
    if serverDate.getYear() == clientToday.getYear()
        return _DATE_SHORT
    return _DATE

formatDate = exports.formatDate = (ts, full=false) ->
    ###
    Форматирует timestamp в читаемую дату
    @param ts: int, unix timestamp
    @return: string
    ###
    serverDate = new Date ts*1000
    return Globalize.format(serverDate, LONG_DATE_SHORT_TIME) if full
    clientToday = new Date()
    clientOffset = clientToday.getTimezoneOffset()
    format = _getFormat(serverDate, clientToday)
    return Globalize.format(serverDate, format)