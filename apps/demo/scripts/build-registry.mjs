#!/usr/bin/env node
/**
 * Builds shadcn-compatible registry items from packages/widgets/src
 * and writes them to apps/demo/public/r/<name>.json, plus a top-level
 * registry.json index. Builders consume them via:
 *
 *   npx shadcn@latest add https://widgets.pmxt.dev/r/<name>.json
 *
 * Run: node scripts/build-registry.mjs (cwd-independent).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../registry.config.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = path.resolve(SCRIPT_DIR, '..');
const SRC_DIR = path.resolve(DEMO_DIR, '../../packages/widgets/src');
const OUT_DIR = path.join(DEMO_DIR, 'public', 'r');

const REGISTRY_ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json';
const REGISTRY_SCHEMA = 'https://ui.shadcn.com/schema/registry.json';

/** Source files bundled into the pmxt-core registry:lib item. */
const CORE_FILES = [
    'lib/types.ts',
    'lib/format.ts',
    'lib/client.ts',
    'lib/wallet.ts',
    'lib/venues.ts',
    'lib/convert.ts',
    'lib/icons.tsx',
    'provider.tsx',
    'hooks.ts',
];

const CORE_DESCRIPTION =
    'PMXT client, provider, hooks, and shared utilities for prediction market widgets.';

/**
 * Rewrites a single import specifier for its new on-disk location.
 * kind 'widget': files land in components/pmxt/, core lands in lib/pmxt/.
 * kind 'core': all files land flat in lib/pmxt/ together.
 */
function rewriteSpecifier(spec, kind) {
    if (kind === 'widget') {
        if (spec.startsWith('../lib/')) return `@/lib/pmxt/${spec.slice('../lib/'.length)}`;
        if (spec === '../provider') return '@/lib/pmxt/provider';
        if (spec === '../hooks') return '@/lib/pmxt/hooks';
        if (spec.startsWith('./')) return `@/components/pmxt/${spec.slice(2)}`;
        return spec;
    }
    if (spec.startsWith('./lib/')) return `./${spec.slice('./lib/'.length)}`;
    return spec;
}

/** Rewrites all `from '...'` / `from "..."` specifiers in file content. */
export function rewriteImports(content, kind) {
    return content.replace(
        /(from\s+)(['"])([^'"]+)\2/g,
        (_match, fromKeyword, quote, spec) =>
            `${fromKeyword}${quote}${rewriteSpecifier(spec, kind)}${quote}`,
    );
}

/** First sentence of a file's leading JSDoc block, or null. */
function extractDescription(content) {
    const head = content.replace(/^\s*['"]use client['"];?\s*/, '');
    const match = head.match(/^\/\*\*([\s\S]*?)\*\//);
    if (!match) return null;
    const text = match[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
    if (!text) return null;
    const sentenceEnd = text.indexOf('. ');
    return sentenceEnd === -1 ? text : text.slice(0, sentenceEnd + 1);
}

/** 'order-book' -> 'Order Book', 'pmxt-core' -> 'PMXT Core'. */
function titleCase(name) {
    return name
        .split('-')
        .map((word) => (word === 'pmxt' ? 'PMXT' : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(' ');
}

/** Sibling widget names imported via `from './<sibling>'`. */
function findSiblingImports(content) {
    const siblings = new Set();
    for (const match of content.matchAll(/from\s+['"]\.\/([\w-]+)['"]/g)) {
        siblings.add(match[1]);
    }
    return [...siblings].sort();
}

function buildCoreItem() {
    const files = CORE_FILES.flatMap((relPath) => {
        const absPath = path.join(SRC_DIR, relPath);
        if (!existsSync(absPath)) {
            console.warn(`  ! missing core file, skipped: ${relPath}`);
            return [];
        }
        const fileName = path.basename(relPath);
        return [{
            path: `registry/pmxt/pmxt-core/${fileName}`,
            content: rewriteImports(readFileSync(absPath, 'utf8'), 'core'),
            type: 'registry:lib',
            target: `lib/pmxt/${fileName}`,
        }];
    });
    return {
        $schema: REGISTRY_ITEM_SCHEMA,
        name: 'pmxt-core',
        type: 'registry:lib',
        title: 'PMXT Core',
        description: CORE_DESCRIPTION,
        dependencies: [],
        registryDependencies: [],
        files,
    };
}

function buildWidgetItem(fileName, baseUrl) {
    const absPath = path.join(SRC_DIR, 'widgets', fileName);
    if (!existsSync(absPath)) {
        console.warn(`  ! missing widget file, skipped: widgets/${fileName}`);
        return null;
    }
    const source = readFileSync(absPath, 'utf8');
    const name = path.basename(fileName, '.tsx');
    return {
        $schema: REGISTRY_ITEM_SCHEMA,
        name,
        type: 'registry:component',
        title: titleCase(name),
        description:
            extractDescription(source) ?? `${titleCase(name)} widget for PMXT prediction markets.`,
        dependencies: [],
        registryDependencies: [
            `${baseUrl}/r/pmxt-core.json`,
            ...findSiblingImports(source).map((sibling) => `${baseUrl}/r/${sibling}.json`),
        ],
        files: [{
            path: `registry/pmxt/${name}/${fileName}`,
            content: rewriteImports(source, 'widget'),
            type: 'registry:component',
            target: `components/pmxt/${fileName}`,
        }],
    };
}

function listWidgetFiles() {
    const widgetsDir = path.join(SRC_DIR, 'widgets');
    if (!existsSync(widgetsDir)) {
        console.warn(`  ! widgets directory not found: ${widgetsDir}`);
        return [];
    }
    return readdirSync(widgetsDir)
        .filter((file) => file.endsWith('.tsx'))
        .sort();
}

function writeJson(outPath, data) {
    writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
}

function main() {
    if (!existsSync(SRC_DIR)) {
        console.error(`Source directory not found: ${SRC_DIR}`);
        process.exit(1);
    }

    console.log(`Building PMXT registry (base URL: ${config.baseUrl})`);
    mkdirSync(OUT_DIR, { recursive: true });

    const widgetItems = listWidgetFiles()
        .map((fileName) => buildWidgetItem(fileName, config.baseUrl))
        .filter((item) => item !== null);
    const items = [buildCoreItem(), ...widgetItems];

    for (const item of items) {
        writeJson(path.join(OUT_DIR, `${item.name}.json`), item);
        console.log(`  wrote public/r/${item.name}.json (${item.type}, ${item.files.length} files)`);
    }

    const index = {
        $schema: REGISTRY_SCHEMA,
        name: config.name,
        homepage: config.homepage,
        items: items.map(({ name, type, title, description }) => ({ name, type, title, description })),
    };
    writeJson(path.join(OUT_DIR, 'registry.json'), index);
    console.log(`  wrote public/r/registry.json (index, ${items.length} items)`);
    console.log(`Done: ${items.length + 1} files in ${OUT_DIR}`);
}

main();
