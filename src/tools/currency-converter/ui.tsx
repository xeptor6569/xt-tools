import { useState } from 'preact/hooks';
import Button from '../../components/ui/Button.tsx';
import ErrorMessage from '../../components/ui/ErrorMessage.tsx';
import Input from '../../components/ui/Input.tsx';
import KeyValueList from '../../components/ui/KeyValueList.tsx';
import OutputRegion from '../../components/ui/OutputRegion.tsx';
import Select from '../../components/ui/Select.tsx';
import { useLookup } from '../../components/ui/useLookup.ts';
import { networkJson } from '../../lib/network.ts';
import { ToolInputError } from '../types.ts';
import {
  CURRENCIES,
  currencyUrl,
  isCurrency,
  localConversion,
  parseAmount,
  parseFrankfurter,
  type Conversion,
  type CurrencyCode,
} from './logic.ts';

const OPTIONS = CURRENCIES.map(([value, name]) => ({ value, label: `${value} — ${name}` }));

function rows(result: Conversion) {
  return [
    { label: 'Converted', value: `${result.converted} ${result.to}` },
    { label: 'Amount', value: `${result.amount} ${result.from}` },
    { label: 'Rate', value: `1 ${result.from} = ${result.rate} ${result.to}` },
    ...(result.date ? [{ label: 'Rate date', value: result.date }] : []),
  ];
}

export default function CurrencyConverterTool() {
  const [amount, setAmount] = useState('12.5');
  const [from, setFrom] = useState<CurrencyCode>('USD');
  const [to, setTo] = useState<CurrencyCode>('EUR');
  const lookup = useLookup<Conversion>();

  function submit(event: { preventDefault(): void }): void {
    event.preventDefault();
    lookup.run(async (signal) => {
      const value = parseAmount(amount);
      if (!isCurrency(from) || !isCurrency(to)) throw new ToolInputError('Choose a currency from the list.');
      const url = currencyUrl(value, from, to);
      if (!url) return localConversion(value, from);
      return parseFrankfurter(await networkJson(url, { signal }), from, to, value);
    });
  }

  return (
    <form class="flex flex-col gap-4" onSubmit={submit}>
      <div class="flex flex-wrap items-end gap-4">
        <Input label="Amount" value={amount} onValue={setAmount} data-xt="input" inputMode="decimal" class="w-36" />
        <Select label="From" value={from} onValue={(value) => setFrom(value as CurrencyCode)} options={OPTIONS} />
        <Select label="To" value={to} onValue={(value) => setTo(value as CurrencyCode)} options={OPTIONS} />
        <Button variant="primary" type="submit" disabled={lookup.pending}>
          {lookup.pending ? 'Converting…' : 'Convert'}
        </Button>
      </div>
      <ErrorMessage message={lookup.error} />
      <OutputRegion label="Converted amount" busy={lookup.pending}>
        {lookup.output && <KeyValueList items={rows(lookup.output)} />}
      </OutputRegion>
    </form>
  );
}
