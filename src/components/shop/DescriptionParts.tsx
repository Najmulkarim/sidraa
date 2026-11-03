import type { ReactNode } from 'react';
import { boldRuns, splitBullet, type ListGroup, type TextBlock } from '@/lib/product-content';
import { Icon } from '../icons';

/** Text with **bold** parts. */
export function Rich({ text }: { text: string }) {
  return <>{boldRuns(text).map(([t, bold], i) => (bold ? <b key={i} className="font-semibold text-ink">{t}</b> : <span key={i}>{t}</span>))}</>;
}

function Marker({ kind, n }: { kind: ListGroup['items'][number]['kind']; n: number }) {
  if (kind === 'number') return <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tint text-[11px] font-bold text-brand">{n}</span>;
  if (kind === 'dot') return <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />;
  if (kind === 'arrow') return <Icon name="arrow" size={16} className="mt-1 shrink-0 text-brand" />;
  return <Icon name="check" size={18} className="mt-0.5 shrink-0 text-ok" />;
}

/** "About this item": each list with its own title and marker style. */
export function ListGroups({ groups }: { groups: ListGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((g, gi) => {
        let n = 0;
        return (
          <div key={gi}>
            {g.title && <h3 className="mb-2 text-[15px] font-semibold"><Rich text={g.title} /></h3>}
            <ul className="space-y-2 text-[15px] leading-relaxed">
              {g.items.map((item, i) => {
                if (item.kind === 'number') n++;
                const [lead, rest] = splitBullet(item.text);
                // Keep what was typed between the bold lead and the rest: a colon stays a colon.
                const sep = lead && item.text.slice(lead.length).trimStart().startsWith(':') ? ': ' : ' – ';
                return (
                  <li key={i} className="flex gap-2.5">
                    <Marker kind={item.kind} n={n} />
                    <span>{lead ? <><b className="font-semibold">{lead}</b>{sep}<Rich text={rest} /></> : <Rich text={rest} />}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The description text: large and small headings, paragraphs. */
export function TextBlocks({ blocks }: { blocks: TextBlock[] }) {
  const out: ReactNode[] = blocks.map((b, i) =>
    b.type === 'h1' ? <h3 key={i} className="text-xl font-bold text-ink"><Rich text={b.text} /></h3>
    : b.type === 'h2' ? <h4 key={i} className="text-[16px] font-semibold text-ink"><Rich text={b.text} /></h4>
    : <p key={i} className="whitespace-pre-line"><Rich text={b.text} /></p>,
  );
  return <div className="space-y-3 text-[15px] leading-relaxed text-ink/85">{out}</div>;
}
