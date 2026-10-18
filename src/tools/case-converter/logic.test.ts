import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { caseConverter, words } from './logic.ts';

const as = (input: string) => Object.fromEntries(caseConverter(input).map((v) => [v.label, v.value]));

describe('words', () => {
  it.each([
    ['hello world', ['hello', 'world']],
    ['helloWorld', ['hello', 'World']],
    ['HelloWorld', ['Hello', 'World']],
    ['XMLHttpRequest', ['XML', 'Http', 'Request']],
    ['user_id-2 value', ['user', 'id', '2', 'value']],
    ['version2Beta', ['version2', 'Beta']],
    ['  --  ', []],
    ['Ünïcode wörds', ['Ünïcode', 'wörds']],
  ])('%j', (input, expected) => expect(words(input)).toEqual(expected));
});

describe('caseConverter', () => {
  it('converts to every case', () => {
    expect(as('Hello big World')).toEqual({
      camelCase: 'helloBigWorld',
      PascalCase: 'HelloBigWorld',
      snake_case: 'hello_big_world',
      CONSTANT_CASE: 'HELLO_BIG_WORLD',
      'kebab-case': 'hello-big-world',
      'Train-Case': 'Hello-Big-World',
      'dot.case': 'hello.big.world',
      'path/case': 'hello/big/world',
      'Title Case': 'Hello Big World',
      'Sentence case': 'Hello big world',
      'lower case': 'hello big world',
      'UPPER CASE': 'HELLO BIG WORLD',
    });
  });

  it('round-trips between programming cases', () => {
    expect(as('someVariableName').snake_case).toBe('some_variable_name');
    expect(as('SOME_CONSTANT').camelCase).toBe('someConstant');
    expect(as('kebab-to-pascal').PascalCase).toBe('KebabToPascal');
  });

  it('converts each line separately', () => {
    expect(as('first line\nsecondLine')['kebab-case']).toBe('first-line\nsecond-line');
  });

  it('survives empty, huge and malformed input', () => {
    expectRobust(caseConverter);
  });
});
