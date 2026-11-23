import { Project, ts } from 'ts-morph'
import { describe, expect, it } from 'vitest'

import { removeFlagFromProject } from './remove-flag.ts'

function createProject(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, strict: true },
  })
  for (const [path, content] of Object.entries(files)) {
    project.createSourceFile(path, content)
  }
  return project
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

describe('removeFlagFromProject', () => {
  it('troca <Feature> pelos children e apaga o componente do fallback sem outros usos', () => {
    const project = createProject({
      '/src/old.tsx': 'export function Old() { return <p>old</p> }\n',
      '/src/new.tsx': 'export function New() { return <p>new</p> }\n',
      '/src/flags.tsx':
        'export function Feature(props: { flag: string; fallback?: unknown; children: unknown }) { return props.children }\n',
      '/src/app.tsx': [
        "import { Feature } from './flags'",
        "import { New } from './new'",
        "import { Old } from './old'",
        'export function App() {',
        '  return (',
        '    <main>',
        '      <Feature flag="novoCheckout" fallback={<Old />}>',
        '        <New />',
        '      </Feature>',
        '    </main>',
        '  )',
        '}',
      ].join('\n'),
    })

    const report = removeFlagFromProject(project, 'novoCheckout')
    const app = project.getSourceFileOrThrow('/src/app.tsx').getFullText()

    expect(normalize(app)).toContain('<main> <New /> </main>')
    expect(app).not.toContain('Feature')
    expect(app).not.toContain('Old')
    expect(report.deletedFiles).toEqual(['/src/old.tsx'])
  })

  it('substitui useFlag por true e simplifica ternário e if', () => {
    const project = createProject({
      '/src/flags.ts': 'export function useFlag(name: string) { return name.length > 0 }\n',
      '/src/price.ts': [
        "import { useFlag } from './flags'",
        'export function price(value: number) {',
        "  const label = useFlag('novoCheckout') ? 'novo' : 'antigo'",
        "  if (!useFlag('novoCheckout')) {",
        '    return value',
        '  }',
        "  if (useFlag('novoCheckout')) {",
        '    return value * 0.9 + label.length',
        '  }',
        '  return value',
        '}',
      ].join('\n'),
    })

    removeFlagFromProject(project, 'novoCheckout')
    const price = project.getSourceFileOrThrow('/src/price.ts').getFullText()

    expect(price).toContain("const label = 'novo'")
    expect(price).not.toContain('useFlag')
    expect(price).not.toContain('if (')
    expect(normalize(price)).toContain('return value * 0.9 + label.length')
  })

  it('não altera arquivos que usam outra flag', () => {
    const source =
      "import { useFlag } from './flags'\nexport const enabled = useFlag('outraFlag')\n"
    const project = createProject({
      '/src/flags.ts': 'export function useFlag(name: string) { return name.length > 0 }\n',
      '/src/other.ts': source,
    })

    const report = removeFlagFromProject(project, 'novoCheckout')

    expect(report.changedFiles).toEqual([])
    expect(project.getSourceFileOrThrow('/src/other.ts').getFullText()).toBe(source)
  })
})
