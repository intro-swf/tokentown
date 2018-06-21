define(function() {

  'use strict';
  
  function escape_rx(v) { return v.replace(/([\[\]\(\)\{\}\.\*\+\|\\\-])/g, '\\$1'); }
  
  const SINGLE_SYMBOL_CHARS = '@;,()[]{}?:~';
  const COMPOSITE_SYMBOL_CHARS = '+-*/%<>=!|&^.';
  const RESERVED_CHARS = '"\'#';
  const RX_TOKEN = new RegExp('(' + [
      // word
      '(?![0-9])[^\\s' + escape_rx(SINGLE_SYMBOL_CHARS + COMPOSITE_SYMBOL_CHARS + RESERVED_CHARS) + ']+'
      // single symbol
      ,'[' + escape_rx(SINGLE_SYMBOL_CHARS) + ']'
      // + ++ += & && &= | || |=
      ,'([' + escape_rx('+-&|') + '])(?:\\2|=)?'
      // / /= % %= ^ ^=
      ,'[/%^]=?'
      // * ** *= **=
      ,'\\*\\*?=?'
      // < <= << <<=
      ,'<<?=?'
      // > >= >> >>= >>> >>>=
      ,'>>?>?=?'
      // ! != !== = == ===
      ,'[!=]=?=?'
      // . [followed by uncaptured word]
      ,'\\.(?=\\s*[^0-9\\s' + escape_rx(SINGLE_SYMBOL_CHARS + COMPOSITE_SYMBOL_CHARS + RESERVED_CHARS) + '])'
      // string
      ,"'([^']+|'')*'"
      // number
      ,'(0x[0-9a-f]+|0b[01]+|0o[0-7]+|[1-9][0-9]*(?:\\.[0-9]+)?(e[+\\-]?[0-9]+)?)'
    ].join('|') + ')(\\s*)', 'gi');
  
  function next_token(prev) {
    const pos = prev.index + prev[0].length;
    if (pos >= prev.input.length) {
      return null;
    }
    RX_TOKEN.lastIndex = pos;
    var token = RX_TOKEN.exec(prev.input);
    if (!token || token.index !== pos) {
      throw new Error('invalid content in Blotto snippet');
    }
    return token;
  }
  
  function first_token(src) {
    return next_token(src.match(/^\s*/));
  }
  
  function BlottoParser() {
  }
  BlottoParser.prototype = {
    parse: function(src) {
      for (var token = first_token(src); token; token = next_token(token)) {
        if (token[1][0] === "'") {
          this.on_call("''", token[1].slice(1, -1).replace(/''/g, "'"));
        }
        else if (/^[0-9]/.test(token[1][0])) {
          this.on_call('#', token[1]);
        }
        else {
          this.on_get(token[1]);
        }
      }
    },
    on_call: function() {
      // to be replaced
    },
    on_get: function() {
      // to be replaced
    },
  };
  
  return BlottoParser;

});
