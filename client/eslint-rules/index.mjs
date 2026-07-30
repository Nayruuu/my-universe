import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  () => 'https://example.com/docs/rules/prefer-signal-primitives',
);

const SIGNAL_CALLEES = new Set(['signal', 'computed', 'model', 'input']);
const PRIMITIVE_TYPES = new Set([
  'TSBooleanKeyword',
  'TSStringKeyword',
  'TSNumberKeyword',
  'TSBigIntKeyword',
  'TSSymbolKeyword',
  'TSNullKeyword',
  'TSUndefinedKeyword',
]);

const isPrimitiveTypeNode = (typeNode) => {
  if (!typeNode) {
    return false;
  }

  if (PRIMITIVE_TYPES.has(typeNode.type)) {
    return true;
  }

  if (typeNode.type === 'TSLiteralType') {
    const literalType = typeNode.literal?.type;

    return (
      literalType === 'Literal' ||
      literalType === 'BooleanLiteral' ||
      literalType === 'StringLiteral' ||
      literalType === 'NumericLiteral' ||
      literalType === 'BigIntLiteral'
    );
  }

  if (typeNode.type === 'TSUnionType') {
    return typeNode.types.every((child) => isPrimitiveTypeNode(child));
  }

  return false;
};

const isSignalInitializer = (node) => {
  if (!node || node.type !== 'CallExpression') {
    return false;
  }

  if (node.callee.type === 'Identifier') {
    return SIGNAL_CALLEES.has(node.callee.name);
  }

  if (node.callee.type === 'MemberExpression' && !node.callee.computed) {
    const property = node.callee.property;

    return property.type === 'Identifier' && SIGNAL_CALLEES.has(property.name);
  }

  return false;
};

const isPrimitiveInitializer = (node) => {
  if (!node) {
    return false;
  }

  if (node.type === 'Literal') {
    return ['string', 'number', 'boolean', 'bigint'].includes(typeof node.value);
  }

  if (node.type === 'BooleanLiteral') {
    return true;
  }

  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') {
    return true;
  }

  if (node.type === 'BigIntLiteral') {
    return true;
  }

  return false;
};

const getPropertyName = (node) => {
  if (node.key.type === 'Identifier') {
    return node.key.name;
  }

  if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value;
  }

  return null;
};

const preferSignalPrimitivesRule = createRule({
  name: 'prefer-signal-primitives',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer signals for public primitive fields (boolean/string/number/etc.).',
    },
    schema: [],
    messages: {
      preferSignal:
        "Public primitive field '{{name}}' should be a signal (use signal()/computed()/model()/input()).",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.key.type === 'PrivateIdentifier') {
          return;
        }

        if (node.accessibility && node.accessibility !== 'public') {
          return;
        }

        if (node.static) {
          return;
        }

        const propertyName = getPropertyName(node);

        if (!propertyName) {
          return;
        }

        const typeNode = node.typeAnnotation?.typeAnnotation;
        const hasPrimitiveType = isPrimitiveTypeNode(typeNode);
        const hasPrimitiveInit = isPrimitiveInitializer(node.value);

        if (!hasPrimitiveType && !hasPrimitiveInit) {
          return;
        }

        if (isSignalInitializer(node.value)) {
          return;
        }

        context.report({
          node,
          messageId: 'preferSignal',
          data: { name: propertyName },
        });
      },
    };
  },
});

export default {
  rules: {
    'prefer-signal-primitives': preferSignalPrimitivesRule,
  },
};
