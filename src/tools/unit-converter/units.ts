// Unit definitions. `factor` converts one unit to the category's base unit.
// Values are exact definitions where one exists (e.g. 1 in = 0.0254 m).

export interface Unit {
  id: string;
  label: string;
  factor: number;
}

export interface Category {
  id: string;
  label: string;
  units: Unit[];
}

const u = (id: string, label: string, factor: number): Unit => ({ id, label, factor });

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      u('nm', 'Nanometres (nm)', 1e-9),
      u('um', 'Micrometres (µm)', 1e-6),
      u('mm', 'Millimetres (mm)', 1e-3),
      u('cm', 'Centimetres (cm)', 1e-2),
      u('m', 'Metres (m)', 1),
      u('km', 'Kilometres (km)', 1e3),
      u('in', 'Inches (in)', 0.0254),
      u('ft', 'Feet (ft)', 0.3048),
      u('yd', 'Yards (yd)', 0.9144),
      u('mi', 'Miles (mi)', 1609.344),
      u('nmi', 'Nautical miles (nmi)', 1852),
      u('au', 'Astronomical units (au)', 149_597_870_700),
      u('ly', 'Light-years (ly)', 9_460_730_472_580_800),
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    units: [
      u('ug', 'Micrograms (µg)', 1e-9),
      u('mg', 'Milligrams (mg)', 1e-6),
      u('g', 'Grams (g)', 1e-3),
      u('kg', 'Kilograms (kg)', 1),
      u('t', 'Tonnes (t)', 1000),
      u('ct', 'Carats (ct)', 0.0002),
      u('oz', 'Ounces (oz)', 0.028349523125),
      u('lb', 'Pounds (lb)', 0.45359237),
      u('st', 'Stones (st)', 6.35029318),
      u('ton-us', 'Short tons (US)', 907.18474),
      u('ton-uk', 'Long tons (UK)', 1016.0469088),
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      u('c', 'Celsius (°C)', 1),
      u('f', 'Fahrenheit (°F)', 1),
      u('k', 'Kelvin (K)', 1),
      u('r', 'Rankine (°R)', 1),
    ],
  },
  {
    id: 'data',
    label: 'Data size',
    units: [
      u('bit', 'Bits', 1 / 8),
      u('B', 'Bytes (B)', 1),
      u('kB', 'Kilobytes (kB, 1000)', 1e3),
      u('MB', 'Megabytes (MB)', 1e6),
      u('GB', 'Gigabytes (GB)', 1e9),
      u('TB', 'Terabytes (TB)', 1e12),
      u('PB', 'Petabytes (PB)', 1e15),
      u('KiB', 'Kibibytes (KiB, 1024)', 1024),
      u('MiB', 'Mebibytes (MiB)', 1024 ** 2),
      u('GiB', 'Gibibytes (GiB)', 1024 ** 3),
      u('TiB', 'Tebibytes (TiB)', 1024 ** 4),
      u('PiB', 'Pebibytes (PiB)', 1024 ** 5),
      u('kbit', 'Kilobits (kbit)', 125),
      u('Mbit', 'Megabits (Mbit)', 125_000),
      u('Gbit', 'Gigabits (Gbit)', 125_000_000),
    ],
  },
  {
    id: 'time',
    label: 'Time',
    units: [
      u('ns', 'Nanoseconds', 1e-9),
      u('us', 'Microseconds', 1e-6),
      u('ms', 'Milliseconds', 1e-3),
      u('s', 'Seconds', 1),
      u('min', 'Minutes', 60),
      u('h', 'Hours', 3600),
      u('d', 'Days', 86_400),
      u('wk', 'Weeks', 604_800),
      u('mo', 'Months (average)', 2_629_746),
      u('yr', 'Years (365.2425 days)', 31_556_952),
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      u('mps', 'Metres per second (m/s)', 1),
      u('kmh', 'Kilometres per hour (km/h)', 1 / 3.6),
      u('mph', 'Miles per hour (mph)', 0.44704),
      u('kn', 'Knots (kn)', 1852 / 3600),
      u('fps', 'Feet per second (ft/s)', 0.3048),
    ],
  },
  {
    id: 'area',
    label: 'Area',
    units: [
      u('mm2', 'Square millimetres', 1e-6),
      u('cm2', 'Square centimetres', 1e-4),
      u('m2', 'Square metres (m²)', 1),
      u('ha', 'Hectares (ha)', 1e4),
      u('km2', 'Square kilometres (km²)', 1e6),
      u('in2', 'Square inches', 0.00064516),
      u('ft2', 'Square feet', 0.09290304),
      u('yd2', 'Square yards', 0.83612736),
      u('ac', 'Acres', 4046.8564224),
      u('mi2', 'Square miles', 2_589_988.110336),
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      u('ml', 'Millilitres (mL)', 1e-3),
      u('l', 'Litres (L)', 1),
      u('m3', 'Cubic metres (m³)', 1000),
      u('cm3', 'Cubic centimetres', 1e-3),
      u('in3', 'Cubic inches', 0.016387064),
      u('ft3', 'Cubic feet', 28.316846592),
      u('tsp', 'US teaspoons', 0.00492892159375),
      u('tbsp', 'US tablespoons', 0.01478676478125),
      u('floz-us', 'US fluid ounces', 0.0295735295625),
      u('cup-us', 'US cups', 0.2365882365),
      u('pt-us', 'US pints', 0.473176473),
      u('qt-us', 'US quarts', 0.946352946),
      u('gal-us', 'US gallons', 3.785411784),
      u('floz-uk', 'UK fluid ounces', 0.0284130625),
      u('pt-uk', 'UK pints', 0.56826125),
      u('gal-uk', 'UK gallons', 4.54609),
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    units: [
      u('pa', 'Pascals (Pa)', 1),
      u('hpa', 'Hectopascals (hPa)', 100),
      u('kpa', 'Kilopascals (kPa)', 1000),
      u('mpa', 'Megapascals (MPa)', 1e6),
      u('bar', 'Bar', 1e5),
      u('mbar', 'Millibar', 100),
      u('atm', 'Atmospheres (atm)', 101_325),
      u('psi', 'Pounds per square inch (psi)', 6894.757293168361),
      u('mmhg', 'Millimetres of mercury', 133.322387415),
      u('torr', 'Torr', 101_325 / 760),
      u('inhg', 'Inches of mercury', 3386.389),
    ],
  },
  {
    id: 'energy',
    label: 'Energy',
    units: [
      u('j', 'Joules (J)', 1),
      u('kj', 'Kilojoules (kJ)', 1000),
      u('cal', 'Calories (cal)', 4.184),
      u('kcal', 'Kilocalories (kcal)', 4184),
      u('wh', 'Watt-hours (Wh)', 3600),
      u('kwh', 'Kilowatt-hours (kWh)', 3.6e6),
      u('ev', 'Electronvolts (eV)', 1.602176634e-19),
      u('btu', 'British thermal units (BTU)', 1055.05585262),
    ],
  },
  {
    id: 'power',
    label: 'Power',
    units: [
      u('w', 'Watts (W)', 1),
      u('kw', 'Kilowatts (kW)', 1000),
      u('mw', 'Megawatts (MW)', 1e6),
      u('hp', 'Horsepower (mechanical)', 745.69987158227),
      u('ps', 'Metric horsepower (PS)', 735.49875),
      u('btuh', 'BTU per hour', 0.29307107017),
    ],
  },
  {
    id: 'angle',
    label: 'Angle',
    units: [
      u('deg', 'Degrees (°)', 1),
      u('rad', 'Radians', 180 / Math.PI),
      u('grad', 'Gradians', 0.9),
      u('turn', 'Turns', 360),
      u('arcmin', 'Arcminutes', 1 / 60),
      u('arcsec', 'Arcseconds', 1 / 3600),
    ],
  },
  {
    id: 'frequency',
    label: 'Frequency',
    units: [
      u('hz', 'Hertz (Hz)', 1),
      u('khz', 'Kilohertz (kHz)', 1e3),
      u('mhz', 'Megahertz (MHz)', 1e6),
      u('ghz', 'Gigahertz (GHz)', 1e9),
      u('rpm', 'Revolutions per minute', 1 / 60),
    ],
  },
];
