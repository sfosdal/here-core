#!/usr/bin/env python3
"""Copy here-core's shared files into city repos.

usage: tools/sync.py [--check] <city repo> ...
  --check  change nothing; print what would change and exit 1 if anything would

What is shared is shared.txt. A city keeps more of its own in a .core-keep at
its repo root, one rule a line:
  <path>               the city's own copy of a shared file: never written
  <path> drop <regex>  write the shared file, then take out the lines matching
                       <regex> (a shared rule the city's own copy of something
                       else does not use)
"""
import fnmatch, pathlib, re, sys

CORE = pathlib.Path(__file__).resolve().parent.parent


def manifest():
    rules = []
    for line in (CORE / 'shared.txt').read_text().splitlines():
        line = line.split('#', 1)[0].strip()
        if line:
            kind, pat = line.split(None, 1)
            rules.append((kind, pat.strip()))
    return rules


def keep_rules(city):
    whole, drops = set(), {}
    f = city / '.core-keep'
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            m = re.match(r'(\S+)\s+drop\s+(.+)$', line)
            if m:
                drops.setdefault(m.group(1), []).append(re.compile(m.group(2)))
            else:
                whole.add(line)
    return whole, drops


def hue_runs(lines):
    out, i = [], 0
    while i < len(lines):
        if lines[i].lstrip().startswith('--v-'):  # 2-space (light, explicit dark) and 4-space (prefers-color-scheme block) runs alike
            j = i
            while j < len(lines) and lines[j].lstrip().startswith('--v-'):
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out


def with_city_hues(src_text, dst_text):
    a, b = src_text.split('\n'), dst_text.split('\n')
    ra, rb = hue_runs(a), hue_runs(b)
    assert len(ra) == len(rb), f'hue runs differ: core {len(ra)}, city {len(rb)}'
    out, pos = [], 0
    for (a0, a1), (b0, b1) in zip(ra, rb):
        out += a[pos:a0] + b[b0:b1]
        pos = a1
    return '\n'.join(out + a[pos:])


def plan(city):
    """[(relative path, new text)] for every shared file this city takes."""
    rules = manifest()
    never = [p for k, p in rules if k == 'never']
    whole, drops = keep_rules(city)
    paths = {}
    for kind, pat in rules:
        if kind == 'never':
            continue
        for src in sorted(CORE.glob(pat)):
            rel = str(src.relative_to(CORE))
            if any(fnmatch.fnmatch(rel, n) for n in never) or rel in whole:
                continue
            if kind != 'always' and not (city / rel).exists():
                continue
            paths[rel] = kind
    out = []
    for rel, kind in paths.items():
        text = (CORE / rel).read_text()
        if kind == 'styles':
            text = with_city_hues(text, (city / rel).read_text())
        for rx in drops.get(rel, []):
            text = '\n'.join(l for l in text.split('\n') if not rx.search(l))
        out.append((rel, text))
    return out


def main(argv):
    check = '--check' in argv
    cities = [pathlib.Path(a).resolve() for a in argv if a != '--check']
    changed_any = False
    for city in cities:
        changed = []
        for rel, text in plan(city):
            dst = city / rel
            if not dst.exists() or dst.read_text() != text:
                changed.append(rel)
                if not check:
                    dst.write_text(text)
        changed_any |= bool(changed)
        name = city.name if city.name != 'repo' else city.parent.name
        print(f"{'would change' if check else 'synced'} {name}: {', '.join(changed) if changed else 'nothing'}")
    return 1 if check and changed_any else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
