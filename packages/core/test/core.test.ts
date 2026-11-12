import { describe, expect, it } from 'vitest';
import {
  autoTimeWords,
  buildCaptionFrame,
  cleanTranscriptText,
  buildLines,
  detectSpeechRegions,
  formatTimestamp,
  linesFromTranscript,
  linesFromTranscriptText,
  parseSrt,
  retimeForNewText,
  setWordText,
  setWordTimes,
  deleteWord,
  mergeWithNext,
  shiftLine,
  shiftWord,
  normalizeText,
  splitWords,
  TapSession,
  toSrt,
  upperCase,
  wordWeight,
  type CaptionStyle,
} from '../src/index.js';

describe('tekst', () => {
  it('normalizuje NFC i razmake', () => {
    const input = '  Dobro\u00a0 jutro,\n\n\n  ljudi.  ';
    expect(normalizeText(input)).toBe('Dobro jutro,\n\nljudi.');
  });

  it('ostavlja interpunkciju uz riječ', () => {
    expect(splitWords('Dobro jutro, ljudi.')).toEqual(['Dobro', 'jutro,', 'ljudi.']);
  });

  it('spaja navodnik sa riječi', () => {
    expect(splitWords('Rekao je "dobar dan" i otišao.')).toEqual([
      'Rekao',
      'je',
      '"dobar',
      'dan"',
      'i',
      'otišao.',
    ]);
  });

  it('ne pravi riječ od samostalne crtice', () => {
    expect(splitWords('burek - od nule')).toEqual(['burek', '-od', 'nule']);
  });

  it('drži emoji uz riječ', () => {
    expect(splitWords('Odlično 🔥 danas')).toEqual(['Odlično🔥', 'danas']);
  });

  it('velika slova po jeziku', () => {
    expect(upperCase('džem ljubav', 'bs')).toBe('DŽEM LJUBAV');
  });

  it('težina raste sa slogovima', () => {
    expect(wordWeight('a')).toBeLessThan(wordWeight('automobil'));
  });
});

describe('tapkanje', () => {
  const range = { startMs: 0, endMs: 10_000 };

  it('tap postavlja početak i zatvara prethodnu riječ', () => {
    const lines = buildLines('Dobro jutro');
    const session = new TapSession(lines, range);
    session.tap(1000);
    const afterSecond = session.tap(1600);
    const words = afterSecond.lines[0]!.words;
    expect(words[0]!.startMs).toBe(1000);
    expect(words[0]!.endMs).toBe(1600);
    expect(words[1]!.startMs).toBe(1600);
    expect(words[0]!.source).toBe('tap');
  });

  it('odbacuje slučajan dvostruki dodir', () => {
    const session = new TapSession(buildLines('Dobro jutro'), range);
    session.tap(1000);
    const result = session.tap(1020);
    expect(result.outcome).toBe('too-fast');
    expect(session.cursor).toBe(1);
  });

  it('poništavanje vraća na prethodnu riječ', () => {
    const session = new TapSession(buildLines('Dobro jutro'), range);
    session.tap(1000);
    session.tap(1800);
    const undo = session.undo();
    expect(undo?.cursor).toBe(1);
    expect(undo?.seekMs).toBe(1000);
  });

  it('zadnja riječ u redu ne visi duže od 1,5 s', () => {
    const session = new TapSession(buildLines('Dobro\njutro'), range);
    session.tap(1000);
    session.tap(5000);
    const lines = session.lines;
    expect(lines[0]!.words[0]!.endMs).toBe(2500);
  });

  it('ne dozvoljava riječ kraću od 80 ms', () => {
    const session = new TapSession(buildLines('a b'), range);
    session.tap(1000);
    const result = session.tap(1045);
    expect(result.outcome).toBe('ok');
    expect(session.lines[0]!.words[1]!.startMs).toBe(1080);
  });
});

describe('fino pomjeranje', () => {
  it('zaustavlja ivicu na susjednoj riječi', () => {
    const lines = buildLines('prva druga');
    lines[0]!.words[0]!.startMs = 1000;
    lines[0]!.words[0]!.endMs = 2000;
    lines[0]!.words[1]!.startMs = 2000;
    lines[0]!.words[1]!.endMs = 3000;

    const moved = setWordTimes(lines, lines[0]!.words[1]!.id, { startMs: 1500 });
    expect(moved[0]!.words[1]!.startMs).toBe(2000);
  });
});

describe('izmjena teksta', () => {
  it('mijenja samo jednu riječ i čuva njeno vrijeme', () => {
    const lines = buildLines('Dobro vjednik');
    lines[0]!.words[1]!.startMs = 1200;
    lines[0]!.words[1]!.endMs = 1800;
    const updated = setWordText(lines, lines[0]!.words[1]!.id, 'vjernik');
    expect(updated[0]!.words[1]!.text).toBe('vjernik');
    expect(updated[0]!.words[1]!.startMs).toBe(1200);
    expect(updated[0]!.words[0]!.text).toBe('Dobro');
  });

  it('digeli riječ na više riječi po istom trajanju', () => {
    const lines = buildLines('dunjaluk');
    lines[0]!.words[0]!.startMs = 1000;
    lines[0]!.words[0]!.endMs = 1600;
    const updated = setWordText(lines, lines[0]!.words[0]!.id, 'dunja luk');
    expect(updated[0]!.words.map((word) => word.text)).toEqual(['dunja', 'luk']);
    expect(updated[0]!.words[0]!.startMs).toBe(1000);
    expect(updated[0]!.words[1]!.endMs).toBeLessThanOrEqual(1600);
  });

  it('čuva vrijeme nepromijenjenih riječi', () => {
    const lines = buildLines('Dobro jutro ljudi');
    lines[0]!.words.forEach((word, index) => {
      word.startMs = 1000 + index * 500;
      word.endMs = 1500 + index * 500;
      word.source = 'tap';
    });

    const updated = retimeForNewText(lines, 'Dobro jutro dragi ljudi', { startMs: 0, endMs: 5000 });
    const words = updated[0]!.words;
    expect(words[0]!.startMs).toBe(1000);
    expect(words[1]!.startMs).toBe(1500);
    expect(words[3]!.text).toBe('ljudi');
    expect(words[3]!.startMs).toBe(2000);
    expect(words[2]!.source).toBe('spread');
  });
});

describe('auto tempiranje', () => {
  it('otkriva govorne dijelove iz nivoa glasnoće', () => {
    const rms = [0, 0, 0.2, 0.3, 0, 0, 0, 0.25, 0, 0];
    const regions = detectSpeechRegions(rms, 20);
    expect(regions.length).toBe(2);
    expect(regions[0]!.startMs).toBe(40);
  });

  it('raspoređuje riječi po govoru', () => {
    const lines = buildLines('Dobro jutro ljudi danas');
    const timed = autoTimeWords(lines, [{ startMs: 1000, endMs: 3000 }]);
    const words = timed[0]!.words;
    expect(words[0]!.startMs).toBe(1000);
    expect(words.every((word) => word.source === 'auto')).toBe(true);
    expect(words[words.length - 1]!.endMs).toBeLessThanOrEqual(3000);
  });
});

const style: CaptionStyle = {
  schemaVersion: 1,
  id: 'test/style',
  name: { bs: 'Test' },
  font: { family: 'Inter', weight: 800, size: 0.06 },
  layout: { maxLines: 2, maxWordsOnScreen: 5, align: 'center' },
  text: { fill: '#FFFFFF', uppercase: true },
  activeWord: { fill: '#FFE14A' },
  animations: {
    wordIn: [{ type: 'pop', durationMs: 140, easing: 'backOut' }],
  },
};

describe('kadar titla', () => {
  const lines = buildLines('Danas pravimo burek');
  lines[0]!.words.forEach((word, index) => {
    word.startMs = 1000 + index * 500;
    word.endMs = 1500 + index * 500;
    word.source = 'tap';
  });

  const frame = (timeMs: number) =>
    buildCaptionFrame({
      lines,
      timeMs,
      offsetMs: 0,
      style,
      box: { x: 0.5, y: 0.72, width: 0.84 },
      videoWidth: 1080,
      videoHeight: 1920,
      measure: (text, fontSize) => text.length * fontSize * 0.55,
    });

  it('prikazuje red i boji aktivnu riječ', () => {
    const current = frame(1700);
    expect(current.visible).toBe(true);
    expect(current.words.length).toBe(3);
    const active = current.words.find((word) => word.isActive);
    expect(active?.text).toBe('PRAVIMO');
    expect(active?.fill).toBe('#FFE14A');
  });

  it('skriva kadar izvan vremena reda', () => {
    expect(frame(600).visible).toBe(false);
  });

  it('animira riječ pri ulasku', () => {
    const early = frame(1610);
    const word = early.words.find((entry) => entry.text === 'PRAVIMO');
    expect(word?.scale).toBeGreaterThan(1);
  });

  it('dug red prikazuje stranicu s riječju koja se izgovara, ne odsječen početak', () => {
    const long = buildLines('Prvo zamijesimo tijesto pa ga ostavimo da odmori dok peć grije');
    long[0]!.words.forEach((word, index) => {
      word.startMs = 1000 + index * 400;
      word.endMs = 1400 + index * 400;
      word.source = 'auto';
    });
    const at = (timeMs: number) =>
      buildCaptionFrame({
        lines: long,
        timeMs,
        offsetMs: 0,
        style,
        box: { x: 0.5, y: 0.72, width: 0.84 },
        videoWidth: 1080,
        videoHeight: 1920,
        measure: (text, fontSize) => text.length * fontSize * 0.55,
      });

    const start = at(1100);
    expect(start.words[0]?.text).toBe('PRVO');
    expect(start.words.find((word) => word.isActive)?.text).toBe('PRVO');
    expect(start.fontSize).toBeGreaterThan(0.06 * 1920 * 0.6);

    const end = at(1000 + 9 * 400 + 100);
    expect(end.words.find((word) => word.isActive)?.text).toBe('PEĆ');
    expect(end.words.some((word) => word.text === 'PRVO')).toBe(false);
  });

  it('riječ bez vremena ne pomjera isticanje na pogrešnu riječ', () => {
    const lines = buildLines('jedan dva tri');
    const [one, two, three] = lines[0]!.words;
    Object.assign(one!, { startMs: 1000, endMs: 1400, source: 'auto' });
    Object.assign(two!, { startMs: 1400, endMs: 1400, source: 'spread' });
    Object.assign(three!, { startMs: 1500, endMs: 1900, source: 'auto' });
    const current = buildCaptionFrame({
      lines,
      timeMs: 1600,
      offsetMs: 0,
      style,
      box: { x: 0.5, y: 0.72, width: 0.84 },
      videoWidth: 1080,
      videoHeight: 1920,
      measure: (text, fontSize) => text.length * fontSize * 0.55,
    });
    expect(current.words.map((word) => word.text)).toEqual(['JEDAN', 'TRI']);
    expect(current.words.find((word) => word.isActive)?.text).toBe('TRI');
  });
});

describe('pomjeranje riječi i redova', () => {
  const timed = () => {
    const lines = buildLines('jedan dva\ntri četiri');
    const times = [
      [1000, 1400],
      [1400, 1800],
      [3000, 3400],
      [3400, 3900],
    ];
    lines
      .flatMap((line) => line.words)
      .forEach((word, index) => {
        word.startMs = times[index]![0]!;
        word.endMs = times[index]![1]!;
        word.source = 'auto';
      });
    return lines;
  };

  it('pomjera cijelu riječ i čuva trajanje, do susjeda', () => {
    const lines = timed();
    const id = lines[0]!.words[1]!.id;
    const moved = shiftWord(lines, id, 500);
    const word = moved[0]!.words[1]!;
    expect(word.startMs).toBe(1900);
    expect(word.endMs).toBe(2300);
    expect(word.source).toBe('manual');
    const blocked = shiftWord(lines, id, -300);
    expect(blocked[0]!.words[1]!.startMs).toBe(1400);
  });

  it('pomjera cijeli red bez preklapanja sa susjednim redom', () => {
    const lines = timed();
    const later = shiftLine(lines, 1, 250);
    expect(later[1]!.words.map((word) => word.startMs)).toEqual([3250, 3650]);
    const earlier = shiftLine(lines, 1, -5000);
    expect(earlier[1]!.words[0]!.startMs).toBe(1800);
    expect(earlier[1]!.words[1]!.endMs).toBe(2700);
    expect(lines[1]!.words[0]!.startMs).toBe(3000);
  });
});

describe('brisanje i spajanje riječi', () => {
  const timed = () => {
    const lines = buildLines('Ovo je N amjenjena\nriječ');
    lines
      .flatMap((line) => line.words)
      .forEach((word, index) => {
        word.startMs = 1000 + index * 300;
        word.endMs = 1250 + index * 300;
        word.source = 'auto';
      });
    return lines;
  };

  it('briše riječ, a ostale ne pomjera', () => {
    const lines = timed();
    const out = deleteWord(lines, lines[0]!.words[2]!.id);
    expect(out[0]!.words.map((word) => word.text)).toEqual(['Ovo', 'je', 'amjenjena']);
    expect(out[0]!.words.map((word) => word.startMs)).toEqual([1000, 1300, 1900]);
    expect(out[1]!.words[0]!.startMs).toBe(2200);
  });

  it('briše prazan red', () => {
    const lines = timed();
    const out = deleteWord(lines, lines[1]!.words[0]!.id);
    expect(out.length).toBe(1);
  });

  it('spaja slovo sa sljedećom riječi bez razmaka', () => {
    const lines = timed();
    const out = mergeWithNext(lines, lines[0]!.words[2]!.id);
    const merged = out[0]!.words[2]!;
    expect(out[0]!.words.map((word) => word.text)).toEqual(['Ovo', 'je', 'Namjenjena']);
    expect(merged.startMs).toBe(1600);
    expect(merged.endMs).toBe(2150);
    expect(out[0]!.words[1]!.endMs).toBe(1550);
    expect(out[1]!.words[0]!.startMs).toBe(2200);
  });

  it('spaja zadnju riječ reda s prvom riječi sljedećeg reda', () => {
    const lines = timed();
    const out = mergeWithNext(lines, lines[0]!.words[3]!.id);
    expect(out.length).toBe(1);
    expect(out[0]!.words.at(-1)!.text).toBe('amjenjenariječ');
  });
});

describe('prepoznati govor', () => {
  it('grupiše riječi u redove po pauzi i dužini', () => {
    const chunks = [
      { text: ' Dobro', startMs: 1000, endMs: 1300 },
      { text: ' jutro,', startMs: 1300, endMs: 1700 },
      { text: ' ljudi.', startMs: 1700, endMs: 2100 },
      { text: ' Danas', startMs: 2600, endMs: 2900 },
      { text: ' pravimo', startMs: 2900, endMs: 3400 },
    ];
    const lines = linesFromTranscriptText(
      'Dobro jutro, ljudi. Danas pravimo',
      chunks,
    );
    expect(lines.length).toBe(2);
    expect(lines[0]!.words.map((word) => word.text)).toEqual(['Dobro', 'jutro,', 'ljudi.']);
    expect(lines[1]!.words[0]!.startMs).toBe(2600);
    expect(lines[0]!.words[0]!.source).toBe('auto');
  });

  it('digeli komad sa više riječi po vremenu', () => {
    const lines = linesFromTranscriptText('dobar dan', [
      { text: ' dobar dan', startMs: 0, endMs: 600 },
    ]);
    expect(lines[0]!.words.length).toBe(2);
    expect(lines[0]!.words[1]!.startMs).toBeGreaterThan(0);
  });

  it('spaja zadnje slovo u prethodnu riječ', () => {
    const lines = linesFromTranscriptText('pravimo burek od', [
      { text: ' pravimo', startMs: 0, endMs: 400 },
      { text: ' bur', startMs: 400, endMs: 600 },
      { text: 'ek', startMs: 600, endMs: 700 },
      { text: ' od', startMs: 700, endMs: 900 },
    ]);
    expect(lines[0]!.words.map((word) => word.text)).toEqual(['pravimo', 'burek', 'od']);
    expect(lines[0]!.words[1]!.endMs).toBe(700);
  });

  it('spaja interpunkciju bez razmaka', () => {
    const lines = linesFromTranscriptText('Dobro jutro,', [
      { text: ' Dobro', startMs: 0, endMs: 300 },
      { text: ' jutro', startMs: 300, endMs: 600 },
    ]);
    expect(lines[0]!.words.map((word) => word.text)).toEqual(['Dobro', 'jutro,']);
  });

  it('ne dozvoljava preklapanje vremena iz komada', () => {
    const lines = linesFromTranscriptText('prva druga', [
      { text: ' prva', startMs: 0, endMs: 300 },
      { text: ' druga', startMs: 200, endMs: 500 },
    ]);
    const [first, second] = lines[0]!.words;
    expect(second!.startMs).toBeGreaterThanOrEqual(first!.endMs);
  });

  it('čisti navodnike i razmake prije interpunkcije', () => {
    expect(cleanTranscriptText("  kaže' 'Ja ,  dobro  ")).toBe('kaže Ja, dobro');
  });
});

describe('formati', () => {
  it('formatira vrijeme', () => {
    expect(formatTimestamp(3_723_456)).toBe('01:02:03,456');
  });

  it('izvozi i uvozi SRT', () => {
    const lines = buildLines('Dobro jutro\nljudi');
    lines[0]!.words.forEach((word, index) => {
      word.startMs = 1000 + index * 400;
      word.endMs = 1400 + index * 400;
    });
    lines[1]!.words[0]!.startMs = 2500;
    lines[1]!.words[0]!.endMs = 3100;

    const srt = toSrt(lines);
    expect(srt).toContain('00:00:01,000 --> 00:00:01,800');
    const parsed = parseSrt(srt);
    expect(parsed.length).toBe(2);
    expect(parsed[0]!.words[0]!.text).toBe('Dobro');
  });
});
