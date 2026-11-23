import { Node, SyntaxKind } from 'ts-morph'
import type { JsxElement, JsxSelfClosingElement, Project, SourceFile } from 'ts-morph'

const FLAG_FUNCTIONS = new Set(['useFlag', 'isFlagEnabled'])

const FEATURE_TAG = 'Feature'

const FLAGS_LIBRARY_DIR = '/src/flags/'

export type RemovalReport = {
  changedFiles: string[]
  deletedFiles: string[]
}

function hasFlagAttribute(element: JsxElement | JsxSelfClosingElement, flagName: string): boolean {
  const attributes = Node.isJsxElement(element)
    ? element.getOpeningElement().getAttributes()
    : element.getAttributes()

  return attributes.some(function matchesFlag(attribute) {
    if (!Node.isJsxAttribute(attribute) || attribute.getNameNode().getText() !== 'flag') {
      return false
    }
    const initializer = attribute.getInitializer()
    if (!initializer) {
      return false
    }
    if (Node.isStringLiteral(initializer)) {
      return initializer.getLiteralValue() === flagName
    }
    if (Node.isJsxExpression(initializer)) {
      const expression = initializer.getExpression()
      return Node.isStringLiteral(expression) && expression.getLiteralValue() === flagName
    }
    return false
  })
}

function tagName(element: JsxElement | JsxSelfClosingElement): string {
  return Node.isJsxElement(element)
    ? element.getOpeningElement().getTagNameNode().getText()
    : element.getTagNameNode().getText()
}

function collectFallbackFiles(element: JsxElement | JsxSelfClosingElement): SourceFile[] {
  const attributes = Node.isJsxElement(element)
    ? element.getOpeningElement().getAttributes()
    : element.getAttributes()
  const files: SourceFile[] = []

  for (const attribute of attributes) {
    if (!Node.isJsxAttribute(attribute) || attribute.getNameNode().getText() !== 'fallback') {
      continue
    }
    const identifiers = attribute.getDescendantsOfKind(SyntaxKind.Identifier)
    for (const identifier of identifiers) {
      const symbol = identifier.getSymbol()
      const target = symbol?.getAliasedSymbol() ?? symbol
      for (const declaration of target?.getDeclarations() ?? []) {
        files.push(declaration.getSourceFile())
      }
    }
  }

  return files
}

function isJsxContainer(node: Node | undefined): boolean {
  return Node.isJsxElement(node) || Node.isJsxFragment(node)
}

function replaceFeatureElement(element: JsxElement | JsxSelfClosingElement): void {
  const insideJsx = isJsxContainer(element.getParent())

  if (Node.isJsxSelfClosingElement(element)) {
    element.replaceWithText(insideJsx ? '' : 'null')
    return
  }

  const children = element.getJsxChildren().filter(function isMeaningful(child) {
    return !(Node.isJsxText(child) && child.getText().trim() === '')
  })
  const childrenText = children
    .map(function toText(child) {
      return child.getText()
    })
    .join('\n')

  if (insideJsx) {
    element.replaceWithText(childrenText)
    return
  }
  if (children.length === 1 && !Node.isJsxText(children[0]) && !Node.isJsxExpression(children[0])) {
    element.replaceWithText(childrenText)
    return
  }
  element.replaceWithText(`<>${childrenText}</>`)
}

function findFeatureElement(
  sourceFile: SourceFile,
  flagName: string,
): JsxElement | JsxSelfClosingElement | undefined {
  const candidates = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
  return candidates.find(function isFeatureForFlag(element) {
    return tagName(element) === FEATURE_TAG && hasFlagAttribute(element, flagName)
  })
}

function findFlagCall(sourceFile: SourceFile, flagName: string): Node | undefined {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find(function isFlagCall(call) {
    const [argument] = call.getArguments()
    return (
      FLAG_FUNCTIONS.has(call.getExpression().getText()) &&
      Node.isStringLiteral(argument) &&
      argument.getLiteralValue() === flagName
    )
  })
}

function blockBody(statement: Node): string {
  if (Node.isBlock(statement)) {
    return statement
      .getStatements()
      .map(function toText(item) {
        return item.getText()
      })
      .join('\n')
  }
  return statement.getText()
}

function simplifyOnce(sourceFile: SourceFile): boolean {
  for (const parenthesized of sourceFile.getDescendantsOfKind(SyntaxKind.ParenthesizedExpression)) {
    const inner = parenthesized.getExpression().getText()
    if (inner === 'true' || inner === 'false') {
      parenthesized.replaceWithText(inner)
      return true
    }
  }

  for (const negation of sourceFile.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)) {
    if (negation.getOperatorToken() === SyntaxKind.ExclamationToken) {
      const operand = negation.getOperand().getText()
      if (operand === 'true' || operand === 'false') {
        negation.replaceWithText(operand === 'true' ? 'false' : 'true')
        return true
      }
    }
  }

  for (const conditional of sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    const condition = conditional.getCondition().getText()
    if (condition === 'true') {
      conditional.replaceWithText(conditional.getWhenTrue().getText())
      return true
    }
    if (condition === 'false') {
      conditional.replaceWithText(conditional.getWhenFalse().getText())
      return true
    }
  }

  for (const binary of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const operator = binary.getOperatorToken().getKind()
    const left = binary.getLeft().getText()
    if (operator === SyntaxKind.AmpersandAmpersandToken && left === 'true') {
      binary.replaceWithText(binary.getRight().getText())
      return true
    }
    if (operator === SyntaxKind.AmpersandAmpersandToken && left === 'false') {
      binary.replaceWithText('false')
      return true
    }
    if (operator === SyntaxKind.BarBarToken && left === 'true') {
      binary.replaceWithText('true')
      return true
    }
  }

  for (const ifStatement of sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
    const condition = ifStatement.getExpression().getText()
    if (condition === 'true') {
      ifStatement.replaceWithText(blockBody(ifStatement.getThenStatement()))
      return true
    }
    if (condition === 'false') {
      const elseStatement = ifStatement.getElseStatement()
      ifStatement.replaceWithText(elseStatement ? blockBody(elseStatement) : '')
      return true
    }
  }

  for (const expression of sourceFile.getDescendantsOfKind(SyntaxKind.JsxExpression)) {
    const inner = expression.getExpression()?.getText()
    if ((inner === 'false' || inner === 'null') && isJsxContainer(expression.getParent())) {
      expression.replaceWithText('')
      return true
    }
  }

  return false
}

export function removeFlagFromSourceFile(sourceFile: SourceFile, flagName: string): SourceFile[] {
  const fallbackFiles: SourceFile[] = []
  const originalText = sourceFile.getFullText()

  for (
    let element = findFeatureElement(sourceFile, flagName);
    element;
    element = findFeatureElement(sourceFile, flagName)
  ) {
    fallbackFiles.push(...collectFallbackFiles(element))
    replaceFeatureElement(element)
  }

  for (
    let call = findFlagCall(sourceFile, flagName);
    call;
    call = findFlagCall(sourceFile, flagName)
  ) {
    call.replaceWithText('true')
  }

  if (sourceFile.getFullText() !== originalText) {
    while (simplifyOnce(sourceFile)) {
      continue
    }
    sourceFile.organizeImports()
  }

  return fallbackFiles
}

export function removeFlagFromProject(project: Project, flagName: string): RemovalReport {
  const changedFiles: string[] = []
  const candidatesForDeletion = new Set<SourceFile>()

  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes(FLAGS_LIBRARY_DIR)) {
      continue
    }
    const before = sourceFile.getFullText()
    const fallbackFiles = removeFlagFromSourceFile(sourceFile, flagName)
    for (const file of fallbackFiles) {
      if (file !== sourceFile) {
        candidatesForDeletion.add(file)
      }
    }
    if (sourceFile.getFullText() !== before) {
      changedFiles.push(sourceFile.getFilePath())
    }
  }

  const deletedFiles: string[] = []
  for (const file of candidatesForDeletion) {
    if (file.isInNodeModules() || file.getReferencingSourceFiles().length > 0) {
      continue
    }
    deletedFiles.push(file.getFilePath())
    file.delete()
  }

  return { changedFiles, deletedFiles }
}
