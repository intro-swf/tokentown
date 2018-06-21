define(function() {

  'use strict';
  
  function escape_rx(v) { return v.replace(/([\[\]\(\)\{\}\.\*\+\|\\\-])/g, '\\$1'); }
  
  const SINGLE_SYMBOL_CHARS = '@;,()[]{}?:~';
  const COMPOSITE_SYMBOL_CHARS = '+-*/%<>=!|&^.';
  const RESERVED_CHARS = '"\'#';
  const RX_WORD = new RegExp(
    '^(?![0-9])[^\\s' + escape_rx(SINGLE_SYMBOL_CHARS + COMPOSITE_SYMBOL_CHARS + RESERVED_CHARS) + ']+$'
  );
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
  
  function next_token(prev, required) {
    const pos = prev.index + prev[0].length;
    if (pos >= prev.input.length) {
      if (required) {
        throw new Error('unexpected end of snippet');
      }
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
    extendExpression: function(expr, minPrecedence) {
      var token = next_token(expr.finalToken);
      if (!token) return null;
      var opPrecedence, rightAssoc;
      switch (token[1]) {
        default: return null;
        case '.':
          var name = next_token(token, true);
          return {op:'.', target:expr, name:name[1], finalToken:name};
        case '[':
          token = next_token(token, true);
          var index = this.readExpression(token, 0);
          token = next_token(index.finalToken, true);
          if (token[1] !== ']') throw new Error('invalid content in snippet');
          return {op:'[]', target:expr, index:index, finalToken:token};
        case '(':
          var call = [];
          call.op = '()';
          call.target = expr;
          token = next_token(token, true);
          if (token[1] !== ')') {
            do {
              var param = this.readExpression(token, 0);
              call.push(param);
              token = next_token(param.finalToken, true);
            } while (token[1] === ',');
            if (token[1] !== ')') {
              throw new Error('invalid content in snippet');
            }
          }
          call.finalToken = token;
          return call;
        case '!':
          return {op:'@!', target:expr, finalToken:token};
        case '++': case '--':
          return {op:token[1], target:expr, finalToken:token};
        case '**': opPrecedence = 15; rightAssoc = true; break;
        case '*': case '/': case '%': opPrecedence = 14; break;
        case '+': case '-': opPrecedence = 13; break;
        case '<<': case '>>': case '>>>': opPrecedence = 12; break;
        case '<': case '<=': case '>': case '>=': opPrecedence = 11; break;
        case '==': case '===': case '!=': case '!==': opPrecedence = 10; break;
        case '&': opPrecedence = 9; break;
        case '^': opPrecedence = 8; break;
        case '|': opPrecedence = 7; break;
        case '&&': opPrecedence = 6; break;
        case '||': opPrecedence = 5; break;
        case '=': case '+=': case '-=': case '**=': case '*=': case '/=': case '%=':
        case '<<=': case '>>=': case '>>>=': case '&=': case '^=': case '|=':
          opPrecedence = 3;
          rightAssoc = true;
          break;
        case ';': opPrecedence = 1; break;
      }
      if (minPrecedence > opPrecedence) return null;
      var rhs = this.readExpression(
        next_token(token, true),
        rightAssoc ? opPrecedence : opPrecedence+1);
      var binop = {op:token[1], left:expr, right:rhs, finalToken:rhs.finalToken};
      delete expr.finalToken;
      delete rhs.finalToken;
      return binop;
    },
    readExpression: function(token, minPrecedence) {
      var expr;
      switch (token[1]) {
        case '(':
          token = next_token(token, true);
          var expr = this.readExpression(token, 0);
          var endParen = next_token(expr.finalToken, true);
          if (endParen[1] !== ')') {
            throw new Error('unclosed parenthesis');
          }
          expr.finalToken = endParen;
          break;
        case '!': case '~': case '+': case '-': case '++': case '--':
          var operandToken = next_token(token, true);
          expr = this.readExpression(operandToken, 16);
          var finalToken = expr.finalToken;
          delete expr.finalToken;
          expr = {op:token[1], length:1, 0:expr, finalToken:finalToken};
          break;
        case '@':
          expr = {op:'@', finalToken:token};
          break;
        case ')':
        case ',':
        case ']':
          throw new Error('invalid content in Blotto snippet');
        default:
          if (token[1][0] === "'") {
            expr = {op:"''", value:token[1].slice(1, -1).replace(/''/g, "'"), finalToken:token};
          }
          else if (/^[0-9]/.test(token[1])) {
            expr = {op:'#', value:token[1], finalToken:token};
          }
          else if (RX_WORD.test(token[1])) {
            expr = {op:'(name)', name:token[1], finalToken:token};
          }
          else {
            throw new Error('invalid content in snippet');
          }
          break;
      }
      var extended;
      while (extended = this.extendExpression(expr, minPrecedence)) {
        expr = extended;
      }
      return expr;
    },
    parse: function(src) {
      var expr = this.readExpression(first_token(src), 0);
      if (!expr) return null;
      if (expr.finalToken.index + expr.finalToken[0].length < src.length) {
        throw new Error('invalid content in Blotto snippet');
      }
      delete expr.finalToken;
      return expr;
    },
  };
  
  return BlottoParser;

});
