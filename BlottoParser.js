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
    ].join('|') + ')\\s*', 'gi');
  
  function next_token(prev, required) {
    const pos = prev.index + prev[0].length;
    if (pos >= prev.input.length) {
      if (required) {
        throw new Error('unexpected end of Blotto snippet');
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
    parse: function(src) {
      var expr = this.readExpression(first_token(src), 0);
      if (!expr) return null;
      if (expr.finalToken.index + expr.finalToken[0].length < src.length) {
        throw new Error('invalid content in Blotto snippet');
      }
      return this.revive.apply(this, expr);
    },
    readExpression: function(token, minPrecedence) {
      var expr;
      switch (token[1]) {
        case '(':
          var expr = this.readExpression(next_token(token, true), 0);
          var endParen = next_token(expr.finalToken, true);
          if (endParen[1] !== ')') {
            throw new Error('invalid content in Blotto snippet');
          }
          expr.finalToken = endParen;
          break;
        case '+': case '-':
          if (/[0-9]/.test(token.input[token.index + token[0].length] || '')) {
            expr = this.readExpression(next_token(token, true), 16);
            if (token[1] === '-') {
              expr[1] = '-' + expr[1];
            }
            break;
          }
          // fall through:
        case '!': case '~': case '++': case '--':
          expr = this.readExpression(next_token(token, true), 16);
          var finalToken = expr.finalToken;
          expr = [token[1]+'@', this.revive.apply(this, expr)];
          expr.finalToken = finalToken;
          break;
        case '@':
          expr = Object.assign(['@'], {finalToken:token});
          break;
        case ')':
        case ',':
        case ']':
          throw new Error('invalid content in Blotto snippet');
        case '{':
          token = next_token(token, true);
          expr = ['{}'];
          if (token[1] !== '}') {
            entryLoop: for (;;) {
              var entry = this.readExpression(token, 0);
              expr.push(this.revive.apply(this, entry));
              token = next_token(entry.finalToken, true);
              switch (token[1]) {
                case ',':
                  token = next_token(token, true);
                  continue entryLoop;
                case '}':
                  break entryLoop;
                default:
                  throw new Error('invalid content in Blotto snippet');
              }
            }
          }
          expr.finalToken = token;
          break;
        default:
          if (token[1][0] === "'") {
            expr = ["''", token[1].slice(1, -1).replace(/''/g, "'")];
          }
          else if (/^[0-9]/.test(token[1])) {
            var literal = token[1];
            expr = ['#', literal];
            // immediately followed by a word other than e/E/p/P: suffix
            if (RX_WORD.test(token.input[token.index + token[1].length] || '')) {
              var suffix = next_token(token, true);
              if (!/^[ep]$/i.test(suffix[1])) {
                expr[0] += suffix[1];
                token = suffix;
              }
            }
          }
          else if (RX_WORD.test(token[1])) {
            switch (token.input[token.index + token[1].length]) {
              case "'":
                expr = this.readExpression(next_token(token, true), Infinity);
                expr[0] = token[1] + "''";
                token = expr.finalToken;
                break;
              case '{':
                this.enter(token[1]+'{}');
                expr = this.readExpression(next_token(token, true), Infinity);
                expr[0] = token[1] + "{}";
                token = expr.finalToken;                
                this.leave(token[1]+'{}');
                break;
              default:
                expr = ['(name)', token[1]];
                break;
            }
          }
          else {
            throw new Error('invalid content in Blotto snippet');
          }
          expr.finalToken = token;
          break;
      }
      var extended;
      while (extended = this.extendExpression(expr, minPrecedence)) {
        expr = extended;
      }
      return expr;
    },
    extendExpression: function(expr, minPrecedence) {
      var token = next_token(expr.finalToken);
      if (!token) return null;
      var opPrecedence, rightAssoc;
      switch (token[1]) {
        default: return null;
        case '.':
          var name = next_token(token, true);
          expr = ['@.(name)', this.revive.apply(this, expr), name[1]];
          expr.finalToken = name;
          return expr;
        case '[':
          var index = this.readExpression(next_token(token, true), 0);
          token = next_token(index.finalToken, true);
          if (token[1] !== ']') throw new Error('invalid content in Blotto snippet');
          expr = ['@[@]', this.revive.apply(this, expr), this.revive.apply(this, index)];
          expr.finalToken = token;
          return expr;
        case '(':
          var call = ['@()', this.revive.apply(this, expr)];
          token = next_token(token, true);
          if (token[1] !== ')') {
            paramLoop: for (;;) {
              var param = this.readExpression(token, 0);
              call.push(this.revive.apply(this, param));
              token = next_token(param.finalToken, true);
              switch (token[1]) {
                case ',':
                  token = next_token(token, true);
                  continue paramLoop;
                case ')':
                  break paramLoop;
                default:
                  throw new Error('invalid content in Blotto snippet');
              }
            }
          }
          call.finalToken = token;
          return call;
        case '!':
          expr = ['@!', this.revive.apply(this, expr)];
          expr.finalToken = token;
          return expr;
        case '++': case '--':
          expr = ['@' + token[1], this.revive.apply(this, expr)];
          expr.finalToken = token;
          return expr;
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
      expr = ['@'+token[1]+'@', this.revive.apply(this, expr), this.revive.apply(this, rhs)];
      expr.finalToken = rhs.finalToken;
      return expr;
    },
    revive: function(op) {
      switch (op) {
        case '#': return +arguments[1];
        case "''": return arguments[1];
        case ';': case '&&': case '||': case '+': case '^': case '|': case '&':
          if (Array.isArray(arguments[1]) && arguments[1].op === op) {
            arguments[1].push(arguments[2]);
            return arguments[1];
          }
          break;
      }
      return Object.assign([].slice.call(arguments, 1), {op:op});
    },
    enter: function(mode) {
    },
    leave: function(mode) {
    },
  };
  
  return BlottoParser;

});
