import fs from 'fs';
import path from 'path';

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    if (!content.includes('import * as THREE')) {
        return;
    }

    const regex = /THREE\.([A-Za-z0-9_]+)/g;
    let match;
    const usages = new Set();
    while ((match = regex.exec(content)) !== null) {
        usages.add(match[1]);
    }

    if (usages.size === 0) {
        return;
    }

    const usagesArray = Array.from(usages).sort();
    
    // Check if some imported elements are types, and prefix them if needed
    // Actually, in TypeScript, importing types and values together like `import { Event, Mesh }` works perfectly fine, 
    // but sometimes TS complains if `--isolatedModules` is on. Since vite uses esbuild, usually it's fine 
    // to just import them as values if they are types, or we can use `type` modifier. 
    // To be safe, we can just do normal imports, and if TS complains, we fix it later.
    const namedImports = `import { ${usagesArray.join(', ')} } from 'three';`;

    // Replace the import
    content = content.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?/, namedImports);

    // Replace usages
    for (const usage of usagesArray) {
        const usageRegex = new RegExp(`THREE\\.${usage}\\b`, 'g');
        content = content.replace(usageRegex, usage);
    }

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Refactored ${filepath}`);
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

walkDir(path.join(process.cwd(), 'src'));
