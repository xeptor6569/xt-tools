// FIGlet fonts bundled with the `figlet` package (MIT). Each font is a
// separate chunk, loaded only when picked.
export const FONTS = {
  Standard: () => import('figlet/importable-fonts/Standard.js'),
  'ANSI Shadow': () => import('figlet/importable-fonts/ANSI Shadow.js'),
  Big: () => import('figlet/importable-fonts/Big.js'),
  'Big Money-ne': () => import('figlet/importable-fonts/Big Money-ne.js'),
  Block: () => import('figlet/importable-fonts/Block.js'),
  Bloody: () => import('figlet/importable-fonts/Bloody.js'),
  Bubble: () => import('figlet/importable-fonts/Bubble.js'),
  'Calvin S': () => import('figlet/importable-fonts/Calvin S.js'),
  Colossal: () => import('figlet/importable-fonts/Colossal.js'),
  Digital: () => import('figlet/importable-fonts/Digital.js'),
  Doom: () => import('figlet/importable-fonts/Doom.js'),
  Electronic: () => import('figlet/importable-fonts/Electronic.js'),
  Epic: () => import('figlet/importable-fonts/Epic.js'),
  Graffiti: () => import('figlet/importable-fonts/Graffiti.js'),
  Isometric1: () => import('figlet/importable-fonts/Isometric1.js'),
  'Larry 3D': () => import('figlet/importable-fonts/Larry 3D.js'),
  Lean: () => import('figlet/importable-fonts/Lean.js'),
  Mini: () => import('figlet/importable-fonts/Mini.js'),
  Ogre: () => import('figlet/importable-fonts/Ogre.js'),
  Rectangles: () => import('figlet/importable-fonts/Rectangles.js'),
  Script: () => import('figlet/importable-fonts/Script.js'),
  Shadow: () => import('figlet/importable-fonts/Shadow.js'),
  Slant: () => import('figlet/importable-fonts/Slant.js'),
  Small: () => import('figlet/importable-fonts/Small.js'),
  'Small Slant': () => import('figlet/importable-fonts/Small Slant.js'),
  Speed: () => import('figlet/importable-fonts/Speed.js'),
  'Star Wars': () => import('figlet/importable-fonts/Star Wars.js'),
  '3-D': () => import('figlet/importable-fonts/3-D.js'),
} as const;

export type FontName = keyof typeof FONTS;
export const FONT_NAMES = Object.keys(FONTS) as FontName[];

export async function loadFont(name: FontName): Promise<string> {
  return (await FONTS[name]()).default;
}
