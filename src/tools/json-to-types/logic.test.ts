import { describe, expect, it } from 'vitest';
import { expectRobust } from '../../../tests/helpers/expect-robust.ts';
import { jsonToTypes } from './logic.ts';
import meta from './meta.ts';
import { pascalCase, singularName, snakeCase } from './model.ts';

const SAMPLE = JSON.stringify({
  id: 7,
  'first-name': 'Ada',
  class: 'admin',
  '1st': true,
  score: 9.5,
  manager: null,
  tags: ['math', 'code'],
  users: [
    { id: 1, name: 'Ada', email: 'ada@example.com', address: { city: 'London' } },
    { id: 2, name: 'Grace', nickname: null, address: { city: 'Arlington' } },
  ],
  home: { city: 'Paris' },
  mixed: [1, 'two'],
});

describe('jsonToTypes: TypeScript', () => {
  it('generates interfaces with optional fields, nulls, unions and quoted keys', () => {
    expect(jsonToTypes(SAMPLE)).toBe(`export interface Root {
  id: number;
  "first-name": string;
  class: string;
  "1st": boolean;
  score: number;
  manager: null;
  tags: string[];
  users: User[];
  home: Home;
  mixed: (number | string)[];
}

export interface Home {
  city: string;
}

export interface User {
  id: number;
  name: string;
  email?: string;
  address: Home;
  nickname?: null;
}
`);
  });

  it('supports type aliases, no export and readonly', () => {
    expect(jsonToTypes('{"a":[1],"b":{"c":"x"}}', { tsDeclaration: 'type', tsExport: false, tsReadonly: true }))
      .toBe(`type Root = {
  readonly a: readonly number[];
  readonly b: B;
};

type B = {
  readonly c: string;
};
`);
  });

  it('aliases non-object roots and names array elements', () => {
    expect(jsonToTypes('[{"a":1},{"a":2,"b":"x"}]')).toBe(`export type Root = RootItem[];

export interface RootItem {
  a: number;
  b?: string;
}
`);
    expect(jsonToTypes('[{"a":1}]', { rootName: 'users' })).toBe(`export type Users = User[];

export interface User {
  a: number;
}
`);
    expect(jsonToTypes('"x"')).toBe('export type Root = string;\n');
    expect(jsonToTypes('[]')).toBe('export type Root = unknown[];\n');
    expect(jsonToTypes('[1, null]')).toBe('export type Root = (number | null)[];\n');
  });

  it('avoids name collisions between different shapes', () => {
    const out = jsonToTypes('{"item":{"a":1},"list":{"item":{"b":true}}}');
    expect(out).toContain('export interface Item {\n  a: number;\n}');
    expect(out).toContain('export interface Item2 {\n  b: boolean;\n}');
    expect(out).toContain('  item: Item2;');
  });

  it('avoids built-in type names', () => {
    expect(jsonToTypes('{"string":{"a":1}}')).toContain('string: StringType;');
  });

  it('notes integers beyond 2^53', () => {
    expect(jsonToTypes('{"n":9007199254740993}')).toMatch(/^\/\/ Note: \$\.n has integers beyond 2\^53/);
  });
});

describe('jsonToTypes: Go', () => {
  it('generates structs with tags, pointers and omitempty', () => {
    expect(jsonToTypes(SAMPLE, { language: 'go' })).toBe(`type Root struct {
	ID        int64    \`json:"id"\`
	FirstName string   \`json:"first-name"\`
	Class     string   \`json:"class"\`
	N1st      bool     \`json:"1st"\`
	Score     float64  \`json:"score"\`
	Manager   any      \`json:"manager"\`
	Tags      []string \`json:"tags"\`
	Users     []User   \`json:"users"\`
	Home      Home     \`json:"home"\`
	Mixed     []any    \`json:"mixed"\`
}

type Home struct {
	City string \`json:"city"\`
}

type User struct {
	ID       int64   \`json:"id"\`
	Name     string  \`json:"name"\`
	Email    *string \`json:"email,omitempty"\`
	Address  Home    \`json:"address"\`
	Nickname any     \`json:"nickname,omitempty"\`
}
`);
  });

  it('uses float64 when any sample has a fraction or exponent', () => {
    expect(jsonToTypes('[{"n":1},{"n":2.5}]', { language: 'go' })).toContain('N float64 `json:"n"`');
    expect(jsonToTypes('{"n":1.0}', { language: 'go' })).toContain('N float64');
    expect(jsonToTypes('{"n":1}', { language: 'go' })).toContain('N int64');
  });

  it('handles nullable values, root arrays and keys that need care', () => {
    expect(jsonToTypes('{"a":null}', { language: 'go' })).toContain('A any');
    expect(jsonToTypes('{"a":"x","b":null}', { language: 'go' })).toContain('A string');
    expect(jsonToTypes('[{"a":"x"},{"a":null}]', { language: 'go' })).toContain('A *string `json:"a"`');
    expect(jsonToTypes('[1,2]', { language: 'go' })).toBe('type Root []int64\n');
    expect(jsonToTypes('{"a,b":1}', { language: 'go' })).toContain("can't be written in a struct tag");
    expect(jsonToTypes('{"a-b":1,"aB":2}', { language: 'go' })).toContain('AB2 int64');
  });
});

describe('jsonToTypes: Rust', () => {
  it('generates serde structs with renames, raw identifiers and Option', () => {
    expect(jsonToTypes(SAMPLE, { language: 'rust' })).toBe(`use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Root {
    pub id: i64,
    #[serde(rename = "first-name")]
    pub first_name: String,
    pub class: String,
    #[serde(rename = "1st")]
    pub _1st: bool,
    pub score: f64,
    pub manager: serde_json::Value,
    pub tags: Vec<String>,
    pub users: Vec<User>,
    pub home: Home,
    pub mixed: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Home {
    pub city: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub email: Option<String>,
    pub address: Home,
    pub nickname: Option<serde_json::Value>,
}
`);
  });

  it('escapes keywords and odd keys', () => {
    const out = jsonToTypes('{"type":1,"self":2,"firstName":3,"q\\"\\u0001":4}', { language: 'rust' });
    expect(out).toContain('    pub r#type: i64,');
    expect(out).toContain('    #[serde(rename = "self")]\n    pub self_: i64,');
    expect(out).toContain('    #[serde(rename = "firstName")]\n    pub first_name: i64,');
    expect(out).toContain('#[serde(rename = "q\\"\\u{1}")]');
    expect(jsonToTypes('[1.5]', { language: 'rust' })).toBe('pub type Root = Vec<f64>;\n');
  });
});

describe('jsonToTypes: Python', () => {
  it('generates dataclasses in dependency order with renamed keys and defaults last', () => {
    expect(jsonToTypes(SAMPLE, { language: 'python' }))
      .toBe(`# Standard library only (dataclasses, typing); pydantic isn't needed.
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Union


@dataclass
class Home:
    city: str


@dataclass
class User:
    id: int
    name: str
    address: Home
    email: Optional[str] = None
    nickname: None = None


@dataclass
class Root:
    id: int
    first_name: str  # JSON key: "first-name"
    class_: str  # JSON key: "class"
    _1st: bool  # JSON key: "1st"
    score: float
    manager: None
    tags: list[str]
    users: list[User]
    home: Home
    mixed: list[Union[int, str]]
`);
  });

  it('generates TypedDicts, with the functional syntax when keys are not identifiers', () => {
    expect(jsonToTypes(SAMPLE, { language: 'python', pythonStyle: 'typeddict' }))
      .toBe(`# Standard library only (typing); pydantic isn't needed.
from __future__ import annotations

from typing import NotRequired, TypedDict, Union


class Home(TypedDict):
    city: str


class User(TypedDict):
    id: int
    name: str
    email: NotRequired[str]
    address: Home
    nickname: NotRequired[None]


Root = TypedDict("Root", {
    "id": int,
    "first-name": str,
    "class": str,
    "1st": bool,
    "score": float,
    "manager": None,
    "tags": list[str],
    "users": list[User],
    "home": Home,
    "mixed": list[Union[int, str]],
})
`);
  });

  it('aliases root arrays after the element type', () => {
    expect(jsonToTypes('[{"a":1,"b":null},{"a":"x","b":2}]', { language: 'python' })).toBe(
      `# Standard library only (dataclasses, typing); pydantic isn't needed.
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Union


@dataclass
class RootItem:
    a: Union[int, str]
    b: Optional[int]


Root = list[RootItem]
`,
    );
  });
});

describe('naming helpers', () => {
  it('converts case', () => {
    expect(pascalCase('first-name')).toBe('FirstName');
    expect(pascalCase('userID')).toBe('UserId');
    expect(pascalCase('1st')).toBe('N1st');
    expect(pascalCase('日本')).toBe('');
    expect(snakeCase('firstName')).toBe('first_name');
    expect(snakeCase('HTTPServer')).toBe('http_server');
  });

  it('singularises array element names', () => {
    expect(singularName('Users')).toBe('User');
    expect(singularName('Categories')).toBe('Category');
    expect(singularName('Boxes')).toBe('Box');
    expect(singularName('Addresses')).toBe('Address');
    expect(singularName('Statuses')).toBe('Status');
    expect(singularName('Children')).toBe('Child');
    expect(singularName('UserAccounts')).toBe('UserAccount');
    expect(singularName('Data')).toBe('DataItem');
    expect(singularName('Status')).toBe('StatusItem');
    expect(singularName('Root')).toBe('RootItem');
  });
});

describe('jsonToTypes: input handling', () => {
  it('returns nothing for empty input', () => {
    expect(jsonToTypes('')).toBe('');
    expect(jsonToTypes('  \n')).toBe('');
  });

  it('rejects invalid and too deeply nested JSON', () => {
    expect(() => jsonToTypes('{"a":')).toThrow(/Invalid JSON/);
    expect(() => jsonToTypes('['.repeat(5000) + ']'.repeat(5000))).toThrow(/nested too deeply/);
  });

  it('handles a large array of objects quickly', () => {
    const big = JSON.stringify(Array.from({ length: 20_000 }, (_, i) => ({ id: i, name: `n${i}`, ok: i % 2 === 0 })));
    expect(jsonToTypes(big, { language: 'go' })).toContain('type RootItem struct');
  });

  it('matches the metadata examples', () => {
    for (const ex of meta.examples ?? []) expect(jsonToTypes(ex.input)).toContain(ex.expect);
  });

  it('survives empty, huge and malformed input', () => {
    for (const language of ['typescript', 'go', 'rust', 'python'] as const) {
      expectRobust((s) => jsonToTypes(s, { language }), {
        malformed: ['{"a":', '[1,]', '{"\\ud800":1}', '[' + '{"a":'.repeat(300) + '1' + '}'.repeat(300) + ']'],
      });
    }
  });
});
