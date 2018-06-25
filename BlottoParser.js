define(function() {

  'use strict';
  
  const RXS_WORD = '(?![0-9])((?:[A-Za-z0-9_$@]|[^\\x00-\\xFF])+)';
  const RX_WORD = new RegExp('^' + RXS_WORD + '$');
  const RX_WORD_CHAIN = new RegExp('^' + RXS_WORD + '(?:\.' + RXS_WORD + ')*$');
  const RX_TOKEN = new RegExp('(' + [
      // word
      RXS_WORD
      // single symbol
      ,'[\\[\\];,()~]'
      // + ++ += & && &= | || |=
      ,'([\\-+&|])(?:\\2|=)?'
      // * *= ** **= / /= // //=
      ,'([\\*/])\\3?=?'
      // % %= ^ ^=
      ,'[%^]=?'
      // < <= << <<=
      ,'<<?=?'
      // > >= >> >>= >>> >>>=
      ,'>>?>?=?'
      // ! != !== = == ===
      ,'[!=]=?=?'
      // . [followed by uncaptured word]
      ,'\\.(?=\\s*' + RXS_WORD + ')'
      // ..
      ,'\\.\\.'
      // string
      ,"'([^']+|'')*'"
      // number
      ,'(0x[0-9a-f]+|0b[01]+|0o[0-7]+|(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(e[+\\-]?[0-9]+)?)'
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
  
  const RX_SCOOP_PART = /[^{}'\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]+|[{}]\s*|'[^']*'/g;
  
  function next_scoop(prev) {
    const src = prev.input;
    const start = prev.index + prev[0].length;
    if (src[start] !== '{') {
      throw new Error('no scoop found');
    }
    var depth = 0;
    RX_SCOOP_PART.lastIndex = start;
    for (var match = RX_SCOOP_PART.exec(src); match; match = RX_SCOOP_PART.exec(src)) {
      if (match.index !== prev.index + prev[0].length) {
        break;
      }
      switch (match[0][0]) {
        case '{': ++depth; break;
        case '}':
          if (--depth < 1) {
            var final = [
              src.slice(start, match.index + match[0].length),
              src.slice(start, match.index+1)
            ];
            final.input = src;
            final.index = start;
            return final;
          }
          break;
      }
      prev = match;
    }
    if (prev.index + prev[0].length < src.length
        && src[prev.index + prev[0].length] !== "'") {
      throw new Error('invalid content in Blotto snippet');
    }
    throw new Error('unexpected end of Blotto snippet');
  }
  
  function first_token(src) {
    return next_token(src.match(/^\s*/));
  }
  
  function BlottoParser() {
  }
  BlottoParser.prototype = {
    parse: function(src) {
      var first = first_token(src);
      if (!first) return this.revive('');
      var expr;
      if (first[1] === ';') {
        expr = [''];
        expr.finalToken = ['', ''];
        expr.finalToken.index = first.index;
        expr.finalToken.input = first.input;
        do {
          expr = this.extendExpression(expr, 0);
        } while (expr.finalToken.index + expr.finalToken[0].length < src.length);
      }
      else {
        expr = this.readExpression(first, 0);
      }
      if (expr.finalToken.index + expr.finalToken[0].length < src.length) {
        throw new Error('invalid content in Blotto snippet');
      }
      return this.revive.apply(this, expr);
    },
    readExpression: function(token, minPrecedence) {
      var expr;
      switch (token[1]) {
        case '(':
          if (token.input[token.index + token[0].length] === ')') {
            expr = [''];
            expr.finalToken = next_token(token, true);
          }
          else {
            expr = this.readExpression(next_token(token, true), 0);
            var endParen = next_token(expr.finalToken, true);
            if (endParen[1] !== ')') {
              throw new Error('invalid content in Blotto snippet');
            }
            expr.finalToken = endParen;
          }
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
        case '!': case '~': case '++': case '--': case '*': case '&':
          expr = this.readExpression(next_token(token, true), 16);
          var finalToken = expr.finalToken;
          expr = [token[1]+'@', this.revive.apply(this, expr)];
          expr.finalToken = finalToken;
          break;
        case ')':
        case ',':
        case ']':
        case '}':
          throw new Error('invalid content in Blotto snippet');
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
            switch (token.input[token.index + token[0].length]) {
              case "'":
                if (token[0] !== token[1]) {
                  throw new Error('whitespace after a string literal prefix is not permitted');
                }
                expr = this.readExpression(next_token(token, true), Infinity);
                expr[0] = token[1] + "''";
                token = expr.finalToken;
                break;
              case '{':
                var expr = [token[1]];
                do {
                  expr[0] += '{}';
                  var scoop = next_scoop(token, true);
                  expr.push(scoop[1].slice(1, -1));
                  token = scoop;
                } while (token.input[token.index + token[0].length] === '{');
                if (RX_WORD.test(token.input[token.index + token[0].length] || '')) {
                  var nextWord = next_token(token);
                  if (nextWord.input[nextWord.index + nextWord[0].length] === '{') {
                    var start = nextWord.index;
                    for (;;) {
                      token = nextWord;
                      do {
                        token = next_scoop(token, true);
                      } while (token.input[token.index + token[0].length] === '{');
                      if (!RX_WORD.test(token.input[token.index + token[0].length] || '')) {
                        break;
                      }
                      nextWord = next_token(token);
                      if (nextWord.input[nextWord.index + nextWord[0].length] !== '{') {
                        break;
                      }
                    }
                    expr.push(token.input.slice(start, token.index + token[1].length));
                  }
                }
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
            if (token[1] === ';') {
              throw new Error('semicolon not permitted directly in parameter list, try wrapping in (...)');
            }
            paramLoop: for (;;) {
              while (token[1] === ',') {
                call.push(this.revive(''));
                token = next_token(token, true);
                if (token[1] === ')') {
                  call.push(this.revive(''));
                  break paramLoop;
                }
              }
              var param = this.readExpression(token, 2);
              call.push(this.revive.apply(this, param));
              token = next_token(param.finalToken, true);
              switch (token[1]) {
                case ';':
                  throw new Error('semicolon not permitted directly in parameter list, try wrapping in (...)');
                case ',':
                  token = next_token(token, true);
                  if (token[1] === ')') {
                    call.push(this.revive(''));
                    break paramLoop;
                  }
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
        case '++': case '--':
          expr = ['@' + token[1], this.revive.apply(this, expr)];
          expr.finalToken = token;
          return expr;
        case '**': opPrecedence = 15; rightAssoc = true; break;
        case '*': case '/': case '%': case '//': opPrecedence = 14; break;
        case '+': case '-': opPrecedence = 13; break;
        case '..': opPrecedence = 12.5; break;
        case '<<': case '>>': case '>>>': opPrecedence = 12; break;
        case '<': case '<=': case '>': case '>=': opPrecedence = 11; break;
        case '==': case '===': case '!=': case '!==': opPrecedence = 10; break;
        case '&': opPrecedence = 9; break;
        case '^': opPrecedence = 8; break;
        case '|': opPrecedence = 7; break;
        case '&&': opPrecedence = 6; break;
        case '||': opPrecedence = 5; break;
        case '=': case '+=': case '-=': case '*=': case '**=': case '/=': case '//=': case '%=':
        case '<<=': case '>>=': case '>>>=': case '&=': case '^=': case '|=':
          opPrecedence = 3;
          rightAssoc = true;
          break;
        case ';':
          if (minPrecedence > 1) return null;
          if (/^[);]?$/.test(token.input[token.index + token[0].length] || '')) {
            expr = ['@;@', this.revive.apply(this, expr), this.revive('')];
            expr.finalToken = token;
            return expr;
          }
          opPrecedence = 1;
          break;
      }
      if (minPrecedence > opPrecedence) return null;
      var rhs = this.readExpression(
        next_token(token, true),
        rightAssoc ? opPrecedence : opPrecedence+0.5);
      expr = ['@'+token[1]+'@', this.revive.apply(this, expr), this.revive.apply(this, rhs)];
      expr.finalToken = rhs.finalToken;
      return expr;
    },
    revive: function(op, a, b) {
      function value(v) {
        if (v.length === 0 || Array.isArray(v[0])) {
          return '(' + v.map(value).join('; ') + ')';
        }
        return '(' + v[0] + ')';
      }
      switch (op) {
        case '': return [];
        case '(name)': return [a];
        case '@;@':
          if (Array.isArray(a) && Array.isArray(a[0])) {
            a.push(b);
            return a;
          }
          return [a, b];
        case '@()':
          return [value(a) + '(' + [].slice.call(arguments, 1).map(value).join(', ') + ')'];
        case '@[@]':
          return [value(a) + '[' + value(b) + ']'];
        case '@.(name)':
          return [value(a) + '.' + b];
      }
      var scoop = op.match(/^([^{]+)\{/);
      if (scoop) {
        return [scoop[1] + ' {' + [].slice.call(arguments, 1).join('} {') + '}'];
      }
      switch (arguments.length) {
        case 2:
          var num = op.match(/^#(.*)$/);
          if (num) return [a + num[1]];
          var str = arguments[0].match(/^(.*)''$/);
          if (str) return [str[1] + "'" + a.replace(/'/g, "''") + "'"];
          var match = op.match(/^(@)?([^@]+)(@)?$/);
          if (!match) break;
          return match[1] ? [match[1] + ' ' + value(a)] : [value(a) + match[3]];
        case 3:
          var match = op.match(/^@([^@]+)@$/);
          if (!match) break;
          return [value(a) + ' ' + match[2] + ' ' + value(b)];
      }
      throw new Error('unknown op: ' + op);
    },
  };
  
  return BlottoParser;

});
